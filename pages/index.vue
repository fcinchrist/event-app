<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

definePageMeta({
  layout: 'default',
})

const store = useAppStore()

const SKELETON_COUNT = 6

function handleDeleteEvent(eventId: string): void {
  if (confirm('Apakah Anda yakin ingin menghapus event ini? Semua data pendaftar pada event terkait juga akan ikut terhapus.')) {
    store.deleteEvent(eventId)
  }
}

function handleOpenAddEvent(): void {
  store.openAddEventModal()
}
</script>

<template>
  <div class="space-y-8">
    <!-- Hero Banner -->
    <EventHeroBanner />

    <!-- Filter Bar -->
    <EventFilter @open-add-event="handleOpenAddEvent" />

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
        @delete-event="handleDeleteEvent"
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
          Tidak ditemukan agenda kegiatan yang cocok dengan filter pencarian Anda. Coba ubah filter atau periode pencarian.
        </p>
        <button
          class="mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          @click="store.clearDateFilter()"
        >
          <i class="fa-solid fa-rotate-left" /> Reset Filter
        </button>
      </div>
    </div>

    <!-- Pagination -->
    <UiPagination v-if="!store.isLoading" />

    <!-- Add Event Modal -->
    <EventAddEventModal />
  </div>
</template>
