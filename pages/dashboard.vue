<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import type { Event } from '~/domain/entities/event'
import type { EventStatusValue } from '~/types/common'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useDashboardStore()
const config = useRuntimeConfig()

const activeTab = ref<'ringkasan' | 'event-list'>('ringkasan')
const showAddModal = ref(false)
const searchQuery = ref('')
const imageLoadMap = ref<Record<string, boolean>>({})

const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line' },
  { key: 'event-list', label: 'Event List', icon: 'fa-solid fa-list-check' },
] as const

// Pemetaan status → label + kelas tailwind untuk badge
const STATUS_STYLES: Record<EventStatusValue, { label: string; badge: string; icon: string }> = {
  Aktif: {
    label: 'Aktif',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: 'fa-solid fa-circle-check',
  },
  Dibatalkan: {
    label: 'Dibatalkan',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: 'fa-solid fa-circle-xmark',
  },
  Selesai: {
    label: 'Selesai',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: 'fa-solid fa-circle-check',
  },
}

function statusStyle(status: EventStatusValue): { label: string; badge: string; icon: string } {
  return STATUS_STYLES[status] ?? STATUS_STYLES.Aktif
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }
  return new Date(iso).toLocaleDateString('id-ID', options)
}

function formatShortDate(iso: string): string {
  if (!iso) return ''
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }
  return new Date(iso).toLocaleDateString('id-ID', options)
}

function slotsTaken(eventId: string): number {
  return store.events.filter((e) => e.id === eventId).length
}

const stats = computed(() => {
  const total = store.events.length
  const upcoming = store.events.filter((e) => new Date(e.date) > new Date()).length
  const totalQuota = store.events.reduce((sum, e) => sum + e.quota, 0)
  return {
    total,
    upcoming,
    totalQuota,
    avgQuota: total ? Math.round(totalQuota / total) : 0,
  }
})

const recentEvents = computed(() => store.events.slice(0, 5))

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    store.setSearch(searchQuery.value)
    store.fetchEvents()
  }, 350)
}

function changePage(page: number): void {
  store.setPage(page)
  store.fetchEvents()
}

async function handleDelete(event: Event): Promise<void> {
  if (!confirm(`Hapus event "${event.title}"?`)) return
  const result = await store.deleteEvent(event.id)
  if (!result.success) {
    alert(result.error ?? 'Gagal menghapus event.')
  }
}

async function handleToggleStatus(event: Event): Promise<void> {
  const nextStatus: EventStatusValue = event.status === 'Aktif' ? 'Dibatalkan' : 'Aktif'
  const actionLabel = nextStatus === 'Dibatalkan' ? 'Batalkan' : 'Aktifkan kembali'
  const confirmMsg = nextStatus === 'Dibatalkan'
    ? `Batalkan event "${event.title}"? Event akan disembunyikan dari publik.`
    : `Aktifkan kembali event "${event.title}"?`
  if (!confirm(confirmMsg)) return
  const result = await store.updateEventStatus(event.id, nextStatus)
  if (!result.success) {
    alert(result.error ?? 'Gagal memperbarui status event.')
  }
}

function getNextStatusLabel(current: EventStatusValue): string {
  return current === 'Aktif' ? 'Batalkan' : 'Aktifkan'
}

function getNextStatusVariant(current: EventStatusValue): 'danger' | 'primary' {
  return current === 'Aktif' ? 'danger' : 'primary'
}

function openAdd(): void {
  showAddModal.value = true
}

function onCreated(eventId: string): void {
  if (activeTab.value !== 'event-list') {
    activeTab.value = 'event-list'
  }
  // Refresh list agar data terbaru konsisten dengan server
  store.fetchEvents()
}

onMounted(() => {
  store.fetchEvents()
})
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-8">
    <!-- Sidebar -->
    <DashboardDashboardSidebar v-model="activeTab" :items="NAV_ITEMS" />

    <!-- Content -->
    <div class="flex-grow min-w-0 space-y-6">
      <!-- ============================================ -->
      <!-- Tab: Ringkasan Dashboard                     -->
      <!-- ============================================ -->
      <div v-if="activeTab === 'ringkasan'" class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 class="font-extrabold text-2xl text-slate-900">Ringkasan Dashboard</h2>
            <p class="text-xs text-slate-500">Statistik dan agenda terbaru komunitas {{ config.public.companyName }}.</p>
          </div>
          <UiAppButton @click="openAdd">
            <i class="fa-solid fa-plus-circle" /> Buat Event Baru
          </UiAppButton>
        </div>

        <!-- KPI -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-slate-400 text-xs font-bold uppercase">Total Event</div>
            <div class="text-2xl font-black text-slate-950 mt-1">{{ stats.total }}</div>
            <div class="text-[10px] text-emerald-600 mt-1 font-semibold">
              <i class="fa-solid fa-calendar" /> Terdaftar di sistem
            </div>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-slate-400 text-xs font-bold uppercase">Event Akan Datang</div>
            <div class="text-2xl font-black text-slate-950 mt-1">{{ stats.upcoming }}</div>
            <div class="text-[10px] text-emerald-600 mt-1 font-semibold">
              <i class="fa-solid fa-arrow-trend-up" /> Siap diselenggarakan
            </div>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-slate-400 text-xs font-bold uppercase">Total Kapasitas</div>
            <div class="text-2xl font-black text-slate-950 mt-1">{{ stats.totalQuota }}</div>
            <div class="text-[10px] text-indigo-600 mt-1 font-semibold">Slot peserta akumulasi</div>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-slate-400 text-xs font-bold uppercase">Rata-rata Kuota</div>
            <div class="text-2xl font-black text-slate-950 mt-1">{{ stats.avgQuota }}</div>
            <div class="text-[10px] text-slate-500 mt-1 font-semibold">Per event</div>
          </div>
        </div>

        <!-- Event Terbaru -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-bold text-slate-900 text-base">Event Terbaru</h3>
              <p class="text-xs text-slate-500">5 agenda yang paling baru ditambahkan.</p>
            </div>
            <button
              class="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              @click="activeTab = 'event-list'"
            >
              Lihat semua <i class="fa-solid fa-arrow-right text-[10px]" />
            </button>
          </div>

          <div v-if="store.isLoading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-16 bg-slate-100 rounded-xl animate-pulse" />
          </div>

          <div v-else-if="recentEvents.length === 0" class="py-10 text-center text-slate-400 text-sm">
            Belum ada event. Buat event pertama Anda.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="event in recentEvents"
              :key="event.id"
              class="py-3 flex items-center gap-4"
            >
              <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <img
                  v-if="event.image"
                  :src="event.image"
                  :alt="event.title"
                  class="w-full h-full object-cover"
                >
                <div v-else class="w-full h-full flex items-center justify-center text-slate-300">
                  <i class="fa-solid fa-image" />
                </div>
              </div>
              <div class="flex-grow min-w-0">
                <p class="font-bold text-slate-900 text-sm truncate">{{ event.title }}</p>
                <p class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <i class="fa-solid fa-calendar text-slate-400" />
                  {{ formatShortDate(event.date) }}
                </p>
              </div>
              <span class="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full shrink-0">
                Kuota {{ event.quota }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- Tab: Event List                             -->
      <!-- ============================================ -->
      <div v-if="activeTab === 'event-list'" class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 class="font-extrabold text-2xl text-slate-900">Daftar Event</h2>
            <p class="text-xs text-slate-500">Kelola semua event komunitas dari satu tempat.</p>
          </div>
          <UiAppButton @click="openAdd">
            <i class="fa-solid fa-plus-circle" /> Buat Event Baru
          </UiAppButton>
        </div>

        <!-- Search & Filter -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3">
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-grow min-w-[200px]">
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

        <!-- Error -->
        <div v-if="store.error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
          <i class="fa-solid fa-circle-exclamation" /> {{ store.error }}
        </div>

        <!-- Loading -->
        <div v-if="store.isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex">
            <div class="w-32 h-32 bg-slate-100 animate-pulse shrink-0" />
            <div class="p-4 flex-grow space-y-2">
              <div class="h-3 w-1/4 bg-slate-200 rounded animate-pulse" />
              <div class="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div class="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div
          v-else-if="store.events.length === 0"
          class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm"
        >
          <div class="bg-slate-100 text-slate-400 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i class="fa-solid fa-calendar-xmark text-2xl" />
          </div>
          <h4 class="font-bold text-slate-800 text-lg">Belum Ada Event</h4>
          <p class="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Mulai dengan membuat event pertama untuk komunitas Anda.
          </p>
          <UiAppButton class="mt-5" @click="openAdd">
            <i class="fa-solid fa-plus-circle" /> Buat Event Pertama
          </UiAppButton>
        </div>

        <!-- Event Cards -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="event in store.events"
            :key="event.id"
            class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex"
          >
            <div class="w-32 h-32 shrink-0 bg-slate-100 relative">
              <div
                v-if="!imageLoadMap[event.id] && event.image"
                class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100"
              />
              <img
                v-if="event.image"
                :src="event.image"
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
                <i class="fa-solid fa-image text-2xl" />
              </div>
            </div>
            <div class="p-4 flex-grow flex flex-col justify-between min-w-0">
              <div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    ID: {{ event.id.slice(0, 8) }}
                  </span>
                  <span
                    :class="['border text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1', statusStyle(event.status).badge]"
                  >
                    <i :class="statusStyle(event.status).icon" />
                    {{ statusStyle(event.status).label }}
                  </span>
                </div>
                <h3 class="font-bold text-slate-900 text-sm mt-1.5 truncate">
                  {{ event.title }}
                </h3>
                <p class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <i class="fa-solid fa-calendar text-slate-400" />
                  {{ formatShortDate(event.date) }}
                </p>
                <p class="text-[10px] text-slate-500 mt-1 flex items-center gap-1 truncate">
                  <i class="fa-solid fa-location-dot text-slate-400" />
                  {{ event.location }}
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-3">
                <div class="text-[11px] text-slate-500 font-medium">
                  <i class="fa-solid fa-user-group text-slate-400" />
                  Kuota: {{ event.quota }}
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <UiAppButton
                    :variant="getNextStatusVariant(event.status)"
                    size="sm"
                    :disabled="store.isSubmitting"
                    @click="handleToggleStatus(event)"
                  >
                    <i :class="event.status === 'Aktif' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left'" />
                    {{ getNextStatusLabel(event.status) }}
                  </UiAppButton>
                  <UiAppButton variant="danger" size="sm" @click="handleDelete(event)">
                    <i class="fa-solid fa-trash-can" /> Hapus
                  </UiAppButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div
          v-if="!store.isLoading && store.pagination.totalPages > 1"
          class="flex items-center justify-center gap-2 pt-4"
        >
          <button
            :disabled="!store.pagination.hasPrevPage"
            class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
            @click="changePage(store.pagination.page - 1)"
          >
            <i class="fa-solid fa-chevron-left text-xs" />
          </button>
          <div class="text-xs font-semibold text-slate-600">
            Halaman <span>{{ store.pagination.page }}</span> dari <span>{{ store.pagination.totalPages }}</span>
          </div>
          <button
            :disabled="!store.pagination.hasNextPage"
            class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
            @click="changePage(store.pagination.page + 1)"
          >
            <i class="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      </div>
    </div>

    <!-- Add Event Modal -->
    <DashboardAddEventModal v-model="showAddModal" @created="onCreated" />
  </div>
</template>
