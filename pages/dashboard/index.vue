<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import { usePeriodQuerySync } from '~/presentation/composables/useUrlQuerySync'
import type { OccupancyItem } from '~/components/dashboard/OccupancyList.vue'
import type { ActivityLog } from '~/components/dashboard/RecentActivity.vue'
import type { RegistrationWithUserAndEvent } from '~/domain/repositories/registration-repository'
import type { RegistrationStatus } from '~/domain/entities/registration'
import type { DashboardPeriodFilter } from '~/presentation/stores/dashboard'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useDashboardStore()
const appStore = useAppStore()
const regStore = useRegistrationStore()
const config = useRuntimeConfig()

const showAddModal = ref(false)

// Filter periode dibuat collapsible di mobile supaya tidak mepet
// ke KPI cards. Default tertutup — tap untuk buka.
const showPeriodFilter = ref(false)
function togglePeriodFilter(): void {
  showPeriodFilter.value = !showPeriodFilter.value
}

// Dashboard navigation menu. Each URL is independent so they can be
// bookmarked and shared directly.
const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'categories', label: 'Master Kategori', icon: 'fa-solid fa-tags', to: '/dashboard/categories' },
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

function openAdd(): void {
  showAddModal.value = true
}

function onCreated(): void {
  store.fetchEvents()
}

/**
 * Source of truth untuk seluruh summary dashboard: data registrasi
 * yang sudah di-filter dengan `store.period`. Dipakai oleh KPI,
 * donut, occupancy, recent activity, dan attendance list.
 */
const periodRegistrations = computed<RegistrationWithUserAndEvent[]>(
  () => store.periodRegistrations,
)

function formatCheckInTimestamp(reg: RegistrationWithUserAndEvent): string {
  if (reg.checkinAt) {
    const d = new Date(reg.checkinAt)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  }
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const kpi = computed(() => {
  const list = periodRegistrations.value
  const totalEvents = new Set(list.map((r) => r.event.id)).size
  const totalReservations = list.length
  const presentCount = list.filter((b) => (b.status as RegistrationStatus) === 'Hadir').length
  const absentCount = totalReservations - presentCount
  const percent = totalReservations > 0 ? Math.round((presentCount / totalReservations) * 100) : 0
  return { totalEvents, totalReservations, presentCount, absentCount, percent }
})

/**
 * Okupansi dihitung dari event di periode aktif, dengan `taken`
 * dihitung dari registrasi di periode tersebut. Tampilkan SEMUA
 * event (bukan hanya 5 teratas) — pagination 5/halaman ditangani
 * di dalam komponen `<DashboardOccupancyList>` lewat prop
 * `page-size` (default 5). Paginasi di sisi komponen lebih
 * ringan dan tidak menambah round-trip ke server.
 */
const occupancyItems = computed<OccupancyItem[]>(() => {
  const list = periodRegistrations.value
  const events = store.periodEvents
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    taken: list.filter((r) => r.eventId === e.id).length,
    quota: e.quota,
  }))
})

const recentActivity = computed<ActivityLog[]>(() => {
  return periodRegistrations.value
    .filter((b) => (b.status as RegistrationStatus) === 'Hadir')
    .slice(-5)
    .reverse()
    .map((b) => ({
      id: b.id,
      name: b.user.nama,
      eventTitle: b.event.title,
      checkInTime: formatCheckInTimestamp(b),
    }))
})

/**
 * Label periode aktif, untuk ditampilkan di header & section attendance.
 *
 * - `all`  → "Semua Waktu"
 * - `day`  → "Hari: 16/06/2026" (format dd/mm/yyyy, sesuai spek UI)
 * - `year` → "Tahun: 2026"
 */
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

/**
 * Sinkronkan `store.period` ke query string URL (`?period=...&date=
 * ...&year=...`). Pakai computed wrapper supaya perubahan dari URL
 * (back/forward button) dan dari UI (period filter) tetap satu
 * sumber kebenaran di store.
 */
const periodRef = computed<DashboardPeriodFilter>({
  get: () => store.period,
  set: (v) => {
    void store.setPeriod({ mode: v.mode, date: v.date, year: v.year })
  },
})
usePeriodQuerySync(periodRef, { history: 'replace' })

/**
 * Handler yang dipanggil oleh `<DashboardPeriodFilter @apply>`.
 * Mutate `store.period` lewat `setPeriod()` (otomatis disinkronkan
 * ke URL oleh composable di atas).
 */
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

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  // Events dimuat terpisah (dipakai oleh master-event lookup, dll),
  // summary data utama di-fetch paralel via `periodRegistrations` +
  // `attendanceSummaries` di store.
  await Promise.all([
    store.fetchEvents(),
    store.fetchRegistrationsByPeriod(),
    store.fetchAttendance(),
  ])
})
</script>

<template>
  <DashboardShell :items="NAV_ITEMS" section-label="Panel Operasional">
    <section class="space-y-6">
      <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
            <h2 class="font-extrabold text-xl sm:text-2xl text-emerald-700">Ringkasan Dashboard</h2>
          </div>
          <p class="text-sm sm:text-xs text-slate-500">
            Statistik dan agenda terbaru komunitas {{ config.public.companyName }}.
          </p>
          <!-- Badge periode aktif (selalu terlihat di header) -->
          <div class="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm sm:text-[11px] font-semibold border border-emerald-200">
            <i class="fa-solid fa-filter" />
            Periode aktif: {{ periodLabel }}
          </div>
        </div>
        <button
          type="button"
          class="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-extrabold shadow-sm transition-all"
          @click="openAdd"
        >
          <i class="fa-solid fa-plus-circle" />
          <span>Buat Event Baru</span>
        </button>
      </header>

      <!-- Filter periode (collapsible di mobile supaya tidak mepet
           ke KPI). Default tertutup — tap untuk buka. Di desktop
           selalu terbuka. -->
      <div class="md:hidden">
        <button
          type="button"
          class="w-full min-h-[48px] flex items-center justify-between gap-2 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl active:scale-[0.99] transition-all"
          :aria-expanded="showPeriodFilter"
          @click="togglePeriodFilter"
        >
          <span class="flex items-center gap-2 text-sm font-bold text-slate-700">
            <i class="fa-solid fa-sliders text-emerald-600" />
            Filter Periode
            <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-200">
              {{ periodLabel }}
            </span>
          </span>
          <i
            :class="['fa-solid fa-chevron-down text-slate-500 transition-transform', showPeriodFilter ? 'rotate-180' : '']"
          />
        </button>
        <div v-show="showPeriodFilter" class="mt-3">
          <DashboardPeriodFilter
            :model-value="store.period"
            :is-loading="store.isRegistrationsLoading || store.isAttendanceLoading"
            @update:model-value="(v) => store.period = v"
            @apply="onApplyPeriod"
          />
        </div>
      </div>

      <!-- Filter periode (desktop) -->
      <div class="hidden md:block">
        <DashboardPeriodFilter
          :model-value="store.period"
          :is-loading="store.isRegistrationsLoading || store.isAttendanceLoading"
          @update:model-value="(v) => store.period = v"
          @apply="onApplyPeriod"
        />
      </div>

      <!-- KPI: 4 emerald cards, atau skeleton while loading.
           Di mobile pakai 2 kolom (bukan 1) supaya lebih ringkas
           dan proporsi kartu lebih pendek. -->
      <DashboardKpiSkeleton v-if="store.isRegistrationsLoading && store.periodRegistrations.length === 0" />
      <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DashboardStatCard
          label="Total Event"
          :value="kpi.totalEvents"
          icon="fa-solid fa-calendar"
          tone="emerald"
          :hint="`${periodLabel}`"
          hint-icon="fa-solid fa-calendar"
        />
        <DashboardStatCard
          label="Total Reservasi"
          :value="kpi.totalReservations"
          icon="fa-solid fa-ticket"
          tone="emerald"
          :hint="`Periode: ${periodLabel}`"
          hint-icon="fa-solid fa-arrow-trend-up"
        />
        <DashboardStatCard
          label="Anggota Hadir"
          :value="kpi.presentCount"
          icon="fa-solid fa-user-check"
          tone="emerald"
          :hint="`${kpi.absentCount} belum check-in`"
          hint-icon="fa-solid fa-user-clock"
        />
        <DashboardStatCard
          label="Persentase Kehadiran"
          :value="`${kpi.percent}%`"
          icon="fa-solid fa-chart-pie"
          tone="emerald"
          hint="Tingkat kehadiran pada periode"
          hint-icon="fa-solid fa-percent"
        />
      </div>

      <!-- Charts Row: skeleton for donut + occupancy while loading -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardDonutChart
          v-if="store.isRegistrationsLoading && store.periodRegistrations.length === 0"
          class="lg:col-span-1"
          :present-count="0"
          :absent-count="0"
        />
        <DashboardDonutChart
          v-else
          class="lg:col-span-1"
          :present-count="kpi.presentCount"
          :absent-count="kpi.absentCount"
        />

        <!-- Occupancy skeleton: 5 bar rows with label + value -->
        <div
          v-if="store.isRegistrationsLoading && store.periodRegistrations.length === 0"
          class="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <UiSkeletonBlock variant="bar" width="w-40" height="h-4" rounded="rounded" />
          <UiSkeletonBlock variant="bar" width="w-64" height="h-2.5" class="mt-2" />
          <div class="space-y-4 my-6">
            <div v-for="i in 5" :key="`occ-${i}`" class="space-y-1.5">
              <div class="flex justify-between">
                <UiSkeletonBlock variant="bar" width="w-2/3" height="h-3" />
                <UiSkeletonBlock variant="bar" width="w-16" height="h-3" />
              </div>
              <UiSkeletonBlock variant="bar" width="w-full" height="h-2.5" rounded="rounded-full" />
            </div>
          </div>
        </div>
        <DashboardOccupancyList
          v-else
          class="lg:col-span-2"
          :items="occupancyItems"
        />
      </div>

      <!-- Counting Kehadiran All Anggota (pakai filter periode yang sama) -->
      <DashboardAttendanceCountList
        :items="store.attendanceSummaries"
        :is-loading="store.isAttendanceLoading"
        :period-label="periodLabel"
      />

      <!-- Recent Activity: skeleton for the check-in list -->
      <div
        v-if="store.isRegistrationsLoading && store.periodRegistrations.length === 0"
        class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
      >
        <UiSkeletonBlock variant="bar" width="w-48" height="h-4" />
        <UiSkeletonBlock variant="bar" width="w-80" height="h-2.5" class="mt-2" />
        <div class="divide-y divide-slate-100 mt-4">
          <div v-for="i in 5" :key="`act-${i}`" class="py-3 flex items-center gap-3">
            <UiSkeletonBlock variant="circle" width="w-8" height="h-8" />
            <div class="flex-grow space-y-1.5 min-w-0">
              <UiSkeletonBlock variant="bar" width="w-1/3" height="h-3" />
              <UiSkeletonBlock variant="bar" width="w-2/3" height="h-2.5" />
            </div>
            <UiSkeletonBlock variant="bar" width="w-20" height="h-4" />
          </div>
        </div>
      </div>
      <DashboardRecentActivity v-else :logs="recentActivity" />
    </section>

    <DashboardAddEventModal v-model="showAddModal" @created="onCreated" />
  </DashboardShell>
</template>
