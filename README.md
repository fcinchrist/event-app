# Event Management System

A full-stack event management platform built with **Nuxt 3**, **Vue 3**, **Pinia**, **Tailwind CSS**, and **Supabase**. It lets a community publish upcoming events, lets the public reserve seats with just a phone number, and gives admins a dashboard to manage events, track participants, and mark attendance.

> **Status:** Active development. See [`SUMMARY.md`](./SUMMARY.md) and [`SUMMARY-DASHBOARD.md`](./SUMMARY-DASHBOARD.md) for the latest changelog.

---

## ✨ Features

### Public (no login required)
- 📅 **Event listings** with filtering (All / Upcoming / Today / Past / Custom date) and server-paginated grid of event cards.
- 🎟️ **One-tap reservation** — submit a phone number to register; the form auto-fills the user's name if they've booked before.
- 🔢 **Live occupancy badge** on every event card ("X / Y Terisi") without a heavy database JOIN.
- 📱 **Mobile-first drawer** navigation with a single hamburger + drawer shared by every page.

### Admin (Supabase Auth)
- 🔐 **Email/password login** with a dedicated `/admin/login` page and a password-reset flow.
- 📊 **Dashboard** with KPIs (total events, total reservations, attendance rate), an occupancy list of the top 5 events, and a recent activity feed.
- 🗓️ **Event management** — create, edit, and soft-cancel events; upload cover images; set quota and status; tag every event with an optional category.
- 🏷️ **Master kategori** — manage the reusable list of event categories (Sport, Workshop, Gathering, etc.) from `/dashboard/categories`. A category cannot be deleted while at least one event still references it.
- 👥 **Master user** list with per-user event history and reservation counts. Admins can create, edit, and delete users directly from the dashboard, and every user carries a `user_status` (`active` / `inactive` / `banned`) and `member_type` (`internal` / `external`).
- 📊 **Per-category attendance** on the user detail page — see which event categories a user attends most, filterable by year.
- ✅ **Attendance tracking** — open an event, see all registered users, and toggle each one's status between `Terdaftar` ↔ `Hadir` ↔ `Tidak Hadir`.

---

## 🧱 Tech Stack

| Layer            | Technology                                          |
| ---------------- | --------------------------------------------------- |
| Framework        | [Nuxt 3](https://nuxt.com) (Vue 3, TypeScript)      |
| State Management | [Pinia](https://pinia.vuejs.org)                    |
| Styling          | [Tailwind CSS](https://tailwindcss.com) + Font Awesome 6 |
| Backend / DB     | [Supabase](https://supabase.com) (Postgres + Auth + RLS) |
| Auth             | `@supabase/ssr` (cookie-based, SSR-aware)           |
| Architecture     | Clean / Hexagonal (Domain ↔ Application ↔ Infrastructure ↔ Presentation) |

The codebase follows a strict layered architecture so the domain has **zero** framework or infrastructure dependencies — every external concern is hidden behind a `*Repository` interface.

---

## 📁 Project Structure

```
event-web/
├── application/              # Use cases (orchestrate domain + repositories)
│   └── use-cases/
│       ├── book-event.ts
│       ├── get-event-registrations.ts
│       ├── get-event-registrations-count.ts   # NEW: lightweight counter
│       ├── login-user.ts
│       ├── mark-attendance.ts
│       └── ...
│
├── domain/                   # Pure domain model — no Nuxt, no Supabase
│   ├── entities/             # Event, EventCategory, EventUser, Registration
│   └── repositories/         # Interfaces only
│
├── infrastructure/           # Adapters to the outside world
│   ├── mappers/              # snake_case row → camelCase entity
│   ├── repositories/         # Supabase implementations of domain interfaces
│   └── supabase/             # Server + client Supabase factories
│
├── presentation/             # UI-facing layer
│   ├── composables/          # e.g. useMobileNav (singleton drawer state)
│   └── stores/               # Pinia stores (app, registration, user)
│
├── components/               # Reusable Vue components
│   ├── attendance/
│   ├── auth/
│   ├── dashboard/            # KPI cards, occupancy list, modals
│   ├── event/                # EventCard, EventHeroBanner, EventFilter, …
│   ├── layout/               # AppHeader, AppFooter
│   ├── profile/
│   └── ui/                   # Generic primitives (Button, Modal, Skeleton)
│
├── pages/                    # File-based routing
│   ├── index.vue             # Public event list (home)
│   ├── admin/                # login, forgot-password, reset-password
│   ├── event/[id].vue        # Public event detail + booking form
│   └── dashboard/            # Protected (auth middleware)
│       ├── index.vue
│       ├── events.vue
│       ├── categories.vue
│       └── users/
│
├── layouts/
│   └── default.vue           # Header + footer + global mobile drawer
│
├── middleware/
│   └── auth.ts               # Redirects unauthenticated admins to /admin/login
│
├── plugins/
│   ├── supabase.client.ts
│   └── supabase.server.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_events.sql
│       ├── 002_event_users_and_registrations.sql
│       ├── 003_event_categories.sql
│       └── 004_event_users_extended.sql
│
├── types/                    # Cross-cutting TypeScript types
├── assets/                   # Global CSS, fonts
└── public/                   # Static files (favicon, robots.txt)
```

---

## 🏛️ Architecture: Why Four Layers?

The codebase is organized as a **hexagonal / clean architecture** to keep the domain model pure and testable.

```
┌───────────────────────────────────────────────────────┐
│  Presentation (Vue/Pinia)                             │
│   ↕ uses                                              │
│  Application (use cases)                              │
│   ↕ uses                                              │
│  Domain (entities + repository interfaces)  ← pure   │
│   ↕ implemented by                                    │
│  Infrastructure (Supabase, mappers)                   │
└───────────────────────────────────────────────────────┘
```

**Rules of thumb:**

- **Domain** has zero imports from `nuxt`, `vue`, `pinia`, or `@supabase/*`. It only defines *what* the system is.
- **Application** holds the *behaviors* (`BookEvent`, `MarkAttendance`, `LoginUser`) — they orchestrate domain entities through repository interfaces.
- **Infrastructure** contains the only code that knows about Supabase, fetch APIs, or row shapes. Every row-to-entity conversion goes through a `*mapper.ts`.
- **Presentation** is the only place that touches Vue, Pinia, and the DOM. Stores expose use cases to components and own client-side caching.

This separation means swapping Supabase for a different backend would only require rewriting the `infrastructure/repositories/` layer — the use cases and UI stay untouched.

---

## 🗄️ Data Model

Four tables (defined in [`supabase/migrations/`](./supabase/migrations/)):

| Table                  | Purpose                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `events`               | Title, description, date, location, quota, image, status, **category** |
| `event_categories`     | Master list of activity categories (Sport, Workshop, Gathering, etc.)  |
| `event_users`          | Master user list keyed by normalized phone number (no auth)            |
| `event_registrations`  | Junction: `(user_id, event_id)` + status + check-in timestamp          |

Each event may optionally reference one category via the nullable
`category_id` foreign key on `events`. A category **cannot be
deleted** while at least one event still references it — the FK is
declared with `ON DELETE RESTRICT` in
[`003_event_categories.sql`](./supabase/migrations/003_event_categories.sql).
The repository layer translates the resulting Postgres error
`23503` (`foreign_key_violation`) into a user-friendly message in
the admin UI.

### Registration status lifecycle

```
                    ┌────────────┐
   register ──────► │ Terdaftar  │ ──admin toggles──► │ Hadir        │
                    └────────────┘                    └────────────┘
                          │                                  │
                          └──admin toggles──► │ Tidak Hadir  │
                                                └────────────┘
```

`Hadir` automatically sets `checkin_at = now()`. Rolling back to `Terdaftar` clears it. `(user_id, event_id)` has a unique constraint — one user can only register for an event once.

### Row-Level Security

All three data tables (`event_categories`, `event_users`, `event_registrations`) are public-read for `anon` and `authenticated`. Only authenticated (admins) can update or delete registrations, and only admins can create / update / delete event categories. See [`002_event_users_and_registrations.sql`](./supabase/migrations/002_event_users_and_registrations.sql) and [`003_event_categories.sql`](./supabase/migrations/003_event_categories.sql) for the full policy definitions.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and npm
- A **Supabase** project (free tier is fine)

### 1. Clone & install

```bash
git clone <repository-url>
cd event-web
npm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

`.env`:
```env
NUXT_PUBLIC_APP_NAME=Event Management System
NUXT_PUBLIC_COMPANY_NAME=Friendship Community
NUXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
# Optional: fallback cover image for events without one. See
# "Default cover image for events without one" in the Design
# Decisions section below. Leave empty to use a neutral icon placeholder.
NUXT_PUBLIC_DEFAULT_EVENT_IMAGE=
```

You can find both values in your Supabase dashboard under **Settings → API**.

### 3. Set up the database

In the Supabase SQL Editor, run the migrations **in order**:

1. [`supabase/migrations/001_events.sql`](./supabase/migrations/001_events.sql) — creates the `events` table and indexes.
2. [`supabase/migrations/002_event_users_and_registrations.sql`](./supabase/migrations/002_event_users_and_registrations.sql) — creates `event_users` and `event_registrations` tables, RLS policies, and triggers.
3. [`supabase/migrations/003_event_categories.sql`](./supabase/migrations/003_event_categories.sql) — adds `event_categories` and the `events.category_id` foreign key.
4. [`supabase/migrations/004_event_users_extended.sql`](./supabase/migrations/004_event_users_extended.sql) — adds `user_status` and `member_type` columns to `event_users` (with safe `DEFAULT 'active'` / `'internal'` at the DB level for back-fill, and a `CHECK` constraint, so existing rows get a valid value automatically). The application sends `'external'` explicitly for new public registrations, and admins can override either field from the dashboard.

> **Storage:** the migrations also create a public `event-images` storage bucket. If you skip the migration for some reason, you must create the bucket manually so event cover uploads work.

### 4. Create your first admin

In the Supabase dashboard, go to **Authentication → Users → Add user → Create new user** with an email and password. That account will be the only one allowed to access `/dashboard/*` (enforced by [`middleware/auth.ts`](./middleware/auth.ts)).

### 5. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. The home page shows the public event list. To access the dashboard, click **Login Admin** in the header and sign in with the credentials you created above.

---

## 📜 Available Scripts

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the dev server at `http://localhost:3000` |
| `npm run build`    | Build for production                           |
| `npm run generate` | Generate a static site (SSG)                   |
| `npm run preview`  | Preview the production build locally           |
| `npm run postinstall` | Runs `nuxt prepare` after `npm install`     |

---

## 🧠 Notable Design Decisions

### 1. Two separate caches for "participants list" and "occupancy count"

Inside [`presentation/stores/registration.ts`](./presentation/stores/registration.ts) we maintain two maps:

- `participantsByEvent: Record<string, RegistrationWithUser[]>` — full hydrated list, used by the event detail page and the dashboard attendance modal.
- `slotsTakenByEvent: Record<string, number>` — lightweight integer, used by the home page's `EventCard` "X/Y Terisi" badge.

The public home page only needs the **count**, so it calls the dedicated [`GetEventRegistrationsCount`](./application/use-cases/get-event-registrations-count.ts) use case which runs `SELECT count(*) FROM event_registrations WHERE event_id = ?` with no `JOIN`. This avoids the heavy `user:event_users(*)` join that would otherwise happen for every event on every page load.

### 2. Error-safe cache writes

Both `fetchParticipants()` and `fetchParticipantsCount()` in [`presentation/stores/registration.ts`](./presentation/stores/registration.ts) follow a strict rule: **never wipe a cache that already contains a value on error**. They only seed an initial entry if none exists. This means a transient Supabase hiccup or an orphaned row will never cause the home page counter to "reset to 0" on refresh.

### 3. `tryMapRegistrationWithUserRow` is actually try-safe

[`infrastructure/mappers/registration-mapper.ts`](./infrastructure/mappers/registration-mapper.ts) returns `null` (and the repository filters those out) for any row that is malformed or has a missing `user` relation. Previously a single orphaned registration (e.g. pointing at a deleted user) would throw inside `.map()` and poison the entire list fetch.

### 4. Watch-based sync for the home page counter

[`pages/index.vue`](./pages/index.vue) uses a `watch()` on `store.events` (in addition to `onMounted`) to ensure the per-event count fetch runs whether events are already loaded by the time the page mounts or arrive a moment later. A `Set<string>` of fetched IDs prevents duplicate fetches.

### 5. Single hamburger, single drawer

A [`useMobileNav()`](./presentation/composables/useMobileNav.ts) composable owns a singleton boolean. The hamburger in [`AppHeader`](./components/layout/AppHeader.vue) and the drawer in [`layouts/default.vue`](./layouts/default.vue) both read/write that state, so the global mobile drawer works identically for public pages and dashboard pages without prop drilling.

### 6. Mobile drawer email pill

The admin's email pill in the drawer uses `min-w-0` on the flex parent and `truncate min-w-0 flex-1` on the email `<span>`, plus `shrink-0` on the leading icon. Without those, Tailwind's `truncate` utility does nothing inside a flex child — long emails overflow horizontally on narrow viewports.

### 7. Master user gets a status + member type

`event_users` is the central table backing the autofill on the public booking form, so we cannot afford to break existing rows when evolving it. Migration [`004_event_users_extended.sql`](./supabase/migrations/004_event_users_extended.sql) adds two new columns with a safe `DEFAULT` and a `CHECK` constraint:

- `user_status TEXT NOT NULL DEFAULT 'active' CHECK (user_status IN ('active', 'inactive', 'banned'))`
- `member_type TEXT NOT NULL DEFAULT 'internal' CHECK (member_type IN ('internal', 'external'))` (DB default is `'internal'` for legacy back-fill; the application sends `'external'` for new public registrations — see `RegisterUser` use case)

Both are **indexed** (`idx_event_users_user_status`, `idx_event_users_member_type`) so the master-user list filter stays fast as the table grows. The application layer mirrors the defaults in [`RegisterUser`](./application/use-cases/register-user.ts) and the Add/Edit modals, so the database `DEFAULT` and the form initial value are never out of sync. Deleting a user cascades to `event_registrations` (existing `ON DELETE CASCADE` from migration 002), which also lets the cascade-delete confirmation modal on the master-user list page stay simple.

### 8. Per-category attendance on the user detail page

The user detail page (`/dashboard/users/[id]`) has a "Tingkat Kehadiran per Kategori" section that aggregates `event_registrations` per `event.category_id` and computes `attendanceRate` for each group. The repository pulls the raw rows in a single query with a join to `events` + `event_categories`, then aggregates in the application layer — this avoids a server-side Postgres function while still keeping the round-trip count to one.

A year filter pill row sits at the top of the section. The list of available years comes from `getRegistrationYears(userId)`, which groups `event.date` by year and sorts descending. The default selected year is the most recent one. Events without a category are grouped under `(null, 'Tanpa Kategori')` so they still show up in the breakdown.

### 9. Default cover image for events without one

Cover image upload is **optional** when an admin creates an event. To make sure the public home page, event detail page, and dashboard lists never render a broken `<img>` for events that don't have a cover, the [`utils/event-image.ts`](./utils/event-image.ts) helper resolves a single fallback URL at render time.

Set it once via env:

```env
NUXT_PUBLIC_DEFAULT_EVENT_IMAGE=https://your-cdn.example.com/default-event.png
```

Possible values:

- **External HTTPS URL** (e.g. Supabase Storage public bucket, CDN, Unsplash) — most flexible.
- **Absolute path to a file in `public/`** (e.g. `/default-event.png`) — served by Nuxt at the site root, no external dependency.
- **Empty string** — components gracefully fall back to a neutral icon placeholder (`fa-regular fa-image`), so the layout never breaks even if the env isn't set.

The helper is used in [`components/event/EventCard.vue`](./components/event/EventCard.vue), [`pages/event/[id].vue`](./pages/event/[id].vue), [`pages/dashboard/events.vue`](./pages/dashboard/events.vue) (both desktop and mobile rows), and [`pages/dashboard/users/[id].vue`](./pages/dashboard/users/[id].vue). The two image-heavy components ([`EventCard`](./components/event/EventCard.vue), [`pages/event/[id].vue`](./pages/event/[id].vue)) also bind an `@error` handler to swap the `<img>` for the icon placeholder in case the configured default itself 404s.

---

## 🌐 Internationalization

The UI is in **Indonesian** (Bahasa Indonesia) by design. Field labels, button text, and error messages are hard-coded in `id`. Adding multi-language support would mean extracting the strings to a translation table — out of scope for now.

---

## 🤝 Contributing

1. **Respect the layer boundaries.** Never import `@supabase/*` or `vue` inside `domain/` or `application/`. Never import a Supabase repository directly from a component — go through a use case.
2. **Use a use case for any new behavior.** New business logic belongs in `application/use-cases/`, not directly in a Pinia store.
3. **Never wipe a cache on error.** When adding a new fetch action, follow the pattern in `fetchParticipantsCount()`: only seed an initial entry, never replace existing data when the request fails.
4. **Tailwind-only styling.** This project does not use a separate CSS framework or preprocessor. Keep `assets/css/main.css` minimal.
5. **English-only comments.** Every comment in source code — single-line `//`, block `/* */`, JSDoc, and HTML `<!-- -->` inside `.vue` templates — must be written in **English only**. Indonesian (or any other language) is not allowed in comments. User-facing UI strings (labels, buttons, error messages) are exempt; only code comments are required to be in English.

---

## 📂 Path Aliases

The Nuxt config (and the rest of the codebase) use `~/` for the project root. Layered imports follow the directory name:

```ts
import { useAppStore } from '~/presentation/stores/app'
import { BookEvent } from '~/application/use-cases/book-event'
import type { Event } from '~/domain/entities/event'
import { SupabaseEventRepository } from '~/infrastructure/repositories/supabase-event-repository'
```

---

## 📄 License

Private project — all rights reserved unless stated otherwise.
