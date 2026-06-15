# 📘 Event Management System – Technical Specification

## 🧭 Overview

This application is a **web-based Event Management System** built using:

* Nuxt 3 (`^3.21.8`)
* Vue 3 (`^3.5.35`)
* TypeScript (strict mode)
* TailwindCSS
* Pinia
* Supabase (Auth + Database)
* Deployment: Vercel

---

## 🎯 Core Features

### Authentication

* Login (Email & Password)
* Register (Email & Password)
* Logout
* Session persistence

### Event Management

* Event listing
* Event detail page
* Event registration
* Registration cancellation
* Event attendance / check-in

### User Profile

* View profile
* Update profile (optional future enhancement)

---

# 🚨 Non-Negotiable Rules (MANDATORY)

## ❌ Strict Prohibitions

* No `any`
* No implicit typing
* No unsafe type assertions/casts
* No Supabase queries inside Vue components
* No business logic inside components
* No business logic inside stores
* No bypassing the repository layer
* No hardcoded company branding
* No direct database model usage in UI
* No direct usage of Supabase response objects in application layers
* **No `LoadingSpinner` or rotating spinners for page/section loading** — every loading state must use a Skeleton placeholder
* **No inline ad-hoc skeletons (raw `animate-pulse` divs) in pages** — always compose the existing `SkeletonBlock` / `SkeletonCard` / feature-specific skeleton components
* **No non-English comments anywhere in the codebase** — every comment (single-line `//`, block `/* */`, JSDoc, and HTML `<!-- -->` in `.vue` templates) must be written in **English only**. Indonesian (or any other language) is not allowed in code comments. The user-facing UI strings (labels, buttons, error messages) are excluded from this rule — only comments in source code must be English.

---

## ✅ Mandatory Requirements

* All data must be strongly typed
* Use `interface` or `type` everywhere
* All queries must go through repositories
* All business logic must be placed in use-cases
* Supabase responses must be mapped into domain models
* Use `unknown` where type is uncertain and perform proper narrowing
* Every list endpoint must support pagination
* All API responses must follow a standardized format
* All branding must be loaded from environment variables

---

# 🏢 Company Branding Configuration

All application branding must be configurable via environment variables.

---

## Environment Variables

```env
APP_NAME="Event Management System"
COMPANY_NAME="Your Company Name"

SUPABASE_URL=
SUPABASE_ANON_KEY=
```

---

## Runtime Configuration

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      appName: process.env.APP_NAME,
      companyName: process.env.COMPANY_NAME
    }
  }
})
```

---

## Branding Usage Rules

Must be used for:

* Header
* Footer
* Login page
* Register page
* Dashboard
* Browser title
* SEO metadata
* Email templates (future)

### Forbidden

```ts
const COMPANY_NAME = "My Company"
```

No hardcoded branding values anywhere.

---

# 🧠 Architecture

## Clean Architecture (Light Version)

```txt
/app
  /components
  /pages
  /layouts
  /middleware

/presentation
  /stores
  /composables

/application
  /use-cases

/domain
  /entities
  /repositories

/infrastructure
  /supabase
  /repositories
  /mappers

/types
/utils
```

---

# 🔄 Data Flow

Mandatory flow:

```txt
UI (Pages / Components)
    ↓
Pinia Store
    ↓
Use Case
    ↓
Repository Interface
    ↓
Repository Implementation
    ↓
Supabase Client
```

Any deviation is prohibited.

---

# 🎨 UI Component Architecture

## Component Structure

```txt
/app
  /components

    /ui
      Button.vue
      Input.vue
      Select.vue
      Textarea.vue
      Checkbox.vue
      Modal.vue
      Card.vue
      Badge.vue
      Table.vue
      Pagination.vue
      SkeletonBlock.vue
      SkeletonCard.vue
      EmptyState.vue
      ErrorState.vue
      FormField.vue

    /layout
      AppHeader.vue
      AppFooter.vue
      Sidebar.vue
      NavigationMenu.vue

    /event
      EventCard.vue
      EventList.vue
      EventDetail.vue
      EventRegistrationButton.vue

    /attendance
      AttendanceList.vue

    /auth
      LoginForm.vue
      RegisterForm.vue

    /profile
      ProfileCard.vue
```

---

## UI Components (`/components/ui`)

Reusable design system components.

Examples:

* Button
* Input
* Modal
* Table
* Pagination
* Badge
* Card

### Allowed

* Styling
* Rendering
* Typed props
* Typed emits

### Forbidden

* Business logic
* API calls
* Supabase access
* Repository access
* Use-case execution

---

## Feature Components

Examples:

```txt
/components/event
/components/auth
/components/profile
/components/attendance
```

Allowed:

* Compose UI components
* Receive typed props
* Emit typed events

Forbidden:

* Direct data fetching
* Business rules
* Supabase access

---

## Layout Components

```txt
/components/layout
```

Examples:

* Header
* Footer
* Sidebar
* Navigation

---

# 🧩 Component Standards

## Typed Props

Required:

```ts
interface Props {
  title: string
  eventId: string
}

const props = defineProps<Props>()
```

---

## Typed Emits

Required:

```ts
const emit = defineEmits<{
  register: [eventId: string]
}>()
```

---

## Script Rules

Required:

```vue
<script setup lang="ts">
</script>
```

Forbidden:

```vue
<script>
</script>
```

---

# 🔐 Authentication

## Provider

Supabase Auth

Authentication method:

* Email
* Password

---

## User Identity

Use:

```txt
auth.users.id
```

as the primary user identifier.

---

## Session

Managed automatically by Supabase.

Must support:

* Session persistence
* Auto refresh
* Protected routes

---

## Optional Profile Table

```sql
create table user_profiles (
  id uuid primary key,
  full_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);
```

---

# 📦 Domain Models

## Event

```ts
export interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  quota: number
  image: string
  status: 'Aktif' | 'Dibatalkan' | 'Selesai'
  // Optional reference to a master category. `null` means
  // "uncategorized". The category name is resolved at the
  // presentation layer via the category store; the domain only
  // carries the foreign key.
  categoryId: string | null
  createdAt: string
  updatedAt: string
}

export interface EventFormData {
  title: string
  date: string
  quota: number | string
  location: string
  image: string
  description: string
  // Use `''` in form state to mean "no category" so the Add/Edit
  // modal can keep a single `<select>` with a placeholder option.
  // Convert `''` to `null` when building the payload.
  categoryId: string | null
}
```

---

## Event Category (Master Kategori)

Master kategori kegiatan yang dipakai untuk mengelompokkan event.
ID format: `CAT-YYYY-NNNNN` (custom string ID sama dengan `USR-` dan
`REG-` agar konsisten dan mudah dibaca manual).

```ts
export interface EventCategory {
  id: string             // 'CAT-2026-00001'
  name: string           // unik, case-insensitive
  detail: string         // deskripsi singkat (boleh kosong)
  createdAt: string
  updatedAt: string
}

export interface EventCategoryFormData {
  name: string
  detail: string
}
```

- Tabel: `public.event_categories`
- Setiap event **boleh** punya satu category (FK nullable) atau
  `categoryId = null` (uncategorized).
- Sebuah category **tidak bisa dihapus** jika masih ada minimal satu
  event yang mereferensikannya — dijaga oleh FK constraint
  `ON DELETE RESTRICT` di level database.

---

## Event User (Master User Publik)

User publik yang pernah mendaftar di event manapun. Tidak butuh auth
— cukup no HP + nama. ID format: `USR-YYYY-NNNNN` (custom string ID
dengan tahun + 5 digit urut, agar mudah dibaca manual).

Status akun dan tipe keanggotaan ditambahkan oleh
[`supabase/migrations/004_event_users_extended.sql`](./supabase/migrations/004_event_users_extended.sql):

- `userStatus`: `'active'` (default) / `'inactive'` / `'banned'`
- `memberType`: `'internal'` (default) / `'external'`

```ts
export type UserStatus = 'active' | 'inactive' | 'banned'
export type MemberType = 'internal' | 'external'

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  banned: 'Diblokir',
}

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  internal: 'Internal',
  external: 'Eksternal',
}

export interface EventUser {
  id: string             // 'USR-2026-00001'
  noHp: string           // '08123456789' (normalized, awalan '0')
  nama: string
  userStatus: UserStatus
  memberType: MemberType
  createdAt: string
  updatedAt: string
}

export interface EventUserFormData {
  noHp: string
  nama: string
  userStatus: UserStatus
  memberType: MemberType
}
```

---

## Event Registration

Satu baris = satu user yang mendaftar di satu event. ID format:
`REG-YYYY-NNNNN`. Status lifecycle: `Terdaftar` → `Hadir` / `Tidak Hadir`.

```ts
export type RegistrationStatus = 'Terdaftar' | 'Hadir' | 'Tidak Hadir'

export interface Registration {
  id: string             // 'REG-2026-00001'
  userId: string         // FK -> event_users.id
  eventId: string        // FK -> events.id (uuid)
  status: RegistrationStatus
  checkinAt: string | null
  registeredAt: string
}

export interface RegistrationWithUser extends Registration {
  user: EventUser
}
```

---

## User Stats (akumulasi kehadiran)

```ts
export interface UserStats {
  totalRegistered: number  // pernah daftar di berapa event
  totalAttended: number    // hadir di berapa event
}
```

---

# 🗄️ Database Design

## events

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  location text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  capacity integer not null,
  created_at timestamptz default now()
);
```

---

## event_users

Master user publik (no auth). Tiap user yang pernah booking event
pasti punya 1 baris di sini — sehingga `noHp` bisa dipakai sebagai
key untuk autofill nama di form booking publik.

```sql
create table event_users (
  id text primary key,                    -- 'USR-2026-00001'
  no_hp text unique not null,             -- '08123456789' (normalized, awalan '0')
  nama text not null,
  user_status text not null default 'active'      -- 'active' | 'inactive' | 'banned'
    check (user_status in ('active', 'inactive', 'banned')),
  member_type text not null default 'internal'    -- 'internal' | 'external'
    check (member_type in ('internal', 'external')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_event_users_user_status on event_users(user_status);
create index idx_event_users_member_type on event_users(member_type);
```

`user_status` & `member_type` ditambah lewat migration
`004_event_users_extended.sql` — kolom lama di-backfill otomatis
dengan default `'active'` / `'internal'`, jadi tidak ada baris yang
kehilangan nilai setelah migrasi dijalankan.

---

## event_registrations

Satu baris = satu user × satu event. Custom string ID agar mudah
dibaca. Status di-toggle manual oleh admin lewat dashboard.

```sql
create type registration_status as enum ('Terdaftar', 'Hadir', 'Tidak Hadir');

create table event_registrations (
  id text primary key,                    -- 'REG-2026-00001'
  user_id text not null references event_users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  status registration_status not null default 'Terdaftar',
  checkin_at timestamptz,
  registered_at timestamptz default now(),

  unique(user_id, event_id)
);
```

Index untuk lookup cepat:

```sql
create index idx_event_registrations_event on event_registrations(event_id);
create index idx_event_registrations_user on event_registrations(user_id);
create index idx_event_registrations_status on event_registrations(status);
```

---

## event_categories

Master kategori kegiatan. Dipakai sebagai FK opsional dari
`events.category_id` agar event bisa dikelompokkan (misal:
"Sport", "Workshop", "Gathering").

```sql
create table event_categories (
  id         text primary key,                -- 'CAT-2026-00001'
  name       text not null unique,
  detail     text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_event_categories_name on event_categories (lower(name));
```

Kolom `events.category_id` (nullable, FK ke `event_categories.id`):

```sql
alter table events
  add column category_id text
    references event_categories(id) on delete restrict;
```

- `ON DELETE RESTRICT` (bukan `CASCADE` atau `SET NULL`): jika
  masih ada event yang mereferensikan sebuah category, category
  **tidak dapat dihapus** — error Postgres 23503 akan di-translate
  menjadi pesan yang ramah di layer repository.
- Tabel `event_categories` di-Reuse trigger `set_updated_at()` dari
  migration `001_events.sql` untuk auto-update kolom `updated_at`.

RLS policies:

```sql
-- Publik boleh baca
create policy event_categories_read_public
  on event_categories for select
  to anon, authenticated
  using (true);

-- Hanya authenticated (admin) yang boleh write
create policy event_categories_write_admin
  on event_categories for all
  to authenticated
  using (true) with check (true);
```

---

## event_attendance

*Deprecated.* Status kehadiran sudah di-collapse ke kolom `status`
di `event_registrations` (dengan `checkin_at` sebagai timestamp).
Tabel ini tidak dibuat — cukup enum + kolom di tabel registrasi.
```

---

# 🧠 Business Rules

## Event Rules

* Event capacity cannot be exceeded
* Capacity is calculated from registrations

---

## Registration Rules

* Satu user hanya bisa terdaftar 1× per event (constraint `unique(user_id, event_id)` di DB).
* Pendaftaran ditolak ketika kapasitas event penuh (dicek di use case `BookEvent` lewat `getSlotsTakenByEvent`).
* User yang sama dengan `noHp` berbeda tetap dianggap 1 user — normalisasi `noHp` jadi `08123456789` sebelum lookup.
* `checkin_at` di-set otomatis saat admin toggle status ke `Hadir`, dan di-reset ke `null` saat dikembalikan ke `Terdaftar`.
* User yang `Tidak Hadir` di-exclude dari counter slot terisi (lihat `getSlotsTakenByEvent` di registration store).

---

## Event Category Rules

* `name` wajib unik (constraint DB) — jika admin menyimpan nama yang
  sudah ada, repository melempar error ramah
  "A category with that name already exists." (Postgres error 23505).
* `name` minimal 2 karakter (divalidasi di use case `CreateEventCategory`
  dan `UpdateEventCategory`).
* `detail` boleh kosong (default `''`).
* Category **tidak bisa dihapus** jika minimal 1 event masih
  mereferensikannya. Aturan ini ditegakkan di DB lewat FK
  `ON DELETE RESTRICT`. Saat admin mencoba, repository
  menerjemahkan error Postgres 23503 (foreign_key_violation)
  menjadi:
  > Category is in use by one or more events. Reassign or delete
  > those events first.
* Event boleh `categoryId = null` (uncategorized) — FK nullable.
* Urutan list di UI selalu di-sort by `name` (case-insensitive) —
  `event-category` store punya helper `insertSorted()` yang
  mempertahankan urutan tersebut setelah mutasi lokal.
* Lookup `event.categoryId` → `category.name` di komponen publik
  (EventCard, event detail page, dashboard table) lewat getter
  `byId` di store (O(1) map).

---

## ID Generation Rules

* Format ID publik:
  - `USR-YYYY-NNNNN` untuk user,
  - `REG-YYYY-NNNNN` untuk registrasi,
  - `CAT-YYYY-NNNNN` untuk event category.
* Tipe union `IdPrefix = 'USR' | 'REG' | 'CAT'` di-export dari
  [`application/use-cases/generate-id.ts`](application/use-cases/generate-id.ts:24)
  — tambahkan prefix baru di sini kalau ada entitas baru.
* `YYYY` = tahun saat create (UTC), `NNNNN` = 5 digit urut (zero-padded).
* Generate via `generateUniqueId(prefix, exists)` di [`application/use-cases/generate-id.ts`](application/use-cases/generate-id.ts:24) — random 5 digit + retry sampai 10× kalau bentrok.
* Setelah ID terbentuk, suffix ditulis manual ke `users.id` / `registrations.id` (kita tidak pakai auto-increment/UUID untuk konsistensi format).
* Tabel **tidak** punya default Postgres — id dihasilkan di layer aplikasi agar bisa di-retry tanpa round-trip DB.

---

## Phone Number Normalization Rules

* Implementasi: [`normalizePhone(input)`](application/use-cases/normalize-phone.ts:10).
* Algoritma: strip semua karakter non-digit, jika prefix `62` → ganti ke `0`, sisa digit harus 10–15.
* Return `null` jika hasil normalisasi invalid (kirim error ke UI).
* Wajib dipanggil **sebelum** `findByPhone` / `create` di repository — supaya `08123456789` dan `+62 812-3456-789` dianggap user yang sama.
* Disimpan apa adanya di DB (format `0xxx`), tidak ditambah prefix `+62`.

---

## Attendance Rules

* Status pakai enum: `Terdaftar` | `Hadir` | `Tidak Hadir` (lihat [`types/registration-status.ts`](types/registration-status.ts)).
* Tidak ada tabel `event_attendance` terpisah — kehadiran adalah kolom `status` + `checkin_at` di `event_registrations`.
* Toggle kehadiran **hanya** lewat `EventParticipantsModal` di dashboard (admin only), tidak ada flow publik.
* Toggle ke `Hadir` ⇒ set `checkin_at = now()`; toggle ke `Terdaftar` ⇒ set `checkin_at = null`.

---

# 🧱 Application Layer

## Event Use Cases

* GetEvents
* GetEventById
* CreateEvent - `categoryId` opsional (`null` ⇒ uncategorized)
* UpdateEvent - `categoryId` opsional
* DeleteEvent
* UpdateEventStatus
* UploadEventImage

---

## Event Category Use Cases

* GetEventCategories - list semua category, di-sort by `name` (case-insensitive).
* GetEventCategoryById - lookup by id.
* CreateEventCategory - validasi `name.length >= 2`; ID di-generate via `generateUniqueId('CAT', …)`.
* UpdateEventCategory - validasi `name.length >= 2`.
* DeleteEventCategory - gagal dengan error ramah jika ada event yang mereferensikan (Postgres 23503 ⇒ 23503 ⇒ "Category is in use by one or more events...").

---

## Registration Use Cases

* FindUserByPhone - lookup user by noHp
* RegisterUser - create event_users row. Default `userStatus =
  'active'`, `memberType = 'internal'` (sesuai DEFAULT migration
  004). Caller boleh override dengan mengirim input lengkap.
* UpdateUser - update `nama`, `noHp`, `userStatus`, `memberType`.
  Normalisasi noHp lewat `normalizePhone`. Pesan error ramah untuk
  noHp konflik (`23505`) dan user tidak ditemukan (`PGRST116`).
* DeleteUser - hapus user. Relasi `event_registrations` ter-cascade.
* GetUserRegistrations - list event yang pernah diikuti user
  (joined `events`).
* BookEvent - register user and create registration
* GetEventRegistrations - list participants
* MarkAttendance - toggle status
* GetUserStats - count attendance per user
* GetUserAttendanceByCategory - statistik kehadiran per kategori
  event (di-filter `year` opsional).
* GetUserRegistrationYears - daftar tahun unik event yang pernah
  diikuti user, diurutkan descending.
* ListUsers - pagination + search server-side untuk halaman
  Master User di dashboard admin.

---

## Attendance Use Cases

* Attendance digabung ke MarkAttendance (mark-attendance.ts) - toggle status Hadir / Tidak Hadir / Terdaftar.

---

## Auth Use Cases

* LoginUser
* RegisterUser
* LogoutUser

---

# 🧩 Repository Layer

## Event Repository

```ts
export interface EventRepository {
  getAll(params: {
    page: number
    limit: number
  }): Promise<PaginatedResult<Event>>

  getById(id: string): Promise<Event | null>
  create(payload: EventFormData): Promise<Event>
  update(id: string, payload: EventFormData): Promise<Event>
  delete(id: string): Promise<void>
  updateStatus(id: string, status: EventStatusValue): Promise<Event>
  uploadImage(file: File): Promise<string>
  deleteImage(publicUrl: string): Promise<boolean>
}
```

`EventFormData.categoryId` adalah `string | null` — di
`create()` / `update()` akan diteruskan ke kolom `category_id` (TEXT,
nullable) di tabel `events`. Empty string di form state ⇒
`null` di payload.

---

## Event Category Repository

```ts
export interface EventCategoryRepository {
  list(): Promise<EventCategory[]>
  getById(id: string): Promise<EventCategory | null>
  create(input: EventCategoryFormData): Promise<EventCategory>
  update(id: string, input: EventCategoryFormData): Promise<EventCategory>
  delete(id: string): Promise<void>
}
```

Behavior repository:

* `list()` selalu mengembalikan data ter-sort by `name` (asc,
  case-insensitive).
* `create()` dan `update()` menerjemahkan Postgres error code
  `23505` (unique_violation) menjadi
  `Error('A category with that name already exists.')`.
* `delete()` menerjemahkan Postgres error code `23503`
  (foreign_key_violation, dari `ON DELETE RESTRICT` di
  `events.category_id`) menjadi
  `Error('Category is in use by one or more events. Reassign or delete those events first.')`.
* ID untuk `create()` di-generate via
  `generateUniqueId('CAT', exists)` (lihat
  [`application/use-cases/generate-id.ts`](application/use-cases/generate-id.ts:24))
  agar konsisten dengan `USR-` dan `REG-`.

---

## User Repository

```ts
export interface UserStats {
  totalRegistered: number
  totalAttended: number
}

/**
 * Statistik kehadiran satu user yang dikelompokkan per kategori event.
 * Tahun mengikuti `event.date` (bukan `registered_at`);
 * `year = null` artinya lifetime (semua tahun).
 */
export interface CategoryAttendanceStat {
  categoryId: string | null   // null = event tanpa kategori
  categoryName: string        // 'Tanpa Kategori' untuk categoryId null
  totalRegistered: number
  totalAttended: number
  attendanceRate: number      // 0-100, dibulatkan
}

export interface UserListParams {
  page: number
  limit: number
  search?: string
}

export interface UserRepository {
  findByPhone(noHp: string): Promise<EventUser | null>
  findById(id: string): Promise<EventUser | null>
  create(input: EventUserFormData): Promise<EventUser>
  update(id: string, input: EventUserFormData): Promise<EventUser>
  delete(id: string): Promise<void>
  getStats(id: string): Promise<UserStats>
  listUsers(params: UserListParams): Promise<PaginatedResult<EventUser>>
  getStatsByCategory(
    userId: string,
    year: number | null,
  ): Promise<CategoryAttendanceStat[]>
  getRegistrationYears(userId: string): Promise<number[]>
}
```

Behavior repository (SupabaseUserRepository):

* `create()` & `update()` menerjemahkan Postgres error `23505`
  (unique_violation) ke pesan Indonesia yang ramah (duplicate
  no_hp).
* `update()` menerjemahkan `PGRST116` (no row matches) ke
  `Error('User tidak ditemukan.')`.
* `delete()` mendeteksi baris yang tidak ada dengan
  `.delete().eq(...).select('id')` — jika `data.length === 0`,
  melempar `Error('User tidak ditemukan.')`. Relasi
  `event_registrations` ter-cascade, sehingga `delete()` juga
  membersihkan seluruh data kehadiran user.
* `getStatsByCategory(userId, year)` menarik registrasi user
  dengan join ke `events` + `event_categories`, lalu agregasi
  di app-layer (group by `categoryId`, hitung `totalRegistered`
  dan `totalAttended`, hitung `attendanceRate`).
  Event tanpa kategori dikelompokkan ke `(null, 'Tanpa Kategori')`.
  Filter tahun dilakukan di app-layer dengan membaca
  `event.date.getFullYear()`.
* `getRegistrationYears(userId)` menarik `event.date` dari
  registrasi user, lalu mengelompokkan tahun unik, diurutkan
  descending (terbaru dulu).

---

## Registration Repository

```ts
export interface RegistrationListParams {
  page: number
  limit: number
}

export interface RegistrationInput {
  userId: string
  eventId: string
}

export interface RegistrationRepository {
  getAll(params: RegistrationListParams): Promise<PaginatedResult<RegistrationWithUser>>
  getById(id: string): Promise<Registration | null>
  findByUserAndEvent(userId: string, eventId: string): Promise<Registration | null>
  create(input: RegistrationInput): Promise<Registration>
  updateStatus(id: string, status: RegistrationStatus, checkinAt: string | null): Promise<Registration>
  delete(id: string): Promise<void>
  countByEvent(eventId: string): Promise<number>
}
```

---

# 🧱 Infrastructure Layer

## Rules

All Supabase access must exist here only.

Allowed:

```txt
/infrastructure
  /supabase
  /repositories
  /mappers
```

Forbidden:

* Components
* Pages
* Stores
* Use-cases

---

# 🔄 Data Mapping Rules

Never expose Supabase rows directly.

Example:

```ts
interface EventRow {
  id: string
  title: string
  start_time: string
}
```

Map into:

```ts
interface Event {
  id: string
  title: string
  startTime: string
}
```

Using dedicated mappers.

---

# 📡 API Response Standards

All API responses must follow a consistent format.

---

## Single Resource

```ts
{
  data: T
}
```

Example:

```ts
{
  data: {
    id: "1",
    title: "Nuxt Meetup"
  }
}
```

---

## Collection Response

```ts
{
  data: T[],
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}
```

---

## Error Response

```ts
{
  error: {
    code: string
    message: string
  }
}
```

---

## Validation Error

```ts
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: Record<string, string[]>
  }
}
```

---

## HTTP Status Codes

Use proper status codes:

```txt
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity

500 Internal Server Error
```

---

# 📄 Pagination Standards

Mandatory for every list endpoint.

---

## Query Parameters

```http
GET /events?page=1&limit=10
```

---

## Defaults

```txt
page = 1
limit = 10
```

---

## Maximum Limit

```txt
limit <= 20
```

---

## Required For

* Event list
* Attendance list
* Registration list
* Future list endpoints

---

## Pagination Component

Mandatory:

```txt
/components/ui/Pagination.vue
```

Used everywhere pagination exists.

---

## Event Category Store

* State: `categories: EventCategory[]`, `isLoading`, `isSubmitting`, `error`.
* `isLoading` **default `false`** (bukan `true`) — di-override ke `true`
  hanya di halaman admin Categories yang memang menampilkan skeleton.
  Halaman publik (home, event detail) tidak boleh menampilkan
  skeleton untuk category dropdown.
* Getter: `byId: Record<string, EventCategory>` — O(1) lookup
  untuk EventCard / event detail / dashboard table supaya
  `event.categoryId` bisa di-resolve ke `name` tanpa scan.
* `fetchCategories()` **tidak wipe cache** saat error (pola
  yang sama dengan registration store) — `categories` lama tetap
  di state, `error` di-set, dan UI boleh render state terakhir
  yang valid.
* `createCategory()` / `updateCategory()` memanggil `insertSorted()`
  setelah mutasi supaya list tetap urut by `name` (asc, case-insensitive,
  pakai `localeCompare` dengan `sensitivity: 'base'`).
* `deleteCategory()` meneruskan error dari use case verbatim — UI
  menampilkan pesan "Category is in use by one or more events..."
  (Postgres 23503 translation) atau "A category with that name
  already exists." (23505) langsung ke admin.

---

# 🧠 Pinia Store Rules

Stores may:

* Hold state
* Call use-cases
* Manage loading state
* Manage pagination state

Stores may NOT:

* Query Supabase
* Execute business rules

---

# 🎨 UI Layer Rules

Allowed:

* Render UI
* Handle user interactions
* Trigger store actions

Forbidden:

* Business logic
* Validation logic
* Direct fetching
* Repository access

---

## ⏳ Loading State (Skeleton-only)

Every page and section that waits for asynchronous data (fetch, mutation,
revalidation) **must** render a Skeleton placeholder that mirrors the final
layout. Spinners / loading icons are prohibited for these scenarios.

### Required Skeleton Components

```txt
/components/ui
  SkeletonBlock.vue   ← primitive (variants: block, text, bar, pill, circle)
  SkeletonCard.vue    ← generic card-shaped skeleton

/components/dashboard
  DashboardKpiSkeleton.vue          ← 4 KPI cards (Ringkasan Dashboard)
  DashboardEventsTableSkeleton.vue  ← events table (Kelola Event)
```

Domain/feature pages may compose their own skeleton file inside the
appropriate feature folder (e.g. `components/dashboard/*Skeleton.vue`) using
`SkeletonBlock` as the only building block.

### When to show a skeleton

Show a skeleton when the corresponding `store.isLoading` (or any equivalent
`pending` flag) is `true`. Once data is available, swap to the real component
in the same `v-else` branch — do not keep the skeleton mounted.

### Rules

* Skeleton must **mirror the real layout** (columns, rows, paddings, icon
  positions) so the swap is visually stable and avoids layout shift.
* Use `bg-slate-200/70 animate-pulse` (already baked into `SkeletonBlock`) —
  do not invent new color tokens for skeleton.
* Buttons and isolated actions may still use `LoadingSpinner` semantics via
  button `loading` prop; the rule above applies to *page/section* loading.
* Every new page introduced to the app must come with a matching skeleton.

### Forbidden

* Spinner / rotating icon for whole-page or whole-section loading.
* Random pulsing divs in pages that bypass `SkeletonBlock`.
* Skeletons that don't match the real component dimensions.

---

# 🛡️ Middleware

## auth.global.ts

Protect:

* Dashboard
* Event registration
* Event attendance
* Profile pages

---

# 🎨 Styling Rules

## TailwindCSS

Required:

* Utility-first approach
* Responsive design
* Consistent spacing scale

Forbidden:

* Random inline styling
* Large page-specific CSS files

---

## Reusable UI Components

Must be placed in:

```txt
/components/ui
```

---

# 🚀 Deployment

## Platform

Vercel

---

## Environment Variables

```env
APP_NAME=
COMPANY_NAME=

SUPABASE_URL=
SUPABASE_ANON_KEY=
```

---

## Rendering Mode

Recommended:

```txt
SSR (Nuxt default)
```

---

# 🧪 Type Safety Rules

## Required

* TypeScript strict mode
* No `any`
* No unsafe casts
* Typed interfaces everywhere

---

## Unknown First Principle

When type is uncertain:

```ts
const data: unknown = await something()
```

Then narrow:

```ts
if (isEvent(data)) {
  // safe usage
}
```

---

# ⚡ Future Enhancements

* Role-based access control (Admin/User)
* QR Code Check-In
* Event approval workflow
* Email notification system
* Analytics dashboard
* Multi-tenant support
* Event categories
* Search & filtering
* Export attendance reports
* Audit logs

---

# 🧾 Final Architecture Rules (ONE-LINE VERSION)

* UI renders UI only
* Feature components compose UI components
* Stores manage state only
* Use-cases contain business logic
* Repositories handle data access
* Supabase exists only in infrastructure
* No `any`
* No implicit typing
* No direct Supabase access outside infrastructure
* No business logic in components
* No `LoadingSpinner` for page/section loading — Skeleton is the only allowed loading UX
* All list endpoints must support pagination
* All API responses must follow a standard format
* All reusable UI components belong in `/components/ui`
* All branding comes from environment variables
* Supabase responses must be mapped to domain models
* Strict TypeScript everywhere
* Clean Architecture must be respected at all times
* Any architecture violation should be treated as a bug, not a shortcut.
* All code comments must be written in English (no Indonesian or other languages).
