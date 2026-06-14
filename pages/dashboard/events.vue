<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useAppStore } from '~/presentation/stores/app'
import type { Event } from '~/domain/entities/event'
import type { EventStatusValue } from '~/types/common'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useDashboardStore()
const appStore = useAppStore()
const config = useRuntimeConfig()

const showAddModal = ref(false)
const searchQuery = ref('')
const imageLoadMap = ref<Record<string, boolean>>({})

// Daftar menu navigasi dashboard. URL masing-masing sudah terpisah.
const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
]

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

function formatShortDate(iso: string): string {
  if (!iso) return ''
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }
  return new Date(iso).toLocaleDateString('id-ID', options)
}

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

function onCreated(): void {
  store.fetchEvents()
}

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
          <h2 class="font-extrabold text-2xl text-slate-900">Kelola Event Komunitas</h2>
          <p class="text-xs text-slate-500">Kelola semua event komunitas dari satu tempat.</p>
        </div>
        <UiAppButton @click="openAdd">
          <i class="fa-solid fa-plus-circle" /> Buat Event Baru
        </UiAppButton>
      </header>

      <!-- Search -->
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
    </section>

    <DashboardAddEventModal v-model="showAddModal" @created="onCreated" />
  </DashboardShell>
</template>
