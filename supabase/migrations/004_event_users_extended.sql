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
