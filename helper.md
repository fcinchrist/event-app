# 📘 Event Management System – Technical Specification (Updated)

---

## 🧭 Overview

This is a **web-based Event Management System** built with:

* Nuxt 3 (`^3.21.8`)
* Vue 3 (`^3.5.35`)
* TypeScript (strict mode)
* TailwindCSS
* Pinia
* Supabase (Auth + Database)
* Deployment: Vercel

---

## 🏢 Company Configuration (NEW – ENV BASED)

All branding must be configurable via environment variables.

### 📦 Environment Variables

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=

APP_NAME="Event Management System"
COMPANY_NAME="Your Company Name"
```

---

## 🧠 Rules for Company Name Usage

### ✅ Allowed:

* Read from `process.env`
* Inject into runtime config (`Nuxt runtimeConfig`)
* Use in UI (header, footer, title, meta)

### ❌ Forbidden:

* Hardcoding company name anywhere
* Duplicating constants across layers

---

## 🖥️ Frontend Usage (Nuxt 3)

Use runtime config:

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

## 🧩 Usage in UI

```ts
const config = useRuntimeConfig()

config.public.companyName
config.public.appName
```

---

## 🚨 Non-Negotiable Rules (UPDATED)

### ❌ Strict Prohibitions

* No `any`
* No Supabase queries in Vue components
* No business logic in UI layer
* No implicit typing
* No bypassing repository layer
* No hardcoded company/app branding

---

## 📄 Pagination Rule (NEW – MANDATORY)

### 📌 Applies to ALL list pages:

* Events list
* Registrations list (if added later)
* Attendance list (if added later)
* Any future paginated resource

---

## 📌 Pagination Requirement

Every list API MUST support:

* `page`
* `limit`

### Example:

```
GET /events?page=1&limit=10
```

---

## 📦 Pagination Response Format (BEST PRACTICE)

All list APIs must follow this structure:

```ts
{
  data: T[]
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

## ❌ Forbidden API Response Patterns

* Returning raw array only
* Mixing pagination meta inside data array
* Inconsistent response shapes between endpoints

---

## 🧠 Clean Architecture (UNCHANGED)

```txt
/app
/presentation
/application
/domain
/infrastructure
/types
/utils
```

---

## 🔄 Data Flow (UNCHANGED)

```txt
UI → Store → Use Case → Repository Interface → Repository → Supabase
```

---

## 📦 Domain Models (UNCHANGED)

Event, Registration, Attendance remain the same.

---

# 🧱 Repository Layer (UPDATED RULE)

## Pagination MUST be supported in repositories

### Example:

```ts
export interface EventRepository {
  getAll(params: {
    page: number
    limit: number
  }): Promise<{
    data: Event[]
    total: number
  }>

  getById(id: string): Promise<Event | null>
}
```

---

## 🧱 Infrastructure Layer (Supabase)

### Must:

* Handle pagination query (`range`, `limit`, `offset`)
* Map Supabase response → standardized API response

### Example behavior:

* Convert Supabase `.range(from, to)`
* Convert `count` → `total`

---

## 🧠 Use Case Layer

Use cases must:

* Accept pagination params
* Return standardized response format

---

## 🧠 Pinia Store Rules (UPDATED)

Stores must:

* Handle pagination state:

  * current page
  * page size
  * total pages
* Trigger use-case with pagination params

---

## 🎨 UI Layer Rules (UPDATED)

### All list pages MUST:

* Display pagination UI
* Allow page navigation
* Never fetch raw data directly

### UI must NOT:

* Calculate pagination logic
* Modify API response shape

---

## 🧭 Routing (UNCHANGED)

---

## 🛡️ Middleware (UNCHANGED)

---

## 🎨 Styling (UNCHANGED)

---

## 🚀 Deployment (UPDATED NOTES)

### ENV must include:

```env
APP_NAME=
COMPANY_NAME=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

---

## 🧪 Strict Type Safety (UNCHANGED)

* No `any`
* No unsafe casting
* Use `unknown` + narrowing

---

## ⚡ Optional Improvements (EXPANDED)

* Role-based access (admin/user)
* QR check-in
* Event analytics
* Email notifications
* Multi-tenant support (future: company-based isolation using `COMPANY_ID`)

---

## 🧾 Final Summary (UPDATED)

* UI is UI only
* Business logic in use-cases
* Data access via repositories
* Supabase isolated in infrastructure
* All list endpoints MUST support pagination
* All API responses MUST be standardized
* Company branding MUST come from ENV only
* Strict TypeScript (no `any`)
