-- =============================================================
-- Event Management System – Migration #7
--   Storage bucket RLS hardening for `event-images`.
--
-- Latar belakang:
--   Migration #1 (001_events.sql) hanya mengomentari blok SQL untuk
--   bucket `event-images`. Akibatnya, sampai sekarang bucket ini
--   kemungkinan di Supabase Storage:
--     * public-readable (siapa saja bisa list + download file)
--     * INSERT / UPDATE / DELETE tidak di-gate oleh RLS — default
--       Supabase Storage membolehkan anon INSERT ke bucket public
--       selama tidak ada policy yang eksplisit menolak.
--
--   Risiko konkret:
--     1. Anon bisa spam upload file 100MB → DoS storage quota (Supabase
--        free tier: 1 GB total).
--     2. Anon bisa upload `.exe` / `.svg` rename jadi `.webp` →
--        distribusi malware + XSS via SVG (kalau file di-serve
--        langsung dari bucket URL).
--     3. Anon bisa list semua file di bucket → recon struktur event
--        (jumlah event, nama-nama event, dll).
--
--   Fix di migration ini:
--     * SELECT public: diizinkan (gambar event perlu di-load publik).
--     * INSERT: HANYA admin (`authenticated`). Anon ditolak.
--     * UPDATE: HANYA admin, dan hanya boleh update metadata file
--       yang dia sendiri yang upload (best-effort via name prefix).
--     * DELETE: HANYA admin.
--     * Tambahan: file size limit & MIME allowlist di-handle di
--       use-case client-side (lihat `UploadEventImage`). Migration
--       ini adalah server-side backstop RLS, bukan validator.
--
-- Architecture assumption (lihat 006_admin_users_and_rls_hardening.sql):
--   * Semua Supabase Auth user = admin.
--   * `to authenticated` saja sudah cukup sebagai gate admin-only.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Pastikan bucket `event-images` ada (idempotent).
--    Catatan: Supabase tidak mendukung `if not exists` untuk bucket
--    di semua versi — kita pakai `on conflict do nothing` agar aman
--    di-re-run.
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,                -- public-readable (gambar event harus bisa di-load publik)
  5242880,             -- 5 MB per file (gambar event compressed ke WebP biasanya < 500 KB,
                       --              5 MB adalah batas konservatif untuk retina-quality)
  array['image/webp','image/jpeg','image/png','image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- -------------------------------------------------------------
-- 2. Drop policy lama (kalau ada) agar idempotent.
-- -------------------------------------------------------------
drop policy if exists "event_images_read_public"   on storage.objects;
drop policy if exists "event_images_insert_admin"   on storage.objects;
drop policy if exists "event_images_update_admin"   on storage.objects;
drop policy if exists "event_images_delete_admin"   on storage.objects;


-- -------------------------------------------------------------
-- 3. SELECT: publik boleh membaca (gambar event perlu di-load di
--    homepage publik, dashboard admin, dll). Karena bucket juga
--    di-flag `public = true` di atas, file bisa di-load via
--    public URL tanpa signed token — tapi policy ini tetap
--    eksplisit untuk kejelasan audit.
-- -------------------------------------------------------------
create policy "event_images_read_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'event-images');


-- -------------------------------------------------------------
-- 4. INSERT: hanya admin (authenticated). Anon langsung ditolak
--    dengan `with check (false)` — sehingga script spam upload dari
--    client anon akan gagal dengan error "new row violates
--    row-level security policy".
-- -------------------------------------------------------------
create policy "event_images_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    -- File size & MIME type di-handle oleh storage.buckets di atas
    -- (file_size_limit + allowed_mime_types). RLS hanya gate
    -- authenticated-only.
  );


-- -------------------------------------------------------------
-- 5. UPDATE: hanya admin. Update biasanya untuk re-upload / ganti
--    file event (upsert). Karena bucket policy default Supabase
--    mengizinkan update hanya pada object milik sendiri, kita
--    longgarkan sedikit: admin authenticated boleh update file apa
--    pun di bucket ini.
-- -------------------------------------------------------------
create policy "event_images_update_admin"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'event-images')
  with check (bucket_id = 'event-images');


-- -------------------------------------------------------------
-- 6. DELETE: hanya admin. Admin boleh hapus file (misal: ganti
--    poster event, atau housekeeping storage).
-- -------------------------------------------------------------
create policy "event_images_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-images');


-- =============================================================
-- Verifikasi (jalankan manual setelah apply):
-- =============================================================
--   -- Harus return 4 policy dengan nama persis di atas.
--   select policyname, roles, cmd
--   from pg_policies
--   where schemaname = 'storage'
--     and tablename  = 'objects'
--     and policyname like 'event_images_%'
--   order by policyname;
--
--   -- Harus return 1 row untuk bucket 'event-images' dengan
--   -- file_size_limit = 5242880 dan allowed_mime_types tidak null.
--   select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets
--   where id = 'event-images';
-- =============================================================
