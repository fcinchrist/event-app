<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import { useEventCategoryStore } from '~/presentation/stores/event-category'
import { resolveEventImage } from '~/utils/event-image'
import type { Event } from '~/domain/entities/event'
import type { EventStatusValue } from '~/types/common'
import type { DashboardPeriodFilter } from '~/presentation/stores/dashboard'
import {
  useQueryParamSync,
  usePeriodQuerySync,
} from '~/presentation/composables/useUrlQuerySync'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useDashboardStore()
const appStore = useAppStore()
const regStore = useRegistrationStore()
const categoryStore = useEventCategoryStore()
const config = useRuntimeConfig()

const showAddModal = ref(false)
const showEditModal = ref(false)
const showParticipantsModal = ref(false)
const participantsEvent = ref<Event | null>(null)
const editingEvent = ref<Event | null>(null)
const searchQuery = ref('')
const imageLoadMap = ref<Record<string, boolean>>({})

// Dashboard navigation menu. Each URL is independent.
const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'categories', label: 'Master Kategori', icon: 'fa-solid fa-tags', to: '/dashboard/categories' },
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

// Status filter tabs above the table
type StatusFilter = 'all' | EventStatusValue
const statusFilter = ref<StatusFilter>('all')

const STATUS_STYLES: Record<EventStatusValue, { label: string; badge: string; dot: string }> = {
  Aktif: {
    label: 'Aktif',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Dibatalkan: {
    label: 'Dibatalkan',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  Selesai: {
    label: 'Selesai',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
}

function statusStyle(status: EventStatusValue): { label: string; badge: string; dot: string } {
  return STATUS_STYLES[status] ?? STATUS_STYLES.Aktif
}

function formatShortDate(iso: string): string {
  if (!iso) return ''
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }
  return new Date(iso).toLocaleDateString('id-ID', options)
}

function formatDay(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// Matches an event's date (ISO string) against the active period
// filter from the dashboard store. Pure client-side filter on
// `store.events` so it does not require an extra roundtrip to the
// server. The dashboard store already manages `period` as the
// single source of truth across pages.
function matchesPeriod(dateIso: string): boolean {
  const p = store.period
  if (p.mode === 'all') return true
  // Event.date is an ISO timestamp; YYYY-MM-DD prefix is enough for
  // day/year comparison (matches the rest of the dashboard's period
  // implementation).
  const day = (dateIso ?? '').slice(0, 10)
  if (!day) return true
  if (p.mode === 'day' && p.date) {
    return day === p.date
  }
  if (p.mode === 'year') {
    return day.startsWith(`${p.year}-`)
  }
  return true
}

// List shown in the table (client-side filter; the server still applies
// its own pagination). Applies both the status tab and the global
// period filter from the dashboard store.
const filteredEvents = computed<Event[]>(() => {
  let list = store.events
  if (statusFilter.value !== 'all') {
    list = list.filter((e) => e.status === statusFilter.value)
  }
  return list.filter((e) => matchesPeriod(e.date))
})

/**
 * Show pagination only when it is actually useful for the current
 * visible (post-filter) list.
 *
 * Three signals are considered:
 *  1. `store.isLoading`  → hide while loading.
 *  2. `filteredEvents.length`  → the count after the status tab AND
 *     the period filter have been applied. If this is small enough
 *     to fit on a single page relative to the current page index,
 *     there is no second page to navigate to, so we hide the pager.
 *  3. `m.hasPrevPage`    → we are already past page 1, so the user
 *     needs a way to go back; show the pager.
 *
 * This handles the bug where the server reports `total = 11+` (so
 * `totalPages = 2` and `hasNextPage = true`) but the client-side
 * period filter leaves only 1 event on screen — without this guard
 * the pager would misleadingly show "Halaman 1 dari 2" with no
 * useful second page.
 */
const shouldShowPagination = computed<boolean>(() => {
  if (store.isLoading) return false
  const m = store.pagination
  // If we are past page 1, the pager is the only way to go back.
  if (m.hasPrevPage) return true
  // If the visible (post-filter) list is shorter than (or equal to)
  // the page size, everything fits on a single page → hide pager.
  if (filteredEvents.value.length <= m.limit) return false
  // Otherwise only show if the server truly reports more pages.
  return m.hasNextPage
})

// Counter for the status tabs. Counts use the master `store.events`
// so the tab numbers are stable regardless of the period filter
// (period is a "view filter", not a count).
const countByStatus = computed<Record<StatusFilter, number>>(() => {
  const base: Record<StatusFilter, number> = {
    all: store.events.length,
    Aktif: 0,
    Dibatalkan: 0,
    Selesai: 0,
  }
  for (const e of store.events) {
    base[e.status] = (base[e.status] ?? 0) + 1
  }
  return base
})

// Active period label, shown as a badge in the header. Reuses the
// same labelling convention as `pages/dashboard/index.vue` so the UX
// stays consistent across pages.
const periodLabel = computed<string>(() => {
  const p = store.period
  if (p.mode === 'all') return 'Semua Waktu'
  if (p.mode === 'day' && p.date) {
    const [y, m, d] = p.date.split('-')
    return `Hari: ${d}/${m}/${y}`
  }
  if (p.mode === 'year') return `Tahun: ${p.year}`
  return 'Semua Waktu'
})

// Wire the shared `DashboardPeriodFilter` component to the dashboard
// store. Reuses the same handler shape as the summary page so the
// validation/error messages stay consistent.
function onApplyPeriod(value: { mode: 'all' | 'day' | 'year'; date: string; year: number }): void {
  if (value.mode === 'all') {
    void store.setPeriod({ mode: 'all' })
    return
  }
  if (value.mode === 'day') {
    if (!value.date) return
    void store.setPeriod({ mode: 'day', date: value.date })
    return
  }
  void store.setPeriod({ mode: 'year', year: value.year })
}

// Status tabs: Semua / Aktif / Dibatalkan / Selesai
const TABS: { key: StatusFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'Semua', icon: 'fa-solid fa-layer-group' },
  { key: 'Aktif', label: 'Aktif', icon: 'fa-solid fa-circle-check' },
  { key: 'Dibatalkan', label: 'Dibatalkan', icon: 'fa-solid fa-circle-xmark' },
  { key: 'Selesai', label: 'Selesai', icon: 'fa-solid fa-flag-checkered' },
]

// Whitelist status valid supaya parse URL tidak accept string sembarang.
const STATUS_WHITELIST: ReadonlyArray<StatusFilter> = [
  'all', 'Aktif', 'Dibatalkan', 'Selesai',
]

/**
 * Filter yang ada di URL selalu disinkronkan ke store & auto-refetch
 * data event. Pola ini best-practice SPA: URL adalah "shareable state",
 * store adalah "UI state", dan ref lokal adalah "instant feedback"
 * (mis. search box yang ngetik tanpa debounce URL).
 *
 *  - `q`, `status`, `period` → `router.replace` (tidak nambah history)
 *  - `page`                  → `router.push`   (back-button bisa
 *                                               navigate antar halaman)
 */
const VALID_STATUSES = new Set<string>(STATUS_WHITELIST)

function parseStatus(raw: string): StatusFilter | null {
  return VALID_STATUSES.has(raw) ? (raw as StatusFilter) : null
}

// `searchQuery` ref lokal adalah sumber utama untuk input box. URL sync
// write ke store.fetchEvents (debounced via watcher di bawah) supaya
// tidak spam API setiap keystroke.
useQueryParamSync<string>('q', searchQuery, {
  history: 'replace',
  serialize: (v) => (v.trim() ? v.trim() : null),
  parse: (raw) => raw,
})

// Status filter: ref lokal → URL (replace) → ref. Saat berubah kita
// reset page=1 supaya user tidak stuck di halaman kosong.
useQueryParamSync<StatusFilter>('status', statusFilter, {
  history: 'replace',
  serialize: (v) => (v === 'all' ? null : v),
  parse: parseStatus,
})

// Page: pakai computed wrapper yang write ke `store.page` saat URL
// berubah. Penting: page sync pakai `router.push` agar back-button
// bisa kembali ke halaman sebelumnya (UX standar).
const pageRef = computed<number>({
  get: () => store.page,
  set: (v) => {
    if (v === store.page) return
    store.setPage(v)
  },
})
useQueryParamSync<number>('page', pageRef, {
  history: 'push',
  serialize: (v) => (v > 1 ? String(v) : null),
  parse: (raw) => {
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  },
})

// Period (objek mode/date/year). Single source of truth di store;
// URL sync bersifat dua arah.
const periodRef = computed<DashboardPeriodFilter>({
  get: () => store.period,
  set: (v) => {
    // setPeriod() sudah validasi + refetch registrations + attendance
    void store.setPeriod({ mode: v.mode, date: v.date, year: v.year })
  },
})
usePeriodQuerySync(periodRef, { history: 'replace' })

/**
 * Debounced search: tiap kali `searchQuery` berubah (dari user ngetik
 * ATAU dari URL sync), trigger fetch setelah 350ms idle. Reset ke
 * page=1 supaya hasil baru langsung di halaman pertama.
 */
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (next) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (store.search !== next) {
      store.setSearch(next)
    } else {
      // Same value, just refetch to be safe (e.g. after create/delete).
      void store.fetchEvents()
    }
  }, 350)
})

/**
 * Watch status filter → reset ke page 1 + refetch. Penting supaya
 * user tidak stuck di page 5 yang ternyata kosong setelah filter
 * status berubah.
 */
watch(statusFilter, (next, prev) => {
  if (next === prev) return
  if (store.page !== 1) {
    store.setPage(1)
  }
  void store.fetchEvents()
})

/**
 * Watch page (dari URL push atau programmatic) → refetch.
 */
watch(pageRef, (next, prev) => {
  if (next === prev) return
  void store.fetchEvents()
})

function onSearchInput(): void {
  // Watcher `searchQuery` di atas sudah handle debounce + refetch.
  // Fungsi ini tetap ada agar @input di template eksplisit
  // (mencegah IDE/template warning "no handler").
}

/**
 * Programmatic pagination: set page di store, watcher pageRef
 * akan refetch otomatis. URL sync akan push ke history supaya
 * back-button bisa kembali ke halaman sebelumnya.
 */
function changePage(page: number): void {
  store.setPage(page)
}

async function handleDelete(event: Event): Promise<void> {
  if (!confirm(`Hapus event "${event.title}"? Tindakan ini tidak dapat dibatalkan.`)) return
  // Store action sudah set state.error -> banner inline di template menampilkan pesan
  await store.deleteEvent(event.id)
}

async function handleToggleStatus(event: Event): Promise<void> {
  const nextStatus: EventStatusValue = event.status === 'Aktif' ? 'Dibatalkan' : 'Aktif'
  const confirmMsg = nextStatus === 'Dibatalkan'
    ? `Nonaktifkan event "${event.title}"? Event akan disembunyikan dari publik.`
    : `Aktifkan kembali event "${event.title}"?`
  if (!confirm(confirmMsg)) return
  // Store action sudah set state.error -> banner inline di template menampilkan pesan
  await store.updateEventStatus(event.id, nextStatus)
}

function openEdit(event: Event): void {
  editingEvent.value = event
  showEditModal.value = true
}

function openParticipants(event: Event): void {
  participantsEvent.value = event
  showParticipantsModal.value = true
}

function onUpdated(): void {
  // The store has already updated `state.events` reactively.
}

function openAdd(): void {
  showAddModal.value = true
}

function onCreated(): void {
  store.fetchEvents()
  // Refresh participants count for every event
  Promise.all(
    store.events.map((e) => regStore.fetchParticipants(e.id)),
  )
}

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  await store.fetchEvents()
  // Pre-fetch participants count for the "Lihat Peserta" button badge
  await Promise.all(
    store.events.map((e) => regStore.fetchParticipants(e.id)),
  )
  // Pre-fetch categories so the table can show the category name
  // for each event (uses the cached `byId` map for lookup).
  void categoryStore.fetchCategories()
  // Sync period data (registrasi + attendance) from the shared
  // dashboard store so the period filter is consistent with the
  // summary page (single source of truth).
  void store.fetchRegistrationsByPeriod()
})

// Resolve a category name for a row from the cached map. Returns
// `null` when the event has no category so the cell can render
// an em-dash placeholder.
function categoryNameFor(categoryId: string | null): string | null {
  if (!categoryId) return null
  return categoryStore.byId[categoryId]?.name ?? null
}
</script>

<template>
  <DashboardShell :items="NAV_ITEMS" section-label="Panel Operasional">
    <section class="space-y-5">
      <!-- ============ Header Halaman ============ -->
      <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
            <h2 class="font-extrabold text-2xl text-emerald-700">Kelola Event</h2>
          </div>
          <p class="text-xs text-slate-500">
            Daftar lengkap event komunitas {{ config.public.companyName }}.
          </p>
          <!-- Badge periode aktif (sama seperti di summary) -->
          <div class="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
            <i class="fa-solid fa-filter" />
            Periode aktif: {{ periodLabel }}
          </div>
        </div>
        <UiAppButton variant="primary" @click="openAdd">
          <i class="fa-solid fa-plus-circle" /> Buat Event Baru
        </UiAppButton>
      </header>

      <!-- Filter periode (sama seperti di summary dashboard) -->
      <DashboardPeriodFilter
        :model-value="store.period"
        :is-loading="store.isRegistrationsLoading"
        @update:model-value="(v) => (store.period = v)"
        @apply="onApplyPeriod"
      />

      <!-- ============ Toolbar: Search + Filter Tabs ============ -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-grow min-w-[200px] focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
            <i class="fa-solid fa-magnifying-glass text-slate-400 text-xs" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari judul atau lokasi event..."
              class="bg-transparent text-xs w-full focus:outline-none"
              @input="onSearchInput"
            >
          </div>
        </div>

        <!-- Status Filter Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border"
            :class="statusFilter === tab.key
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'"
            @click="statusFilter = tab.key"
          >
            <i :class="tab.icon" />
            {{ tab.label }}
            <span
              class="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold"
              :class="statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'"
            >
              {{ countByStatus[tab.key] }}
            </span>
          </button>
        </div>
      </div>

      <!-- ============ Error ============ -->
      <div v-if="store.error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
        <i class="fa-solid fa-circle-exclamation" /> {{ store.error }}
      </div>

      <!-- ============ Loading State: Skeleton Tabel ============ -->
      <DashboardEventsTableSkeleton v-if="store.isLoading" :rows="5" />

      <!-- ============ Empty State ============ -->
      <div
        v-else-if="store.events.length === 0"
        class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm"
      >
        <div class="bg-emerald-50 text-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i class="fa-solid fa-calendar-xmark text-2xl" />
        </div>
        <h4 class="font-bold text-slate-800 text-lg">Belum Ada Event</h4>
        <p class="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Mulai dengan membuat event pertama untuk komunitas Anda.
        </p>
        <UiAppButton class="mt-5" variant="primary" @click="openAdd">
          <i class="fa-solid fa-plus-circle" /> Buat Event Pertama
        </UiAppButton>
      </div>

      <!-- ============ Empty because of filter ============ -->
      <div
        v-else-if="filteredEvents.length === 0"
        class="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm"
      >
        <div class="bg-slate-100 text-slate-400 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i class="fa-solid fa-filter-circle-xmark text-xl" />
        </div>
        <h4 class="font-bold text-slate-800 text-base">Tidak ada event dengan filter ini</h4>
        <p class="text-xs text-slate-500 mt-1">
          Coba pilih tab lain, ubah kata kunci pencarian, atau atur ulang filter periode.
        </p>
      </div>

      <!-- ============ Tabel Event (rapih & menarik) ============ -->
      <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Header Tabel (desktop only). Pakai icon kecil di tiap
             kolom supaya baseline visual header sejajar dengan row
             (row juga pakai icon di cell-nya). -->
        <div class="hidden md:grid grid-cols-[minmax(0,3.5fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-calendar-day text-slate-400" />
            <span>Event</span>
          </div>
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-clock text-slate-400" />
            <span>Tanggal</span>
          </div>
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-location-dot text-slate-400" />
            <span>Lokasi</span>
          </div>
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-tag text-slate-400" />
            <span>Kategori</span>
          </div>
          <div class="flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-users text-slate-400" />
            <span>Kuota</span>
          </div>
          <div class="flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-circle-check text-slate-400" />
            <span>Status</span>
          </div>
          <div class="flex items-center justify-end gap-1.5">
            <i class="fa-solid fa-gear text-slate-400" />
            <span>Aksi</span>
          </div>
        </div>

        <!-- Rows.
             Wrapper pakai `space-y-2` (mobile) dan `space-y-0` (desktop)
             supaya card mobile punya jarak antar-event yang jelas
             (card 1, 2, 3, 4 di screenshot tadinya mepet). Di desktop
             kita tetap pakai `divide-y` visual separator supaya rapi
             dan hemat tinggi. -->
        <div class="md:divide-y md:divide-slate-100 space-y-2 md:space-y-0">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            class="px-4 sm:px-5 py-3 md:py-3.5 hover:bg-slate-50/60 transition-colors bg-white md:bg-transparent border border-slate-200 md:border-0 rounded-2xl md:rounded-none shadow-sm md:shadow-none"
          >
            <!-- Desktop: 1 baris grid. Pakai grid template yang sama
                 persis dengan header (kolom 7-col) supaya sejajar
                 sempurna secara horizontal. -->
            <div class="hidden md:grid grid-cols-[minmax(0,3.5fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 items-center">
              <!-- Event: avatar + judul + id -->
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative border border-slate-200">
                  <div
                    v-if="!imageLoadMap[event.id] && resolveEventImage(event.image)"
                    class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100"
                  />
                  <img
                    v-if="resolveEventImage(event.image)"
                    :src="resolveEventImage(event.image)"
                    :alt="event.title"
                    class="w-full h-full object-cover"
                    :class="imageLoadMap[event.id] ? 'opacity-100' : 'opacity-0'"
                    @load="imageLoadMap[event.id] = true"
                    @error="imageLoadMap[event.id] = true"
                  >
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-slate-300"
                  >
                    <i class="fa-solid fa-image text-sm" />
                  </div>
                </div>
                <div class="min-w-0">
                  <h3 class="font-bold text-slate-900 text-sm truncate">
                    {{ event.title }}
                  </h3>
                  <p class="text-[10px] text-slate-400 font-mono mt-0.5">
                    ID: {{ event.id.slice(0, 8) }}…
                  </p>
                </div>
              </div>

              <!-- Tanggal -->
              <div class="min-w-0 leading-tight">
                <div class="text-xs font-bold text-slate-800">{{ formatDay(event.date) }}</div>
                <div class="text-[10px] text-slate-500 mt-0.5">{{ formatTime(event.date) }} WIB</div>
              </div>

              <!-- Lokasi -->
              <div class="min-w-0">
                <p class="text-xs text-slate-700 truncate" :title="event.location">
                  {{ event.location }}
                </p>
              </div>

              <!-- Kategori -->
              <div class="min-w-0">
                <span
                  v-if="categoryNameFor(event.categoryId)"
                  class="inline-flex max-w-full items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 truncate"
                >
                  {{ categoryNameFor(event.categoryId) }}
                </span>
                <span
                  v-else
                  class="text-[11px] text-slate-400 italic"
                >
                  —
                </span>
              </div>

              <!-- Kuota -->
              <div class="text-center">
                <span class="text-sm font-extrabold text-slate-800">{{ event.quota }}</span>
                <span class="text-[10px] text-slate-400 font-bold ml-0.5">slot</span>
              </div>

              <!-- Status -->
              <div class="flex justify-center">
                <span
                  :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', statusStyle(event.status).badge]"
                >
                  <span :class="['w-1.5 h-1.5 rounded-full', statusStyle(event.status).dot]" />
                  {{ statusStyle(event.status).label }}
                </span>
              </div>

              <!-- Aksi -->
              <div class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-all relative"
                  title="Lihat & kelola peserta"
                  @click="openParticipants(event)"
                >
                  <i class="fa-solid fa-users text-xs" />
                  <span
                    v-if="regStore.participantsByEvent[event.id]?.length"
                    class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-indigo-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center"
                  >
                    {{ regStore.participantsByEvent[event.id].length }}
                  </span>
                </button>
                <button
                  type="button"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-all"
                  title="Edit event"
                  :disabled="store.isSubmitting"
                  @click="openEdit(event)"
                >
                  <i class="fa-solid fa-pen-to-square text-xs" />
                </button>
                <button
                  v-if="event.status === 'Aktif' || event.status === 'Dibatalkan'"
                  type="button"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition-all"
                  :title="event.status === 'Aktif' ? 'Nonaktifkan event' : 'Aktifkan event'"
                  :disabled="store.isSubmitting"
                  @click="handleToggleStatus(event)"
                >
                  <i :class="event.status === 'Aktif' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left'" class="text-xs" />
                </button>
                <button
                  type="button"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-all"
                  title="Hapus event"
                  @click="handleDelete(event)"
                >
                  <i class="fa-solid fa-trash-can text-xs" />
                </button>
              </div>
            </div>
            <!-- Mobile: card view. Padding tetap ada di row, jadi
                 di sini cukup layout isinya. Avatar + meta sejajar
                 dengan baseline. Action row pakai icon-only button
                 supaya muat di layar sempit. -->
            <div class="md:hidden space-y-3">
              <!-- Header: avatar + judul + status -->
              <div class="flex gap-3">
                <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative border border-slate-200">
                  <div
                    v-if="!imageLoadMap[event.id] && resolveEventImage(event.image)"
                    class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100"
                  />
                  <img
                    v-if="resolveEventImage(event.image)"
                    :src="resolveEventImage(event.image)"
                    :alt="event.title"
                    class="w-full h-full object-cover"
                    :class="imageLoadMap[event.id] ? 'opacity-100' : 'opacity-0'"
                    @load="imageLoadMap[event.id] = true"
                    @error="imageLoadMap[event.id] = true"
                  >
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-slate-300"
                  >
                    <i class="fa-solid fa-image text-base" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="font-bold text-slate-900 text-sm leading-snug line-clamp-2 min-w-0">
                      {{ event.title }}
                    </h3>
                    <span
                      :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0', statusStyle(event.status).badge]"
                    >
                      <span :class="['w-1.5 h-1.5 rounded-full', statusStyle(event.status).dot]" />
                      {{ statusStyle(event.status).label }}
                    </span>
                  </div>
                  <p class="mt-1 text-[10px] text-slate-400 font-mono">
                    ID: {{ event.id.slice(0, 8) }}…
                  </p>
                </div>
              </div>

              <!-- Meta: list vertikal ringkas (icon + text), sama
                   seperti versi sebelumnya supaya konsisten & mudah
                   di-scan di mobile. -->
              <div class="space-y-1 text-[11px] text-slate-600">
                <div class="flex items-center gap-1.5 truncate">
                  <i class="fa-solid fa-calendar text-emerald-500 w-3 text-center" />
                  <span class="truncate">{{ formatShortDate(event.date) }}</span>
                </div>
                <div class="flex items-center gap-1.5 truncate">
                  <i class="fa-solid fa-location-dot text-rose-400 w-3 text-center" />
                  <span class="truncate">{{ event.location }}</span>
                </div>
                <div class="flex items-center gap-1.5 truncate">
                  <i class="fa-solid fa-tag text-emerald-500 w-3 text-center" />
                  <span class="truncate">
                    {{ categoryNameFor(event.categoryId) ?? 'Tanpa kategori' }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <i class="fa-solid fa-user-group text-slate-400 w-3 text-center" />
                  <span>Kuota {{ event.quota }} slot</span>
                </div>
              </div>

              <!-- Action row: dipisah jadi 2 grup supaya visualnya
                   lebih jelas. Grup kiri = "kelola" (peserta, edit),
                   grup kanan = "destructive" (toggle, hapus).
                   Masing-masing dibungkus background slate-50 + border
                   supaya tidak mepet ke konten di atasnya. -->
              <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
                <!-- Grup kelola -->
                <div class="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                  <button
                    type="button"
                    class="relative h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-white transition-all"
                    title="Lihat & kelola peserta"
                    @click="openParticipants(event)"
                  >
                    <i class="fa-solid fa-users text-xs" />
                    <span>Peserta</span>
                    <span
                      v-if="regStore.participantsByEvent[event.id]?.length"
                      class="min-w-[18px] h-[18px] px-1.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center"
                    >
                      {{ regStore.participantsByEvent[event.id].length }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-white transition-all"
                    title="Edit event"
                    :disabled="store.isSubmitting"
                    @click="openEdit(event)"
                  >
                    <i class="fa-solid fa-pen-to-square text-xs" />
                    <span>Edit</span>
                  </button>
                </div>

                <!-- Grup destructive -->
                <div class="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                  <button
                    v-if="event.status === 'Aktif' || event.status === 'Dibatalkan'"
                    type="button"
                    class="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-700 hover:bg-white transition-all"
                    :title="event.status === 'Aktif' ? 'Nonaktifkan event' : 'Aktifkan event'"
                    :disabled="store.isSubmitting"
                    @click="handleToggleStatus(event)"
                  >
                    <i :class="event.status === 'Aktif' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left'" class="text-xs" />
                  </button>
                  <button
                    type="button"
                    class="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-white transition-all"
                    title="Hapus event"
                    @click="handleDelete(event)"
                  >
                    <i class="fa-solid fa-trash-can text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ Pagination ============ -->
      <div
        v-if="shouldShowPagination"
        class="flex items-center justify-center gap-2 pt-2"
      >
        <button
          :disabled="!store.pagination.hasPrevPage"
          class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          @click="changePage(store.pagination.page - 1)"
        >
          <i class="fa-solid fa-chevron-left text-xs" />
        </button>
        <div class="text-xs font-semibold text-slate-600 px-3">
          Halaman <span class="text-emerald-700 font-extrabold">{{ store.pagination.page }}</span>
          dari <span>{{ store.pagination.totalPages }}</span>
        </div>
        <button
          :disabled="!store.pagination.hasNextPage"
          class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          @click="changePage(store.pagination.page + 1)"
        >
          <i class="fa-solid fa-chevron-right text-xs" />
        </button>
      </div>
    </section>

    <DashboardAddEventModal v-model="showAddModal" @created="onCreated" />
    <DashboardEditEventModal v-model="showEditModal" :event="editingEvent" @updated="onUpdated" />
    <DashboardEventParticipantsModal v-model="showParticipantsModal" :event="participantsEvent" />
  </DashboardShell>
</template>
