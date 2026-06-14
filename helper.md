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
  location: string
  startTime: string
  endTime: string
  capacity: number
  createdAt: string
}
```

---

## Event Registration

```ts
export interface EventRegistration {
  id: string
  userId: string
  eventId: string
  registeredAt: string
}
```

---

## Event Attendance

```ts
export interface EventAttendance {
  id: string
  userId: string
  eventId: string
  checkedInAt: string
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

## event_registrations

```sql
create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid not null,
  registered_at timestamptz default now(),

  unique(user_id, event_id)
);
```

---

## event_attendance

```sql
create table event_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid not null,
  checked_in_at timestamptz default now(),

  unique(user_id, event_id)
);
```

---

# 🧠 Business Rules

## Event Rules

* Event capacity cannot be exceeded
* Capacity is calculated from registrations

---

## Registration Rules

* One registration per user per event
* Registration blocked when capacity is reached

---

## Attendance Rules

* User must be registered before check-in
* One check-in per event

---

# 🧱 Application Layer

## Event Use Cases

* GetEvents
* GetEventById

---

## Registration Use Cases

* RegisterEvent
* CancelRegistration

---

## Attendance Use Cases

* CheckInEvent

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
}
```

---

## Registration Repository

```ts
export interface RegistrationRepository {
  register(
    userId: string,
    eventId: string
  ): Promise<void>

  cancel(
    userId: string,
    eventId: string
  ): Promise<void>

  countByEvent(
    eventId: string
  ): Promise<number>
}
```

---

## Attendance Repository

```ts
export interface AttendanceRepository {
  checkIn(
    userId: string,
    eventId: string
  ): Promise<void>
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
