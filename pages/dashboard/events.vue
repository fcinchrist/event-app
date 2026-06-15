<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import type { Event } from '~/domain/entities/event'
import type { EventStatusValue } from '~/types/common'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useDashboardStore()
const appStore = useAppStore()
const regStore = useRegistrationStore()
const config = useRuntimeConfig()

const showAddModal = ref(false)
const showEditModal = ref(false)
const showParticipantsModal = ref(false)
const participantsEvent = ref<Event | null>(null)
const editingEvent = ref<Event | null>(null)
const searchQuery = ref('')
const imageLoadMap = ref<Record<string, boolean>>({})

// Daftar menu navigasi dashboard. URL masing-masing sudah terpisah.
const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

// Filter tab di atas tabel
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

// List yang ditampilkan (filter lokal, server tetap paginasi global)
const filteredEvents = computed<Event[]>(() => {
  if (statusFilter.value === 'all') return store.events
  return store.events.filter((e) => e.status === statusFilter.value)
})

// Counter untuk tab
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

const TABS: { key: StatusFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'Semua', icon: 'fa-solid fa-layer-group' },
  { key: 'Aktif', label: 'Aktif', icon: 'fa-solid fa-circle-check' },
  { key: 'Dibatalkan', label: 'Dibatalkan', icon: 'fa-solid fa-circle-xmark' },
  { key: 'Selesai', label: 'Selesai', icon: 'fa-solid fa-flag-checkered' },
]

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
  if (!confirm(`Hapus event "${event.title}"? Tindakan ini tidak dapat dibatalkan.`)) return
  const result = await store.deleteEvent(event.id)
  if (!result.success) {
    alert(result.error ?? 'Gagal menghapus event.')
  }
}

async function handleToggleStatus(event: Event): Promise<void> {
  const nextStatus: EventStatusValue = event.status === 'Aktif' ? 'Dibatalkan' : 'Aktif'
  const confirmMsg = nextStatus === 'Dibatalkan'
    ? `Nonaktifkan event "${event.title}"? Event akan disembunyikan dari publik.`
    : `Aktifkan kembali event "${event.title}"?`
  if (!confirm(confirmMsg)) return
  const result = await store.updateEventStatus(event.id, nextStatus)
  if (!result.success) {
    alert(result.error ?? 'Gagal memperbarui status event.')
  }
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
  // store sudah update state.events secara reaktif
}

function openAdd(): void {
  showAddModal.value = true
}

function onCreated(): void {
  store.fetchEvents()
  // Refresh participants count untuk semua event
  Promise.all(
    store.events.map((e) => regStore.fetchParticipants(e.id)),
  )
}

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  await store.fetchEvents()
  // Pre-fetch participants count untuk badge tombol "Lihat Peserta"
  await Promise.all(
    store.events.map((e) => regStore.fetchParticipants(e.id)),
  )
})
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
        </div>
        <UiAppButton variant="primary" @click="openAdd">
          <i class="fa-solid fa-plus-circle" /> Buat Event Baru
        </UiAppButton>
      </header>

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

      <!-- ============ Empty karena filter ============ -->
      <div
        v-else-if="filteredEvents.length === 0"
        class="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm"
      >
        <div class="bg-slate-100 text-slate-400 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i class="fa-solid fa-filter-circle-xmark text-xl" />
        </div>
        <h4 class="font-bold text-slate-800 text-base">Tidak ada event dengan filter ini</h4>
        <p class="text-xs text-slate-500 mt-1">
          Coba pilih tab lain atau ubah kata kunci pencarian.
        </p>
      </div>

      <!-- ============ Tabel Event (rapih & menarik) ============ -->
      <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Header Tabel (desktop only) -->
        <div class="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
          <div class="col-span-4">Event</div>
          <div class="col-span-2">Tanggal</div>
          <div class="col-span-2">Lokasi</div>
          <div class="col-span-1 text-center">Kuota</div>
          <div class="col-span-1 text-center">Status</div>
          <div class="col-span-2 text-right">Aksi</div>
        </div>

        <!-- Rows -->
        <div class="divide-y divide-slate-100">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            class="p-4 md:px-5 md:py-3 hover:bg-slate-50/60 transition-colors"
          >
            <!-- Desktop: 1 baris grid -->
            <div class="hidden md:grid grid-cols-12 gap-3 items-center">
              <!-- Event: avatar + judul + id -->
              <div class="col-span-4 flex items-center gap-3 min-w-0">
                <div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative border border-slate-200">
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
              <div class="col-span-2 min-w-0">
                <div class="text-xs font-bold text-slate-700">
                  <i class="fa-solid fa-calendar text-emerald-500 mr-1" />
                  {{ formatDay(event.date) }}
                </div>
                <div class="text-[10px] text-slate-500 mt-0.5">
                  <i class="fa-regular fa-clock text-slate-400 mr-1" />
                  {{ formatTime(event.date) }} WIB
                </div>
              </div>

              <!-- Lokasi -->
              <div class="col-span-2 min-w-0">
                <p class="text-xs text-slate-700 truncate flex items-center gap-1">
                  <i class="fa-solid fa-location-dot text-rose-400 shrink-0" />
                  <span class="truncate">{{ event.location }}</span>
                </p>
              </div>

              <!-- Kuota -->
              <div class="col-span-1 text-center">
                <span class="text-xs font-extrabold text-slate-700">
                  {{ event.quota }}
                </span>
                <div class="text-[9px] text-slate-400 uppercase font-bold">Slot</div>
              </div>

              <!-- Status -->
              <div class="col-span-1 flex justify-center">
                <span
                  :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', statusStyle(event.status).badge]"
                >
                  <span :class="['w-1.5 h-1.5 rounded-full', statusStyle(event.status).dot]" />
                  {{ statusStyle(event.status).label }}
                </span>
              </div>

              <!-- Aksi -->
              <div class="col-span-2 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-all relative"
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
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-all"
                  title="Edit event"
                  :disabled="store.isSubmitting"
                  @click="openEdit(event)"
                >
                  <i class="fa-solid fa-pen-to-square text-xs" />
                </button>
                <button
                  v-if="event.status === 'Aktif' || event.status === 'Dibatalkan'"
                  type="button"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition-all"
                  :title="event.status === 'Aktif' ? 'Nonaktifkan event' : 'Aktifkan event'"
                  :disabled="store.isSubmitting"
                  @click="handleToggleStatus(event)"
                >
                  <i :class="event.status === 'Aktif' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left'" class="text-xs" />
                </button>
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-all"
                  title="Hapus event"
                  @click="handleDelete(event)"
                >
                  <i class="fa-solid fa-trash-can text-xs" />
                </button>
              </div>
            </div>

            <!-- Mobile: card view -->
            <div class="md:hidden flex gap-3">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative border border-slate-200">
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
                  <i class="fa-solid fa-image" />
                </div>
              </div>
              <div class="flex-grow min-w-0">
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
                <div class="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                  <div class="flex items-center gap-1.5 truncate">
                    <i class="fa-solid fa-calendar text-emerald-500 w-3 text-center" />
                    <span class="truncate">{{ formatShortDate(event.date) }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 truncate">
                    <i class="fa-solid fa-location-dot text-rose-400 w-3 text-center" />
                    <span class="truncate">{{ event.location }}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <i class="fa-solid fa-user-group text-slate-400 w-3 text-center" />
                    <span>Kuota {{ event.quota }} slot</span>
                  </div>
                </div>
                <div class="mt-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    class="flex-1 py-1.5 rounded-lg text-[11px] font-bold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all flex items-center justify-center gap-1"
                    @click="openParticipants(event)"
                  >
                    <i class="fa-solid fa-users" /> Peserta
                    <span
                      v-if="regStore.participantsByEvent[event.id]?.length"
                      class="ml-1 px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-extrabold"
                    >
                      {{ regStore.participantsByEvent[event.id].length }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="flex-1 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all flex items-center justify-center gap-1"
                    :disabled="store.isSubmitting"
                    @click="openEdit(event)"
                  >
                    <i class="fa-solid fa-pen-to-square" /> Edit
                  </button>
                  <button
                    v-if="event.status === 'Aktif' || event.status === 'Dibatalkan'"
                    type="button"
                    class="flex-1 py-1.5 rounded-lg text-[11px] font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all flex items-center justify-center gap-1"
                    :disabled="store.isSubmitting"
                    @click="handleToggleStatus(event)"
                  >
                    <i :class="event.status === 'Aktif' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left'" />
                    {{ event.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan' }}
                  </button>
                  <button
                    type="button"
                    class="py-1.5 px-2.5 rounded-lg text-[11px] font-bold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all flex items-center justify-center gap-1"
                    @click="handleDelete(event)"
                  >
                    <i class="fa-solid fa-trash-can" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ Pagination ============ -->
      <div
        v-if="!store.isLoading && store.pagination.totalPages > 1"
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
