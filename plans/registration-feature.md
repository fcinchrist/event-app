# Plan: Master User + Event Registrations + Attendance

## Tujuan

Membuat sistem booking online end-to-end untuk halaman event publik:
- Tabel `event_users` (master user) — id `USR-xxxxx`, no_hp unik, nama
- Tabel `event_registrations` — mapping `USR-xxxxx` ↔ `EVT-xxxxx` + status kehadiran
- Halaman `/event/[id]` (publik) jadi bisa booking dengan autofill nama dari no HP
- Dashboard admin bisa toggle status kehadiran peserta per event
- KPI dashboard: hitung reservasi & kehadiran dari tabel baru (bukan `appStore.bookings`)

## Konfirmasi User (sudah disetujui)

| Topik | Keputusan |
|---|---|
| Format ID user | Custom string `USR-YYYY-NNNNN` (mis. `USR-2026-00001`) — tahun + 5 digit urut |
| Format ID registration | `REG-YYYY-NNNNN` (mis. `REG-2026-00001`) — tahun + 5 digit urut |
| Status kehadiran | Kolom `status` enum di `event_registrations` (best practice, no tabel terpisah) |
| Autofill nama | Saat `no_hp` di-blur / debounce 600ms → lookup ke `event_users` |
| Booking/attendance sebelumnya di localStorage | Dihapus (sudah selesai di task sebelumnya) |

---

## Tahap 1: Database (Supabase)

### 1.1 Migration baru `supabase/migrations/002_event_users_and_registrations.sql`

```sql
-- =============================================================
-- Event Management System – Migration #2
-- Master user + registrations + attendance flag
-- =============================================================

-- -------------------------------------------------------------
-- 1. TABLE: event_users (master user publik, TANPA auth)
-- -------------------------------------------------------------
create table if not exists public.event_users (
  id          text primary key,                     -- 'USR-xxxxx'
  no_hp       text not null unique,                 -- '+628123456789' atau '08123456789'
  nama        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_event_users_no_hp on public.event_users (no_hp);

-- Trigger auto-update updated_at (reuse function dari migration 001)
drop trigger if exists trg_event_users_updated_at on public.event_users;
create trigger trg_event_users_updated_at
  before update on public.event_users
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 2. TABLE: event_registrations (mapping USR ↔ EVT)
-- -------------------------------------------------------------
create table if not exists public.event_registrations (
  id            text primary key,                   -- 'REG-xxxxx'
  user_id       text not null references public.event_users(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  status        text not null default 'Terdaftar'
                check (status in ('Terdaftar', 'Hadir', 'Tidak Hadir')),
  checkin_at    timestamptz,
  registered_at timestamptz not null default now(),
  unique (user_id, event_id)                        -- satu user 1x per event
);
create index if not exists idx_reg_event   on public.event_registrations (event_id);
create index if not exists idx_reg_user    on public.event_registrations (user_id);
create index if not exists idx_reg_status  on public.event_registrations (status);

-- RLS: publik boleh baca, hanya authenticated (admin) yang boleh write
alter table public.event_users enable row level security;
alter table public.event_registrations enable row level security;

drop policy if exists "event_users_read_public" on public.event_users;
create policy "event_users_read_public"
  on public.event_users for select to anon, authenticated using (true);

drop policy if exists "event_users_write_admin" on public.event_users;
create policy "event_users_write_admin"
  on public.event_users for all to authenticated using (true) with check (true);

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
```

**Catatan**:
- `event_users.id` = text (custom), generator di repository layer.
- `event_registrations.id` = text (custom), generator di repository layer.
- `event_registrations.event_id` = uuid (sama dengan `events.id`).
- Insert publik untuk `event_registrations` (anon) → user bisa daftar tanpa login.

---

## Tahap 2: Domain Layer

### 2.1 `domain/entities/event-user.ts` (baru)

```ts
export interface EventUser {
  id: string          // 'USR-xxxxx'
  noHp: string        // normalized: '08123456789' (digits only, tanpa +)
  nama: string
  createdAt: string
  updatedAt: string
}

export interface EventUserFormData {
  noHp: string
  nama: string
}
```

### 2.2 `domain/entities/registration.ts` (baru)

```ts
export type RegistrationStatus = 'Terdaftar' | 'Hadir' | 'Tidak Hadir'

export interface Registration {
  id: string
  userId: string
  eventId: string
  status: RegistrationStatus
  checkinAt: string | null
  registeredAt: string
  // hydrated untuk UI:
  user?: EventUser
}

export interface RegistrationWithUser extends Registration {
  user: EventUser
}
```

### 2.3 `domain/repositories/user-repository.ts` (baru)

```ts
export interface UserRepository {
  findByPhone(noHp: string): Promise<EventUser | null>
  findById(id: string): Promise<EventUser | null>
  create(input: EventUserFormData): Promise<EventUser>
  getStats(id: string): Promise<{ totalRegistered: number; totalAttended: number }>
}
```

### 2.4 `domain/repositories/registration-repository.ts` (baru)

```ts
export interface RegistrationListParams {
  eventId?: string
  userId?: string
  status?: RegistrationStatus
}

export interface RegistrationRepository {
  getAll(params?: RegistrationListParams): Promise<RegistrationWithUser[]>
  getById(id: string): Promise<Registration | null>
  findByUserAndEvent(userId: string, eventId: string): Promise<Registration | null>
  create(input: { userId: string; eventId: string }): Promise<Registration>
  updateStatus(id: string, status: RegistrationStatus): Promise<Registration>
  delete(id: string): Promise<void>
  countByEvent(eventId: string): Promise<number>
}
```

---

## Tahap 3: Application Layer (Use Cases)

### 3.1 `application/use-cases/normalize-phone.ts` (helper)

```ts
// Ubah '08123...' / '+62 812...' → '08123456789' (digits only, awalan 0)
// Validasi: hanya digit, panjang 10-15
```

### 3.2 `application/use-cases/generate-id.ts` (helper)

```ts
// generateUserId() → 'USR-2026-NNNNN' (tahun + 5 digit urut per tahun)
// generateRegistrationId() → 'REG-2026-NNNNN'
// Retry 5x kalau collision. Sequence di-reset tiap tahun baru.
// Optional: ambil count(year) dari DB untuk sequence yang kontigu (mis. 00001 → 00002).
// Default: pakai random 5 digit dalam range 10000-99999 (probabilitas collision ~rendah untuk 1 tahun).
```

### 3.3 Use case baru

- `application/use-cases/find-user-by-phone.ts` → lookup by no_hp
- `application/use-cases/register-user.ts` → buat user baru (kalau belum ada) + buat registration
- `application/use-cases/book-event.ts` → **ORKESTRATOR**: 
  1. normalize no_hp
  2. cek existing user by phone
  3. kalau belum ada → create user
  4. cek existing registration (userId, eventId)
  5. kalau sudah ada → throw "Sudah terdaftar"
  6. create registration baru
- `application/use-cases/get-event-registrations.ts` → ambil list peserta 1 event (untuk dashboard)
- `application/use-cases/mark-attendance.ts` → update status 'Terdaftar' → 'Hadir'/'Tidak Hadir', set checkin_at
- `application/use-cases/get-user-stats.ts` → totalRegistered & totalAttended untuk master user

---

## Tahap 4: Infrastructure Layer

### 4.1 `infrastructure/mappers/user-mapper.ts` (baru)

`mapUserRow(row)` + `UserRow` interface (snake_case → camelCase).

### 4.2 `infrastructure/mappers/registration-mapper.ts` (baru)

`mapRegistrationRow(row)` + `RegistrationRow` interface. Untuk `RegistrationWithUser` akan di-join via Supabase `.select('*, user:event_users(*)')`.

### 4.3 `infrastructure/repositories/supabase-user-repository.ts` (baru)

Implementasi `UserRepository`:
- `findByPhone` → `.from('event_users').select('*').eq('no_hp', normalized).maybeSingle()`
- `create` → generate id via helper, insert
- `getStats` → 2 query: count by user_id di registrations (group by status) — atau 1 query RPC

### 4.4 `infrastructure/repositories/supabase-registration-repository.ts` (baru)

Implementasi `RegistrationRepository`:
- `getAll({ eventId })` → `.from('event_registrations').select('*, user:event_users(*)').eq('event_id', eventId).order('registered_at', desc)`
- `findByUserAndEvent` → unique constraint check
- `create` → generate id
- `updateStatus` → patch status + checkin_at (jika Hadir)

---

## Tahap 5: Presentation Layer (Store + Composables)

### 5.1 `presentation/stores/registration.ts` (baru, atau extend `appStore`)

State:
```ts
interface RegistrationState {
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  participantsByEvent: Record<string, RegistrationWithUser[]>
}
```

Actions:
- `registerForEvent({ eventId, noHp, nama })` → panggil `BookEvent` use case
- `findUserByPhone(noHp)` → debounce-aware lookup (langsung return null kalau noHp invalid)
- `fetchParticipants(eventId)` → ambil list peserta
- `markAttendance(registrationId, status)` → update status
- `cancelRegistration(registrationId)` → delete

### 5.2 `presentation/stores/app.ts` — update

Ganti yang lama: hapus `bookings: []` + method no-op, ganti dengan delegasi ke registrationStore.

### 5.3 `pages/dashboard/index.vue` — KPI source

Ganti `appStore.bookings` → `useRegistrationStore().getAllForStats()` atau langsung fetch dari repository di onMounted. KPI: `totalReservations` & `presentCount` dihitung dari `RegistrationWithUser`.

---

## Tahap 6: UI Layer

### 6.1 `components/event/EventBookingForm.vue` (rewrite)

- Tambah field `no_hp` (wajib, tel)
- Saat blur / debounce 600ms → `registrationStore.findUserByPhone(noHp)` 
  - kalau ketemu → auto-fill field nama (readonly + tampilkan "👋 Hai, [Nama]")
  - kalau tidak → field nama editable
- Tombol "Daftar Sekarang" → `registrationStore.registerForEvent({...})`
- Validasi: noHp min 10 digit, nama min 2 char
- Tampilkan status event: penuh / sudah lewat / buka
- Disable button kalau user sudah terdaftar di event ini (cek via `findByUserAndEvent` setelah noHp blur)

### 6.2 `pages/event/[id].vue` — booking

- `onMounted` → `registrationStore.fetchParticipants(eventId)` (untuk ParticipantList)
- Tampilkan ringkasan: "X/Y slot terisi, Z sudah hadir"

### 6.3 `components/attendance/ParticipantList.vue` (rewrite untuk publik)

- Tampilkan list peserta yang sudah daftar (nama + status)
- Source: `registrationStore.participantsByEvent[eventId]`
- Empty state: "Belum ada peserta yang mendaftar"

### 6.4 `components/attendance/AttendanceForm.vue` — publik

- Hapus, atau ganti jadi info: "Check-in dilakukan oleh panitia di lokasi"
- (Sudah dilakukan di task sebelumnya)

### 6.5 `components/dashboard/EventParticipantsModal.vue` (baru)

- Dipakai dari `pages/dashboard/events.vue` (tombol baru di setiap row: "Lihat Peserta")
- List peserta + toggle status per baris (Hadir / Tidak Hadir / Terdaftar)
- Counter ringkasan di header (X Terdaftar, Y Hadir, Z Tidak Hadir)

### 6.6 `pages/dashboard/events.vue` — tambah kolom/aksi

- Tambah tombol icon `fa-users` di kolom Aksi → buka `EventParticipantsModal`
- Tambah counter "X/Y terdaftar" di tiap row event

### 6.7 `pages/dashboard/index.vue` — KPI

- Sumber data: `registrationStore` (bukan `appStore.bookings` lagi)
- Computed `kpi.totalReservations` = sum registrations
- Computed `kpi.presentCount` = filter status 'Hadir'

---

## Tahap 7: Skeleton loading (sesuai panduan helper.md)

- `RegistrationListSkeleton` (5 rows) — untuk ParticipantList
- `EventParticipantsSkeleton` (5 rows dengan toggle) — untuk modal
- Empty state di semua list (sudah ada polanya di EventsTableSkeleton & DashboardKpiSkeleton)

---

## Tahap 8: Helper.md updates

Tambah section:
- "## Entity & Schema Baru" — `event_users`, `event_registrations`
- "## Use Case Baru" — list di atas
- "## Repository Baru" — list di atas
- Update "## Database Design" dengan 2 tabel baru
- Update "## Business Rules" — 1 user 1x per event, no HP unik, dsb
- Update "## Skeleton Components" — tambah 2 skeleton baru

---

## File yang akan dibuat / diubah

**Baru (15 file):**
```
supabase/migrations/002_event_users_and_registrations.sql
domain/entities/event-user.ts
domain/entities/registration.ts
domain/repositories/user-repository.ts
domain/repositories/registration-repository.ts
application/use-cases/normalize-phone.ts
application/use-cases/generate-id.ts
application/use-cases/find-user-by-phone.ts
application/use-cases/book-event.ts
application/use-cases/register-user.ts
application/use-cases/get-event-registrations.ts
application/use-cases/mark-attendance.ts
application/use-cases/get-user-stats.ts
infrastructure/mappers/user-mapper.ts
infrastructure/mappers/registration-mapper.ts
infrastructure/repositories/supabase-user-repository.ts
infrastructure/repositories/supabase-registration-repository.ts
presentation/stores/registration.ts
components/dashboard/EventParticipantsModal.vue
components/dashboard/EventParticipantsSkeleton.vue
components/attendance/RegistrationListSkeleton.vue
```

**Diubah (6 file):**
```
types/common.ts                                  # tambah RegistrationStatus type
presentation/stores/app.ts                       # hapus bookings no-op, delegasi
pages/event/[id].vue                             # integrasi booking form baru
components/event/EventBookingForm.vue            # rewrite form dengan autofill
components/attendance/ParticipantList.vue        # sumber data baru
pages/dashboard/events.vue                       # tambah tombol peserta + counter
pages/dashboard/index.vue                        # KPI sumber baru
helper.md                                        # dokumentasi
```

**Estimasi kompleksitas**: Besar (sekitar 20+ file, 2 tabel DB baru, 7 use case, 2 store, 4 komponen).

---

## Pertanyaan terbuka yang TIDAK perlu dijawab (saya pilih default yang aman)

1. **Auto-register kalau noHp ada di DB tapi nama input beda**: Pakai nama dari DB (display "👋 Hai, [nama dari DB]"), abaikan input user. (user akan lihat ini di console untuk debug).
2. **Normalisasi no HP**: Selalu convert ke format `0xxxxxxxxx` (diawali 0, tanpa +). Validasi: 10-15 digit.
3. **ID generator**: `'USR-' + Math.floor(10000 + Math.random() * 90000)` — retry 5x kalau collision (kemungkinan kecil, 90.000 kombinasi).
4. **CORS / public insert registrations**: Insert publik dibolehkan (RLS policy `event_registrations_insert_public` untuk `anon`). Aman karena data user + registrasi = data publik low-sensitivity.
5. **Soft-delete atau hard-delete registration**: Hard-delete (RLS policy sudah diset).
6. **Apakah ada batasan pendaftaran satu user per event**: Ya (`unique (user_id, event_id)` di DB + cek di use case).

Kalau ada yang ingin Anda ubah dari default di atas, kasih tahu sebelum saya mulai coding.
