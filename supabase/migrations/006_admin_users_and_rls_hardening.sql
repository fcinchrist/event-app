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
create policy "event_users_admin_select"
  on public.event_users
  for select
  to authenticated
  using (true);

-- 1b. INSERT: anon may still insert (public booking form creates
--      a user row when the phone is not yet registered), but every
--      insert must satisfy a strict shape check.
create policy "event_users_public_insert"
  on public.event_users
  for insert
  to anon
  with check (
    no_hp ~ '^08[0-9]{8,11}$'                              -- Indonesian mobile format
    and length(trim(nama)) >= 2                             -- name min 2 chars
    and coalesce(user_status, 'active') in ('active', 'inactive')
    and coalesce(member_type, 'internal') in ('internal', 'external')
  );

-- 1c. UPDATE & DELETE: only admin.
create policy "event_users_admin_modify"
  on public.event_users
  for update
  to authenticated
  using (true)
  with check (true);

create policy "event_users_admin_delete"
  on public.event_users
  for delete
  to authenticated
  using (true);


-- =============================================================
-- 2. event_registrations
-- =============================================================

-- 2a. Anon SELECT is blocked entirely. Admin SELECT works as usual.
create policy "event_registrations_block_direct_select"
  on public.event_registrations
  for select
  to anon
  using (false);

create policy "event_registrations_admin_select"
  on public.event_registrations
  for select
  to authenticated
  using (true);

-- 2b. Public INSERT (booking form). Strict shape check.
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
create policy "event_registrations_admin_insert"
  on public.event_registrations
  for insert
  to authenticated
  with check (true);

-- 2c. UPDATE & DELETE: only admin.
create policy "event_registrations_admin_modify"
  on public.event_registrations
  for update
  to authenticated
  using (true)
  with check (true);

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


-- =============================================================
-- 4. Tighten table-level grants so PostgREST does not expose
--    these tables to anon outside of the explicit RPCs above.
-- =============================================================
revoke all on public.event_users          from anon;
revoke all on public.event_registrations  from anon;

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
