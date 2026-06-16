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

// Mobile UX: sembunyikan period filter di balik toggle.
// Default false (tersembunyi) supaya halaman tidak penuh di
// viewport sempit. User yang butuh filter bisa tap tombol
// "Filter Periode" di header.
const showPeriodFilter = ref(false)
function togglePeriodFilter(): void {
  showPeriodFilter.value = !showPeriodFilter.value
}

// Global success banner. Di-set dari `onCreateSuccess` (dipanggil
// oleh `<DashboardAddEventModal>` saat `emit('success', ...)`).
// Auto-dismiss setelah 4 detik supaya user tidak harus klik manual
// (tetap dismissible via tombol X untuk kasus edge).
const successMessage = ref<string | null>(null)
let successTimer: ReturnType<typeof setTimeout> | null = null

function flashSuccess(message: string): void {
  successMessage.value = message
  if (successTimer) clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    successMessage.value = null
  }, 4000)
}

function dismissSuccess(): void {
  if (successTimer) clearTimeout(successTimer)
  successMessage.value = null
}

onBeforeUnmount(() => {
  if (successTimer) clearTimeout(successTimer)
})

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
 * Show pagination whenever the server reports more than one page of
 * data (`totalPages > 1`). We deliberately do NOT hide the pager
 * just because the client-side status/period filter happens to
 * leave ≤ `limit` items on the current page — the user still needs
 * a way to navigate to other pages that contain the rest of the
 * data.
 *
 * The only times the pager is hidden:
 *  1. While loading (`store.isLoading`) — avoids flash of "1 of 0".
 *  2. When the server confirms there is only one page
 *     (`totalPages <= 1`).
 *
 * NOTE: an earlier version also checked `filteredEvents.length <=
 * limit` to hide the pager when the visible list fit on one page.
 * That logic was wrong: the user could legitimately have 10 events
 * on page 1 of a 25-event database — the pager must stay visible
 * so they can jump to page 2 / 3.
 */
const shouldShowPagination = computed<boolean>(() => {
  if (store.isLoading) return false
  const m = store.pagination
  // Single source of truth: server-reported page count.
  return m.totalPages > 1
})

// Counter for the status tabs. Sumber utama: `store.statusCounts`
// (di-fetch server-side via `CountEventsByStatus`) sehingga angka
// di badge mencerminkan TOTAL seluruh halaman, bukan hanya rows
// di halaman tabel saat ini. Sebelumnya badge dihitung dari
// `store.events` (yang hanya berisi ≤ `limit` baris per halaman),
// sehingga angka-nya selalu salah saat ada pagination.
//
// `all` tetap di-derive dari `pagination.total` (server-authoritative)
// — yang juga sudah di-update optimistis di `createEvent` /
// `updateEventStatus` / `deleteEvent`.
const countByStatus = computed<Record<StatusFilter, number>>(() => {
  const counts = store.statusCounts
  const all = store.pagination.total
  return {
    all,
    Aktif: counts.Aktif ?? 0,
    Dibatalkan: counts.Dibatalkan ?? 0,
    Selesai: counts.Selesai ?? 0,
  }
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

// Status tabs: Semua / Aktif / Dibatalkan / Selesai.
// `shortLabel` adalah versi ringkas (≤ 4 huruf) yang dipakai di
// mobile supaya 4 tab muat dalam 1 baris dengan label lengkap
// (ramah untuk pengguna lanjut usia). Di `sm+` tetap pakai
// `label` panjang.
const TABS: { key: StatusFilter; label: string; shortLabel: string; icon: string }[] = [
  { key: 'all', label: 'Semua', shortLabel: 'Semua', icon: 'fa-solid fa-layer-group' },
  { key: 'Aktif', label: 'Aktif', shortLabel: 'Aktif', icon: 'fa-solid fa-circle-check' },
  { key: 'Dibatalkan', label: 'Dibatalkan', shortLabel: 'Batal', icon: 'fa-solid fa-circle-xmark' },
  { key: 'Selesai', label: 'Selesai', shortLabel: 'Selesai', icon: 'fa-solid fa-flag-checkered' },
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
 *
 * PENTING: `setSearch()` di store TIDAK memanggil `fetchEvents()`
 * — itu tanggung jawab caller. Sebelumnya watcher ini cuma
 * `setSearch()` tanpa fetch, jadi kalau user sudah di page 1 (tidak
 * ada pageRef change) pencarian hanya “jalan sekali” dan stuck di
 * hasil pertama. Sekarang kita selalu `fetchEvents()` di akhir
 * watcher, baik search berubah maupun tidak.
 */
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (next) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (store.search !== next) {
      store.setSearch(next)
    }
    // Selalu refetch di akhir — baik search baru maupun tidak.
    // `setSearch()` sudah reset `this.page = 1`; kalau page memang
    // berubah dari nilai sebelumnya, `watch(pageRef)` di bawah
    // akan men-double-fire, tapi Pinia/Vue men-debounce watcher
    // jadi aman. Untuk memastikan, kita set page dulu sebelum
    // fetch supaya tidak ada race.
    if (store.page !== 1) {
      store.setPage(1)
    }
    await Promise.all([
      store.fetchEvents(),
      store.fetchStatusCounts(next),
    ])
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

/**
 * Reset semua filter (search, status tab, period) ke default dan
 * refetch dari halaman 1. Dipakai oleh tombol "Reset Filter" di
 * toolbar. Period di-reset ke 'all' lewat `setPeriod` di store
 * (otomatis refetch registrations + attendance, tapi tidak
 * refetch events — kita handle manual di sini).
 */
async function resetAllFilters(): Promise<void> {
  searchQuery.value = ''
  statusFilter.value = 'all'
  if (store.search !== '' || store.page !== 1) {
    store.setSearch('')
  }
  await store.setPeriod({ mode: 'all' })
  await Promise.all([
    store.fetchEvents(),
    store.fetchStatusCounts(''),
  ])
}

async function onCreated(): Promise<void> {
  // Reset ke page 1 lalu refetch. Pakai `await` agar tabel + pager
  // update sinkron sebelum kita refresh participants count.
  // Sebelumnya `store.fetchEvents()` di-fire tanpa await sehingga
  // user bisa lihat "stale list" sesaat setelah create.
  if (store.page !== 1) {
    store.setPage(1)
  }
  await Promise.all([
    store.fetchEvents(),
    store.fetchStatusCounts(searchQuery.value),
  ])
  // Refresh participants count untuk semua event
  await Promise.all(
    store.events.map((e) => regStore.fetchParticipants(e.id)),
  )
}

function onCreateSuccess(message: string): void {
  flashSuccess(message)
}

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  await Promise.all([
    store.fetchEvents(),
    store.fetchStatusCounts(searchQuery.value),
  ])
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
      <!--
        Layout mobile-first: judul + deskripsi ringkas di atas, lalu
        baris berisi (1) badge periode aktif (ringkas, single-line)
        dan (2) tombol Buat Event full-width supaya gampang dijangkau
        ibu- jari. Pada layar `sm+`, layout jadi 2-kolom (judul di
        kiri, tombol di kanan) sesuai desain desktop.
      -->
      <header class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
              <h2 class="font-extrabold text-2xl text-emerald-700">Kelola Event</h2>
            </div>
            <p class="text-xs sm:text-sm text-slate-500">
              Daftar lengkap event komunitas {{ config.public.companyName }}.
            </p>
          </div>
          <!-- Badge periode aktif (klik untuk toggle filter) -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-sm font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors self-start sm:self-auto"
            :aria-expanded="showPeriodFilter"
            aria-controls="period-filter-panel"
            @click="togglePeriodFilter"
          >
            <i class="fa-solid fa-filter" />
            <span>Periode: {{ periodLabel }}</span>
            <i
              :class="showPeriodFilter ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
              class="text-xs ml-1"
            />
          </button>
        </div>
        <!-- Tombol Buat Event full-width di mobile, auto di sm+ -->
        <UiAppButton
          variant="primary"
          class="w-full sm:w-auto sm:self-end text-base py-3 sm:py-2"
          size="lg"
          @click="openAdd"
        >
          <i class="fa-solid fa-plus-circle" /> Buat Event Baru
        </UiAppButton>
      </header>

      <!--
        Filter periode: di mobile disembunyikan di balik toggle
        (default collapsed) supaya tidak memenuhi layar. Di desktop
        selalu tampil sm+. Behavior UX: untuk user lanjut usia,
        halaman utama cukup berisi judul + tombol besar + daftar
        event, tanpa harus scroll melewati panel filter yang
        menghabiskan banyak vertikal space.
      -->
      <div
        id="period-filter-panel"
        :class="showPeriodFilter ? 'block' : 'hidden sm:block'"
      >
        <DashboardPeriodFilter
          :model-value="store.period"
          :is-loading="store.isRegistrationsLoading"
          @update:model-value="(v) => (store.period = v)"
          @apply="onApplyPeriod"
        />
      </div>

      <!-- ============ Toolbar: Search + Filter Tabs ============ -->
      <!--
        Mobile-first: search box lebih besar (h-12), font 15px,
        dan tab status pakai `grid grid-cols-2` di mobile (sehingga
        "Selesai" tidak ke-cut) lalu `flex` di sm+. Ukuran tab juga
        lebih besar (h-11) supaya mudah di-tap.
      -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <!-- Baris atas: tombol reset filter. Hanya tampil jika
             ada filter aktif (search / status != all / period != all). -->
        <div
          v-if="searchQuery || statusFilter !== 'all' || store.period.mode !== 'all'"
          class="flex items-center justify-between gap-2 pb-1 border-b border-slate-100"
        >
          <span class="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 truncate">
            <i class="fa-solid fa-filter text-emerald-600" />
            Filter aktif:
            <span v-if="searchQuery" class="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600">
              "{{ searchQuery }}"
            </span>
            <span v-if="statusFilter !== 'all'" class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
              {{ statusFilter }}
            </span>
            <span v-if="store.period.mode !== 'all'" class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200">
              {{ periodLabel }}
            </span>
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all shrink-0"
            :disabled="store.isLoading"
            @click="resetAllFilters"
          >
            <i class="fa-solid fa-rotate-right" />
            <span>Reset Filter</span>
          </button>
        </div>

        <!-- Search -->
        <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 h-12 sm:h-11 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
          <i class="fa-solid fa-magnifying-glass text-slate-400 text-sm shrink-0" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari judul atau lokasi..."
            class="bg-transparent text-sm w-full min-w-0 focus:outline-none placeholder:text-slate-400"
            @input="onSearchInput"
          >
          <button
            v-if="searchQuery"
            type="button"
            class="text-slate-400 hover:text-rose-500 text-xs px-1 shrink-0"
            aria-label="Bersihkan pencarian"
            @click="searchQuery = ''"
          >
            <i class="fa-solid fa-circle-xmark" />
          </button>
        </div>

        <!-- Status Filter Tabs: pakai `flex-1` di mobile supaya 4
             tab membagi rata lebar layar (lebih mudah ditap oleh
             pengguna lanjut usia) dan tetap muat dalam 1 baris
             tanpa ke-cut. Pada sm+ kembali ke `flex` dengan lebar
             auto dan label lebih panjang. Ikon di-sembunyikan di
             mobile supaya ruang untuk label + count lebih lega. -->
        <div class="flex items-stretch gap-1.5 sm:gap-1.5">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            type="button"
            class="flex-1 sm:flex-none h-12 sm:h-9 px-1.5 sm:px-3 rounded-xl sm:rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 border whitespace-nowrap"
            :class="statusFilter === tab.key
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'"
            @click="statusFilter = tab.key"
          >
            <i :class="tab.icon" class="hidden sm:inline text-xs shrink-0" />
            <span class="truncate sm:hidden">{{ tab.shortLabel }}</span>
            <span class="truncate hidden sm:inline">{{ tab.label }}</span>
            <span
              class="px-1 sm:px-1.5 py-0.5 rounded-md text-[10px] font-extrabold min-w-[18px] sm:min-w-[22px] text-center shrink-0"
              :class="statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'"
            >
              {{ countByStatus[tab.key] }}
            </span>
          </button>
        </div>
      </div>

      <!-- ============ Success Banner (auto-dismiss 4s) ============ -->
      <div
        v-if="successMessage"
        role="status"
        aria-live="polite"
        class="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-start justify-between gap-3"
      >
        <div class="flex items-start gap-2">
          <i class="fa-solid fa-circle-check text-emerald-600 mt-0.5" />
          <span class="font-semibold">{{ successMessage }}</span>
        </div>
        <button
          type="button"
          class="text-emerald-600 hover:text-emerald-800 transition-colors"
          aria-label="Tutup notifikasi"
          @click="dismissSuccess"
        >
          <i class="fa-solid fa-xmark" />
        </button>
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
            <!-- Mobile: card view. Dirancang untuk pengguna
                 lanjut usia — font 16px, sentuh 48px+, label
                 jelas di setiap tombol, dan tata letak vertikal
                 yang tidak sempit. -->
            <div class="md:hidden p-1 space-y-4">
              <!-- Header: avatar besar + judul + status. Avatar
                   64px (w-16 h-16) supaya jelas dari jauh. Judul
                   16px (text-base) lebih mudah dibaca. -->
              <div class="flex gap-4">
                <div class="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0 relative border-2 border-slate-200">
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
                    <i class="fa-solid fa-image text-lg" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                    {{ event.title }}
                  </h3>
                  <div class="mt-1.5">
                    <span
                      :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', statusStyle(event.status).badge]"
                    >
                      <span :class="['w-2 h-2 rounded-full', statusStyle(event.status).dot]" />
                      {{ statusStyle(event.status).label }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Meta: dibungkus kartu dengan background supaya
                   tidak tercerai-berai. Font 14px (text-sm) dan icon
                   16px (w-4) lebih jelas di mobile. -->
              <div class="bg-slate-50 rounded-xl p-3 space-y-2 text-sm text-slate-700">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-calendar text-emerald-600 w-4 text-center shrink-0" />
                  <span class="truncate">
                    <span class="font-bold text-slate-800">{{ formatDay(event.date) }}</span>
                    <span class="text-slate-500"> · {{ formatTime(event.date) }} WIB</span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-location-dot text-rose-500 w-4 text-center shrink-0" />
                  <span class="truncate">{{ event.location }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-tag text-emerald-600 w-4 text-center shrink-0" />
                  <span class="truncate">
                    {{ categoryNameFor(event.categoryId) ?? 'Tanpa kategori' }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-user-group text-slate-500 w-4 text-center shrink-0" />
                  <span>
                    Kuota
                    <span class="font-bold text-slate-800">{{ event.quota }}</span>
                    slot
                  </span>
                </div>
              </div>

              <!-- Action stack: tombol full-width dalam 2 baris
                   grid. Tinggi 48px (h-12) sesuai standar touch
                   target. Setiap tombol punya border-2 + label teks
                   supaya jelas & tidak salah pencet. -->
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="relative h-12 px-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  title="Lihat & kelola peserta"
                  @click="openParticipants(event)"
                >
                  <i class="fa-solid fa-users" />
                  <span>Peserta</span>
                  <span
                    v-if="regStore.participantsByEvent[event.id]?.length"
                    class="min-w-[20px] h-5 px-1.5 bg-indigo-600 text-white text-xs font-extrabold rounded-full flex items-center justify-center"
                  >
                    {{ regStore.participantsByEvent[event.id].length }}
                  </span>
                </button>
                <button
                  type="button"
                  class="h-12 px-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  title="Edit event"
                  :disabled="store.isSubmitting"
                  @click="openEdit(event)"
                >
                  <i class="fa-solid fa-pen-to-square" />
                  <span>Edit</span>
                </button>
                <button
                  v-if="event.status === 'Aktif' || event.status === 'Dibatalkan'"
                  type="button"
                  class="h-12 px-3 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  :title="event.status === 'Aktif' ? 'Nonaktifkan event' : 'Aktifkan event'"
                  :disabled="store.isSubmitting"
                  @click="handleToggleStatus(event)"
                >
                  <i :class="event.status === 'Aktif' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left'" />
                  <span>{{ event.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan' }}</span>
                </button>
                <button
                  type="button"
                  class="h-12 px-3 rounded-xl border-2 border-rose-200 bg-rose-50 text-rose-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  title="Hapus event"
                  @click="handleDelete(event)"
                >
                  <i class="fa-solid fa-trash-can" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ Pagination ============
           Tombol lebih besar di mobile (min-h-12) supaya
           nyaman untuk pengguna lanjut usia. -->
      <div
        v-if="shouldShowPagination"
        class="flex items-center justify-center gap-3 pt-2"
      >
        <button
          :disabled="!store.pagination.hasPrevPage"
          class="min-h-[48px] min-w-[48px] px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 active:scale-[0.98] transition-all"
          @click="changePage(store.pagination.page - 1)"
        >
          <i class="fa-solid fa-chevron-left text-xs" />
          <span class="hidden sm:inline">Sebelumnya</span>
        </button>
        <div class="text-sm font-semibold text-slate-600 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
          Halaman <span class="text-emerald-700 font-extrabold">{{ store.pagination.page }}</span>
          dari <span class="font-bold text-slate-800">{{ store.pagination.totalPages }}</span>
        </div>
        <button
          :disabled="!store.pagination.hasNextPage"
          class="min-h-[48px] min-w-[48px] px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 active:scale-[0.98] transition-all"
          @click="changePage(store.pagination.page + 1)"
        >
          <span class="hidden sm:inline">Berikutnya</span>
          <i class="fa-solid fa-chevron-right text-xs" />
        </button>
      </div>
    </section>

    <DashboardAddEventModal v-model="showAddModal" @created="onCreated" @success="onCreateSuccess" />
    <DashboardEditEventModal v-model="showEditModal" :event="editingEvent" @updated="onUpdated" />
    <DashboardEventParticipantsModal v-model="showParticipantsModal" :event="participantsEvent" />
  </DashboardShell>
</template>
