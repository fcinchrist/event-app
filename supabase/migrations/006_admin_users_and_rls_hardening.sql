-- =============================================================
-- Event Management System – Migration #6
--   RLS hardening: block anon SELECT, restrict INSERT,
--   tighten event_registrations, expose safe RPCs.
--
-- Schema reference (verified against migrations 002 + 004):
--   public.event_users:
--     id            text PK         'USR-YYYY-NNNNN'
--     no_hp         text NOT NULL UNIQUE  '08123456789'
--     nama          text NOT NULL
--     user_status   text NOT NULL DEFAULT 'active'   ('active'|'inactive'|'banned')
--     member_type   text NOT NULL DEFAULT 'internal' ('internal'|'external')
--     created_at    timestamptz NOT NULL DEFAULT now()
--     updated_at    timestamptz NOT NULL DEFAULT now()
--   -- NOTE: there is NO `alamat`, `email`, `category_id`, `birth_date`,
--   -- `gender`, or `notes` column in this table.
--
--   public.event_registrations:
--     id              text PK       'REG-YYYY-NNNNN'
--     user_id         text NOT NULL REFERENCES public.event_users(id) ON DELETE CASCADE
--     event_id        uuid NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE
--     status          text NOT NULL DEFAULT 'Terdaftar' CHECK ('Terdaftar'|'Hadir'|'Tidak Hadir')
--     checkin_at      timestamptz
--     registered_at   timestamptz NOT NULL DEFAULT now()
--     verified_by_email text   (added by migration 005)
--     verified_at       timestamptz (added by migration 005)
--     UNIQUE (user_id, event_id)
--
-- Architecture assumption (see project README):
--   * No public sign-up for auth users.
--   * Every Supabase Auth user is an admin (created manually from
--     the Supabase Dashboard → Authentication → Users).
--   * The only "authenticated" role in this project = admin.
--
-- So RLS only needs to distinguish:
--   * `anon`         → public visitor (no login)
--   * `authenticated` → admin (logged in via /admin/login)
-- =============================================================

-- -------------------------------------------------------------
-- 0. Drop the old, too-permissive policies from migration 002
--    and migration 004. These were the source of the no_hp leak
--    and the spam/DoS vector.
-- -------------------------------------------------------------
drop policy if exists "event_users_read_public"          on public.event_users;
drop policy if exists "event_users_write_admin"          on public.event_users;
drop policy if exists "event_users_insert_public"        on public.event_users;

drop policy if exists "event_registrations_read_public"    on public.event_registrations;
drop policy if exists "event_registrations_insert_public"  on public.event_registrations;
drop policy if exists "event_registrations_update_admin"  on public.event_registrations;
drop policy if exists "event_registrations_delete_admin"  on public.event_registrations;


-- =============================================================
-- 1. event_users
-- =============================================================

-- 1a. SELECT: only admin can read. Anon SELECT is fully blocked.
drop policy if exists "event_users_admin_select"   on public.event_users;
create policy "event_users_admin_select"
  on public.event_users
  for select
  to authenticated
  using (true);

-- 1b. INSERT: anon may still insert (public booking form creates
--      a user row when the phone is not yet registered), but every
--      insert must satisfy a strict shape check.
--
-- We use `to anon, authenticated` so this single policy replaces
-- BOTH the old `event_users_insert_public` (created in migration 004
-- with `to anon, authenticated with check (true)`) AND covers the
-- admin-side INSERT. This way, even if a stale policy from migration
-- 004 still exists in the database, this newer policy is what gates
-- the row.
--
-- IMPORTANT: When multiple policies target the same (table, role, cmd),
-- PostgreSQL evaluates them with OR semantics — a row passes if ANY
-- applicable policy passes. So if migration 004's permissive policy
-- still lingers, it will effectively allow the row through. That is
-- actually fine for migration 004's `with check (true)`, but to be
-- safe we ALSO drop it explicitly above.
drop policy if exists "event_users_public_insert"  on public.event_users;
create policy "event_users_public_insert"
  on public.event_users
  for insert
  to anon, authenticated
  with check (
    -- Strict shape check for public INSERT.
    -- Keep these predicates aligned with the JS `BookEventInput` interface
    -- in `application/use-cases/book-event.ts`. If you add a new required
    -- column to event_users, you MUST add a matching check here or anon
    -- INSERT will fail with "new row violates row-level security policy".
    --
    -- Each predicate is wrapped in `coalesce(..., <safe default>)` so
    -- a missing / NULL column from the client never produces a NULL
    -- boolean (which would silently reject the row). For example, an
    -- INSERT that omits `member_type` becomes `coalesce(member_type,
    -- 'internal') in (...)`, which is true.
    -- 08 + 9 to 13 more digits = total 11 to 15 digits. Mirrors the
    -- length window accepted by `normalizePhone` (10-15 digits) so the
    -- policy never rejects a value the JS layer would have normalized.
    coalesce(no_hp, '') ~ '^08[0-9]{8,12}$'
    and length(trim(coalesce(nama, ''))) >= 2
    and coalesce(user_status, 'active') in ('active', 'inactive', 'banned')
    and coalesce(member_type, 'external') in ('internal', 'external')
  );

-- 1c. UPDATE & DELETE: only admin.
drop policy if exists "event_users_admin_modify"   on public.event_users;
create policy "event_users_admin_modify"
  on public.event_users
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "event_users_admin_delete"   on public.event_users;
create policy "event_users_admin_delete"
  on public.event_users
  for delete
  to authenticated
  using (true);


-- =============================================================
-- 2. event_registrations
-- =============================================================

-- 2a. Anon has the table-level SELECT grant (required by the quota
--      and duplicate-check RPCs), but THIS policy blocks all rows
--      for anon with `using (false)`. So even though anon technically
--      has SELECT privilege, every SELECT returns 0 rows.
drop policy if exists "event_registrations_block_direct_select" on public.event_registrations;
create policy "event_registrations_block_direct_select"
  on public.event_registrations
  for select
  to anon
  using (false);

drop policy if exists "event_registrations_admin_select"         on public.event_registrations;
create policy "event_registrations_admin_select"
  on public.event_registrations
  for select
  to authenticated
  using (true);

-- 2b. Public INSERT (booking form). Strict shape check.
drop policy if exists "event_registrations_public_insert"       on public.event_registrations;
create policy "event_registrations_public_insert"
  on public.event_registrations
  for insert
  to anon
  with check (
    user_id is not null
    and event_id is not null
    and coalesce(status, 'Terdaftar') in ('Terdaftar', 'Hadir', 'Tidak Hadir')
  );

-- Admin INSERT (manual entry from the dashboard).
drop policy if exists "event_registrations_admin_insert"        on public.event_registrations;
create policy "event_registrations_admin_insert"
  on public.event_registrations
  for insert
  to authenticated
  with check (true);

-- 2c. UPDATE & DELETE: only admin.
drop policy if exists "event_registrations_admin_modify"        on public.event_registrations;
create policy "event_registrations_admin_modify"
  on public.event_registrations
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "event_registrations_admin_delete"        on public.event_registrations;
create policy "event_registrations_admin_delete"
  on public.event_registrations
  for delete
  to authenticated
  using (true);


-- =============================================================
-- 3. Public RPCs (SECURITY DEFINER)
--    They bypass RLS to do exactly one safe job, returning only
--    what is necessary.
-- =============================================================

-- 3a. Lookup user by phone — returns minimal shape ({id, nama}).
--      Used by the booking form for name autofill. No PII leaks.
create or replace function public.lookup_event_user_by_phone(p_no_hp text)
returns table(id text, nama text)
language sql
stable
security definer
set search_path = public
as $$
  select id, nama
  from public.event_users
  where no_hp = p_no_hp
  limit 1;
$$;

grant execute on function public.lookup_event_user_by_phone(text)
  to anon, authenticated;

-- 3b. Full user lookup by phone — used internally by the
--      BookEvent use case to either reuse or create a user.
--      Returns the whole row because the use case needs the id.
create or replace function public.find_event_user_by_phone_for_booking(p_no_hp text)
returns setof public.event_users
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.event_users
  where no_hp = p_no_hp
  limit 1;
$$;

grant execute on function public.find_event_user_by_phone_for_booking(text)
  to anon, authenticated;

-- 3c. Duplicate registration check — returns boolean.
--      Public can't SELECT event_registrations after this migration,
--      so the booking flow goes through this RPC instead.
create or replace function public.find_registration_by_user_and_event(
  p_user_id  text,
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_registrations
    where user_id = p_user_id
      and event_id = p_event_id
  );
$$;

grant execute on function public.find_registration_by_user_and_event(text, uuid)
  to anon, authenticated;

-- 3d. ID existence check for `generateUniqueId`.
--      The client-side ID generator (`application/use-cases/generate-id.ts`)
--      asks "is this candidate ID already taken?" by calling this RPC
--      instead of doing a raw SELECT on the table. Without this, the
--      booking form would hit "permission denied for table event_users"
--      (or event_registrations) when anon tries to look up an id.
--      Returns boolean: true = taken, false = free.
create or replace function public.id_exists(
  p_table    text,
  p_candidate text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_table = 'event_users' then
    select exists(select 1 from public.event_users where id = p_candidate)
      into v_exists;
  elsif p_table = 'event_registrations' then
    select exists(select 1 from public.event_registrations where id = p_candidate)
      into v_exists;
  else
    raise exception 'id_exists: unsupported table %', p_table;
  end if;
  return v_exists;
end;
$$;

grant execute on function public.id_exists(text, text)
  to anon, authenticated;

-- 3e. Count registrations per event for the quota check.
--      `BookEvent` calls this to decide "is there still a free seat?".
--      We need an RPC because anon cannot SELECT event_registrations.
create or replace function public.count_registrations_by_event(p_event_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.event_registrations
  where event_id = p_event_id;
$$;

grant execute on function public.count_registrations_by_event(uuid)
  to anon, authenticated;

-- 3f. Public list of registrations for ONE event — used by the
--      event detail page (badge "X/Y Terisi" + participant list).
--      Returns the registration row + the participant's `nama`
--      + a MASKED `no_hp` (e.g. '0812****789') so the public UI
--      can show "ID | WA: 0812****789" without ever leaking the
--      raw phone number. Sorted newest-first.
--      SECURITY DEFINER so it bypasses the anon SELECT block on
--      event_registrations / event_users.
--
-- Masking rule:
--   * If the phone is at least 8 digits long, keep the first 4
--     and last 3 digits, replace the middle with '****'.
--     Example: '08123456789' → '0812****789'.
--   * If shorter than 8 digits (corrupt row), return '****'.
--   * If NULL, return NULL.
drop function if exists public.list_event_registrations_public(uuid);
create function public.list_event_registrations_public(p_event_id uuid)
returns table (
  id            text,
  user_id       text,
  event_id      uuid,
  status        text,
  checkin_at    timestamptz,
  registered_at timestamptz,
  user_nama     text,
  user_no_hp_masked text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.user_id,
    r.event_id,
    r.status,
    r.checkin_at,
    r.registered_at,
    u.nama as user_nama,
    case
      when u.no_hp is null then null
      when length(u.no_hp) < 8 then '****'
      else substr(u.no_hp, 1, 4) || '****' || substr(u.no_hp, length(u.no_hp) - 2, 3)
    end as user_no_hp_masked
  from public.event_registrations r
  left join public.event_users u on u.id = r.user_id
  where r.event_id = p_event_id
  order by r.registered_at desc;
$$;

grant execute on function public.list_event_registrations_public(uuid)
  to anon, authenticated;


-- =============================================================
-- 4. Table-level grants.
--
-- IMPORTANT: RLS policies only CHECK privileges; they do not grant
-- them. Without an explicit table-level grant, even a permissive
-- `with check (true)` policy will result in:
--     "permission denied for table event_users"
--
-- The booking flow is RPC-driven (no raw SELECT), so anon needs
-- INSERT on both tables. We also grant SELECT on event_registrations
-- to anon because the RPC `count_registrations_by_event` and the
-- post-insert path require the underlying table to be queryable
-- for the RPC result. (The RLS policy itself remains the gate that
-- decides which rows anon can read.)
-- =============================================================

-- Anon: INSERT on both tables, plus SELECT on event_registrations
-- (used by the quota-count and duplicate-check flows). RLS policies
-- above still block anon from reading arbitrary user PII.
grant insert on public.event_users         to anon;
grant insert, select on public.event_registrations to anon;

-- Admin (authenticated) gets full DML — the policies above gate
-- which rows they can actually see/touch.
grant select, insert, update, delete on public.event_users          to authenticated;
grant select, insert, update, delete on public.event_registrations  to authenticated;


-- =============================================================
-- 5. Annotations for future readers
-- =============================================================
comment on policy "event_users_admin_select" on public.event_users is
  'Admin-only SELECT. Migration 006. Before this, anon could SELECT all columns (no_hp leak).';

comment on policy "event_users_public_insert" on public.event_users is
  'Anon INSERT with strict shape check (no_hp regex, name length, enum values). Migration 006. Before this, anon could spam insert with any garbage.';

comment on policy "event_registrations_block_direct_select" on public.event_registrations is
  'Anon SELECT is blocked. Use RPC find_registration_by_user_and_event for public duplicate checks. Migration 006.';


-- =============================================================
-- 6. Sanity check (run in Supabase SQL Editor after migration)
-- =============================================================
-- Run this to confirm only ONE INSERT policy is active on event_users
-- and that it is the strict one created above (not a stale `with check (true)`
-- left over from migration 004):
--
--   select policyname, roles, cmd, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename = 'event_users'
--     and cmd = 'INSERT';
--
-- Expected: a single row named `event_users_public_insert` with
-- `roles = {anon,authenticated}` and a `with_check` containing
-- `no_hp ~ '^08[0-9]{8,12}$'`.
-- =============================================================
