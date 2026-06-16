-- =============================================================
-- Event Management System – Migration #5
-- Add "verified by" tracking on event_registrations
--
-- Run this in the Supabase SQL Editor:
--   https://app.supabase.com/project/_/sql
--
-- Notes:
-- - Every time an admin/organizer performs attendance verification
--   (Hadir / Tidak Hadir) from the dashboard, we record:
--     * `verified_by_email` : email of the admin who clicked the button
--     * `verified_at`       : timestamp of the verification
--   Purpose: a simple audit trail (who marked whom, and when).
-- - For initial registrations (default status 'Terdaftar') both
--   columns stay NULL — the participant is registered but not yet
--   verified.
-- - `verified_by_email` is stored as TEXT (not a FK to auth.users) so:
--     * It does not add coupling to an auth schema that may change.
--     * It can be filled directly from the Supabase session.
--     * It stays human-readable for audit ("who" performed the check-in).
-- - DEFAULT NULL on both columns so existing rows do not need to be
--   backfilled (they have no history of who verified them).
-- - No RLS changes — the `event_registrations_update_admin` policy
--   from migration 002 already covers UPDATE for authenticated users.
-- =============================================================


-- -------------------------------------------------------------
-- 1. ADD COLUMNS (idempotent)
-- -------------------------------------------------------------
alter table public.event_registrations
  add column if not exists verified_by_email text;

alter table public.event_registrations
  add column if not exists verified_at timestamptz;


-- -------------------------------------------------------------
-- 2. INDEX
-- -------------------------------------------------------------
-- Index on verified_by_email helps audit queries
-- ("who checked in participants this week?"). Volume is small at
-- the start, but there is no harm in adding it.
create index if not exists idx_reg_verified_by_email
  on public.event_registrations (verified_by_email);

create index if not exists idx_reg_verified_at
  on public.event_registrations (verified_at);
