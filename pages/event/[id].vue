<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import { useEventCategoryStore } from '~/presentation/stores/event-category'
import { resolveEventImage } from '~/utils/event-image'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const store = useAppStore()
const regStore = useRegistrationStore()
const categoryStore = useEventCategoryStore()

// Local loading state for the detail page. `true` until the event has
// been set (handles deep-link / refresh) or the store fetch completes.
const isLoadingDetail = ref(true)
const imageErrored = ref(false)

// Resolve the cover URL via the helper so events without a cover
// automatically get the fallback from
// `NUXT_PUBLIC_DEFAULT_EVENT_IMAGE`.
const coverSrc = computed(() => resolveEventImage(store.selectedEvent?.image))
const showCover = computed(() => coverSrc.value.length > 0 && !imageErrored.value)

const eventId = computed(() => String(route.params.id))

async function ensureEventLoaded(id: string): Promise<void> {
  isLoadingDetail.value = true
  try {
    // For deep-link / refresh: if the event list isn't loaded yet (or
    // the requested event is not in the cache), fetch from Supabase
    // first. Without this, the page would show "Event Tidak Ditemukan"
    // even when the event actually exists.
    if (store.events.length === 0) {
      await store.fetchEvents()
    }
    store.setSelectedEventById(id)
    // Pre-fetch participants for this event so the list and the quota
    // counter stay in sync.
    if (id) {
      void regStore.fetchParticipants(id)
    }
    // Lazy-load categories so the category pill on this page can
    // resolve `event.categoryId` to its name. No-op if already loaded.
    void categoryStore.fetchCategories()
  } finally {
    isLoadingDetail.value = false
  }
}

// Resolve the category name for the currently selected event. Returns
// `null` when the event has no category so the template can hide the
// pill entirely. Uses the cached `byId` map for O(1) lookup.
const categoryName = computed<string | null>(() => {
  const id = store.selectedEvent?.categoryId
  if (!id) return null
  return categoryStore.byId[id]?.name ?? null
})

onMounted(() => {
  void ensureEventLoaded(eventId.value)
})

watch(eventId, (newId) => {
  void ensureEventLoaded(newId)
})

// Reset the error state every time the event changes — otherwise an
// error from the previous event would trigger the placeholder for the
// new event, even though it actually has a valid image.
watch(
  () => store.selectedEvent?.id,
  () => {
    imageErrored.value = false
  },
)
</script>

<template>
  <!-- Loading skeleton: shown on first load, refresh, and deep-link -->
  <EventDetailSkeleton v-if="isLoadingDetail" />

  <div v-else class="space-y-8">
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors"
    >
      <i class="fa-solid fa-arrow-left" /> Kembali ke Daftar Event
    </NuxtLink>

    <!-- Event Not Found -->
    <div
      v-if="!store.selectedEvent && !store.isLoading"
      class="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden"
    >
      <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div class="bg-slate-100 text-slate-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
          <i class="fa-solid fa-calendar-xmark text-2xl" />
        </div>
        <h4 class="font-bold text-slate-800 text-lg">Event Tidak Ditemukan</h4>
        <p class="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
          Event yang Anda cari tidak ditemukan atau telah dihapus.
        </p>
        <NuxtLink
          to="/"
          class="mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
        >
          <i class="fa-solid fa-arrow-left" /> Kembali ke Daftar Event
        </NuxtLink>
      </div>
    </div>

    <!-- Event Detail -->
    <div v-else-if="store.selectedEvent" class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <!-- Main Content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Event Info Card -->
        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="h-64 sm:h-80 bg-slate-100 relative overflow-hidden">
            <div class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            <img
              v-if="showCover"
              :src="coverSrc"
              alt="Cover"
              class="w-full h-full object-cover relative z-10"
              @load="($event.target as HTMLImageElement).previousElementSibling?.classList.add('hidden')"
              @error="imageErrored = true"
            >
            <div v-else class="absolute inset-0 z-10 flex items-center justify-center text-slate-300">
              <i class="fa-regular fa-image text-6xl" />
            </div>
            <div class="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-xl text-xs font-bold text-white">
              {{ store.getEventStatusBadge(store.selectedEvent.date) }}
            </div>
          </div>
          <div class="p-6 sm:p-8 space-y-4">
            <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {{ store.selectedEvent.title }}
            </h2>
            <span
              v-if="categoryName"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider"
            >
              <i class="fa-solid fa-tag text-[11px]" />
              {{ categoryName }}
            </span>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-y border-slate-100 py-4 my-2">
              <div class="flex items-center gap-3">
                <div class="bg-slate-100 text-slate-600 p-2.5 rounded-xl">
                  <i class="fa-solid fa-calendar text-base" />
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase">Waktu Pelaksanaan</p>
                  <p class="font-semibold text-slate-800">{{ store.formatDate(store.selectedEvent.date) }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="bg-slate-100 text-slate-600 p-2.5 rounded-xl">
                  <i class="fa-solid fa-location-dot text-base" />
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase">Lokasi/Tempat</p>
                  <p class="font-semibold text-slate-800">{{ store.selectedEvent.location }}</p>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <h4 class="font-bold text-slate-900 text-sm">Deskripsi Kegiatan</h4>
              <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {{ store.selectedEvent.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Participants List -->
        <AttendanceParticipantList />
      </div>

      <!-- Sidebar -->
      <div class="space-y-6 lg:sticky lg:top-24">
        <EventBookingForm />
      </div>
    </div>
  </div>
</template>
