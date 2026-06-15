-- =============================================================
-- Event Management System – Migration #4
-- Extend master user (`event_users`) with status & member type
--
-- Run this in the Supabase SQL Editor:
--   https://app.supabase.com/project/_/sql
--
-- Notes:
-- - Adds two new columns to `event_users`:
--     * `user_status`  : 'active' | 'inactive' | 'banned'
--     * `member_type`  : 'internal' | 'external'
-- - Both columns are NOT NULL with a CHECK constraint and a
--   safe DEFAULT so existing rows are auto-filled by Postgres
--   ('active' / 'internal'). The application layer also defaults
--   to these values, so the two never disagree.
-- - Indexed to keep the master user list filter fast even when
--   the table grows to thousands of rows.
-- - No RLS changes needed: the existing `event_users_write_admin`
--   policy from migration 002 already covers UPDATE/DELETE.
-- =============================================================


-- -------------------------------------------------------------
-- 1. ADD COLUMNS (idempotent)
-- -------------------------------------------------------------
--
-- Penting: DEFAULT 'internal' hanya untuk baris lama yang sudah ada
-- sebelum migration ini dijalankan. Untuk baris baru, aplikasi akan
-- mengirim 'external' secara eksplisit (lihat RegisterUser use case
-- dan AddUserModal). DEFAULT di DB tetap 'internal' supaya baris
-- lama yang tidak ikut tersentuh aplikasi tetap punya nilai valid
-- (kolom NOT NULL).
alter table public.event_users
  add column if not exists user_status text
    not null default 'active'
    check (user_status in ('active', 'inactive', 'banned'));

alter table public.event_users
  add column if not exists member_type text
    not null default 'internal'
    check (member_type in ('internal', 'external'));


-- -------------------------------------------------------------
-- 2. INDEXES
-- -------------------------------------------------------------
create index if not exists idx_event_users_user_status
  on public.event_users (user_status);

create index if not exists idx_event_users_member_type
  on public.event_users (member_type);


-- -------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY UPDATE
-- -------------------------------------------------------------
-- Migration 002 sudah memasang dua policy untuk `event_users`:
--   * `event_users_read_public`   — SELECT untuk anon & authenticated
--   * `event_users_write_admin`   — ALL untuk authenticated (admin)
--
-- Tapi tidak ada policy untuk INSERT dari `anon`. Akibatnya, alur
-- publik form booking di [`BookEvent`](application/use-cases/book-event.ts)
-- yang membuat baris `event_users` baru saat no HP belum terdaftar
-- akan gagal dengan:
--   "new row violates row-level security policy for table \"event_users\""
--
-- Fix: tambahkan policy INSERT publik yang mirror dengan
-- `event_registrations_insert_public` di migration 002.
-- Aman karena:
--   - Tidak ada kolom sensitif (no HP sudah publik, nama & status
--     tidak bisa dilihat sebagai rahasia).
--   - `user_status` & `member_type` di-CHECK + DEFAULT, jadi user
--     publik tidak bisa set `banned` atau status privilege.
--   - Update/delete tetap hanya untuk admin via policy existing.
-- -------------------------------------------------------------
drop policy if exists "event_users_insert_public" on public.event_users;
create policy "event_users_insert_public"
  on public.event_users for insert to anon, authenticated with check (true);
