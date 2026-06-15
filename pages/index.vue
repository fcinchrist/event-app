<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'

definePageMeta({
  layout: 'default',
})

const store = useAppStore()
const regStore = useRegistrationStore()

const SKELETON_COUNT = 6

// Pre-fetch the participant count per event for the "X/Y Terisi" badge
// in the EventCard.
//
// Previously this page called `fetchParticipants` (a heavy query with
// the `user:event_users(*)` JOIN) just to count rows. That wasted
// bandwidth, and if a single row had a null user the old mapper threw
// an error that was caught and reset the cache to [], so the counter
// "suddenly dropped to 0" on every refresh.
//
// Now we use `fetchParticipantsCount` (a `SELECT count(*)` only, no
// JOIN) — lightweight, doesn't fail on orphaned rows, and error-safe
// (the existing cache is never wiped when a request fails).
//
// Important: we use `watch` (not just `onMounted`) because `store.events`
// may still be empty when the home page mounts — the `default.vue`
// layout that triggers `store.fetchEvents()` runs in parallel. Without
// the watch, if `store.events` is still `[]`, `Promise.all([])` finishes
// instantly without fetching anything and the counter stays stuck on
// the "—/N" placeholder forever.
const fetchedEventIds = new Set<string>()
async function syncEventCounts(): Promise<void> {
  const pending = store.events
    .map((e) => e.id)
    .filter((id) => id && !fetchedEventIds.has(id))
  if (pending.length === 0) return
  for (const id of pending) {
    fetchedEventIds.add(id)
    void regStore.fetchParticipantsCount(id)
  }
}

onMounted(() => {
  void syncEventCounts()
})
watch(
  () => store.events.map((e) => e.id).join('|'),
  () => {
    void syncEventCounts()
  },
)
</script>

<template>
  <div class="space-y-8">
    <!-- Hero Banner -->
    <EventHeroBanner />

    <!-- Filter Bar -->
    <EventFilter />

    <!-- Skeleton Loading Grid -->
    <div v-if="store.isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      <UiSkeletonCard
        v-for="i in SKELETON_COUNT"
        :key="`skeleton-${i}`"
      />
    </div>

    <!-- Event Grid -->
    <div v-else-if="store.paginatedEvents.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      <EventCard
        v-for="event in store.paginatedEvents"
        :key="event.id"
        :event="event"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden"
    >
      <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div class="bg-slate-100 text-slate-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
          <i class="fa-solid fa-calendar-xmark text-2xl" />
        </div>
        <h4 class="font-bold text-slate-800 text-lg">Tidak Ada Event</h4>
        <p class="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
          Tidak ditemukan agenda kegiatan yang cocok dengan filter pencarian Anda. Coba ubah filter, kategori, atau periode pencarian.
        </p>
        <button
          class="mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          @click="store.filterCategoryId = null; store.clearDateFilter()"
        >
          <i class="fa-solid fa-rotate-left" /> Reset Filter
        </button>
      </div>
    </div>

    <!-- Pagination -->
    <UiPagination v-if="!store.isLoading" />
  </div>
</template>
