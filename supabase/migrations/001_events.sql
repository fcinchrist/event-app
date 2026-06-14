-- =============================================================
-- Event Management System – Database Migration
-- =============================================================
-- Jalankan migration ini di Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql
--
-- CATATAN:
-- - Schema diselaraskan dengan `domain/entities/event.ts` agar
--   repository layer tidak perlu mapping tambahan.
-- - Storage bucket `event-images` WAJIB dibuat secara manual
--   (lihat blok SQL di bagian bawah) agar fitur upload bekerja.
-- - Kolom `status` digunakan untuk menandai event sebagai
--   "Aktif" (default), "Dibatalkan", atau "Selesai" tanpa
--   harus menghapus data.
-- =============================================================


-- -------------------------------------------------------------
-- 1. TABLE: events
-- -------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null default '',
  date        timestamptz not null,
  location    text        not null,
  quota       integer     not null check (quota > 0),
  image       text        not null default '',
  status      text        not null default 'Aktif'
                          check (status in ('Aktif', 'Dibatalkan', 'Selesai')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_events_date        on public.events (date);
create index if not exists idx_events_created_at  on public.events (created_at desc);
create index if not exists idx_events_status      on public.events (status);


-- -------------------------------------------------------------
-- 2. AUTO-UPDATE updated_at
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();


-- -------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------
alter table public.events enable row level security;

-- Semua orang boleh membaca daftar event (publik)
drop policy if exists "events_read_public" on public.events;
create policy "events_read_public"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- Hanya admin (authenticated) yang boleh insert / update / delete
drop policy if exists "events_write_admin" on public.events;
create policy "events_write_admin"
  on public.events
  for all
  to authenticated
  using (true)
  with check (true);


-- -------------------------------------------------------------
-- 4. STORAGE BUCKET: event-images
-- -------------------------------------------------------------
-- Bucket ini menyimpan poster / cover event hasil upload.
-- File akan di-compress ke WebP di sisi client sebelum upload
-- untuk menghemat storage (Supabase free tier: 1 GB).
--
-- Jalankan satu per satu (Supabase tidak mengizinkan IF NOT EXISTS
-- untuk bucket pada semua versi):

-- insert into storage.buckets (id, name, public)
-- values ('event-images', 'event-images', true)
-- on conflict (id) do nothing;

-- Drop policy lama agar idempotent
-- drop policy if exists "event_images_read_public"   on storage.objects;
-- drop policy if exists "event_images_insert_admin"   on storage.objects;
-- drop policy if exists "event_images_update_admin"   on storage.objects;
-- drop policy if exists "event_images_delete_admin"   on storage.objects;

-- create policy "event_images_read_public"
--   on storage.objects
--   for select
--   to anon, authenticated
--   using (bucket_id = 'event-images');

-- create policy "event_images_insert_admin"
--   on storage.objects
--   for insert
--   to authenticated
--   with check (bucket_id = 'event-images');

-- create policy "event_images_update_admin"
--   on storage.objects
--   for update
--   to authenticated
--   using (bucket_id = 'event-images');

-- create policy "event_images_delete_admin"
--   on storage.objects
--   for delete
--   to authenticated
--   using (bucket_id = 'event-images');
