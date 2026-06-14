-- =============================================================
-- Event Management System – Migration #2
-- Master user (event_users) + event registrations + attendance flag
--
-- CATATAN:
-- - Migration ini menambah 2 tabel untuk fitur booking publik &
--   tracking kehadiran peserta oleh admin.
-- - ID `event_users` & `event_registrations` bertipe TEXT dengan format
--   custom 'USR-2026-00001' / 'REG-2026-00001' (tahun + 5 digit urut).
-- - RLS: publik boleh baca, publik boleh INSERT ke event_registrations
--   (user mendaftar tanpa login). Hanya authenticated (admin) yang boleh
--   update/delete.
-- - Jalankan migration ini di Supabase SQL Editor:
--   https://app.supabase.com/project/_/sql
-- =============================================================


-- -------------------------------------------------------------
-- 1. TABLE: event_users (master user publik, TANPA auth)
-- -------------------------------------------------------------
create table if not exists public.event_users (
  id          text primary key,                       -- 'USR-2026-00001'
  no_hp       text not null unique,                   -- normalized: '08123456789'
  nama        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_event_users_no_hp on public.event_users (no_hp);

drop trigger if exists trg_event_users_updated_at on public.event_users;
create trigger trg_event_users_updated_at
  before update on public.event_users
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------
-- 2. TABLE: event_registrations (mapping USR ↔ EVT)
-- -------------------------------------------------------------
create table if not exists public.event_registrations (
  id            text primary key,                     -- 'REG-2026-00001'
  user_id       text not null references public.event_users(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  status        text not null default 'Terdaftar'
                check (status in ('Terdaftar', 'Hadir', 'Tidak Hadir')),
  checkin_at    timestamptz,
  registered_at timestamptz not null default now(),
  unique (user_id, event_id)                          -- 1 user hanya 1x per event
);
create index if not exists idx_reg_event   on public.event_registrations (event_id);
create index if not exists idx_reg_user    on public.event_registrations (user_id);
create index if not exists idx_reg_status  on public.event_registrations (status);


-- -------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- -------------------------------------------------------------
alter table public.event_users enable row level security;
alter table public.event_registrations enable row level security;

-- event_users: publik baca, admin tulis
drop policy if exists "event_users_read_public" on public.event_users;
create policy "event_users_read_public"
  on public.event_users for select to anon, authenticated using (true);

drop policy if exists "event_users_write_admin" on public.event_users;
create policy "event_users_write_admin"
  on public.event_users for all to authenticated using (true) with check (true);

-- event_registrations: publik baca & insert (biar user bisa daftar tanpa login),
-- admin update & delete (untuk toggle kehadiran & pembatalan)
drop policy if exists "event_registrations_read_public" on public.event_registrations;
create policy "event_registrations_read_public"
  on public.event_registrations for select to anon, authenticated using (true);

drop policy if exists "event_registrations_insert_public" on public.event_registrations;
create policy "event_registrations_insert_public"
  on public.event_registrations for insert to anon, authenticated with check (true);

drop policy if exists "event_registrations_update_admin" on public.event_registrations;
create policy "event_registrations_update_admin"
  on public.event_registrations for update to authenticated using (true) with check (true);

drop policy if exists "event_registrations_delete_admin" on public.event_registrations;
create policy "event_registrations_delete_admin"
  on public.event_registrations for delete to authenticated using (true);
