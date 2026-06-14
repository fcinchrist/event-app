<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useAppStore } from '~/presentation/stores/app'
import type { OccupancyItem } from '~/components/dashboard/OccupancyList.vue'
import type { ActivityLog } from '~/components/dashboard/RecentActivity.vue'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useDashboardStore()
const appStore = useAppStore()
const config = useRuntimeConfig()

const showAddModal = ref(false)

// Daftar menu navigasi dashboard. URL masing-masing sudah terpisah
// sehingga bisa di-bookmark & di-share langsung.
const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
]

function formatCheckInTimestamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function openAdd(): void {
  showAddModal.value = true
}

function onCreated(): void {
  store.fetchEvents()
}

const kpi = computed(() => {
  const totalEvents = store.events.length
  const totalReservations = appStore.bookings.length
  const presentCount = appStore.bookings.filter((b) => b.status === 'Hadir').length
  const absentCount = totalReservations - presentCount
  const percent = totalReservations > 0 ? Math.round((presentCount / totalReservations) * 100) : 0
  return { totalEvents, totalReservations, presentCount, absentCount, percent }
})

const occupancyItems = computed<OccupancyItem[]>(() => {
  return store.events.slice(0, 5).map((e) => ({
    id: e.id,
    title: e.title,
    taken: appStore.bookings.filter((b) => b.eventId === e.id).length,
    quota: e.quota,
  }))
})

const recentActivity = computed<ActivityLog[]>(() => {
  const eventTitleMap = new Map<string, string>(
    appStore.events.map((e) => [e.id, e.title]),
  )
  return appStore.bookings
    .filter((b) => b.status === 'Hadir')
    .slice(-5)
    .reverse()
    .map((b) => ({
      id: b.id,
      name: b.name,
      eventTitle: eventTitleMap.get(b.eventId) ?? 'Event tidak diketahui',
      checkInTime: formatCheckInTimestamp(),
    }))
})

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  await store.fetchEvents()
})
</script>

<template>
  <DashboardShell :items="NAV_ITEMS" section-label="Panel Operasional">
    <section class="space-y-6">
      <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
            <h2 class="font-extrabold text-2xl text-emerald-700">Ringkasan Dashboard</h2>
          </div>
          <p class="text-xs text-slate-500">
            Statistik dan agenda terbaru komunitas {{ config.public.companyName }}.
          </p>
        </div>
        <UiAppButton variant="primary" @click="openAdd">
          <i class="fa-solid fa-plus-circle" /> Buat Event Baru
        </UiAppButton>
      </header>

      <!-- KPI: 4 kartu emerald, atau skeleton saat loading -->
      <DashboardKpiSkeleton v-if="store.isLoading" />
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStatCard
          label="Total Event Aktif"
          :value="kpi.totalEvents"
          icon="fa-solid fa-calendar"
          tone="emerald"
          hint="Terdaftar di sistem"
          hint-icon="fa-solid fa-calendar"
        />
        <DashboardStatCard
          label="Total Reservasi"
          :value="kpi.totalReservations"
          icon="fa-solid fa-ticket"
          tone="emerald"
          hint="Akumulasi semua event"
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
          hint="Tingkat kehadiran global"
          hint-icon="fa-solid fa-percent"
        />
      </div>

      <!-- Charts Row: skeleton untuk donut + occupancy saat loading -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardDonutChart
          v-if="store.isLoading"
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

        <!-- Occupancy skeleton: 5 baris bar dengan label + value -->
        <div
          v-if="store.isLoading"
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

      <!-- Recent Activity: skeleton untuk list check-in -->
      <div
        v-if="store.isLoading"
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
