<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const store = useAppStore()

const eventId = computed(() => String(route.params.id))

onMounted(() => {
  store.setSelectedEventById(eventId.value)
})

watch(eventId, (newId) => {
  store.setSelectedEventById(newId)
})
</script>

<template>
  <div class="space-y-8">
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
              :src="store.selectedEvent.image"
              alt="Cover"
              class="w-full h-full object-cover relative z-10"
              @load="($event.target as HTMLImageElement).previousElementSibling?.classList.add('hidden')"
            >
            <div class="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-xl text-xs font-bold text-white">
              {{ store.getEventStatusBadge(store.selectedEvent.date) }}
            </div>
          </div>
          <div class="p-6 sm:p-8 space-y-4">
            <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {{ store.selectedEvent.title }}
            </h2>

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
        <EventEventBookingForm />
        <AttendanceAttendanceForm />
      </div>
    </div>

    <!-- Add Event Modal (admin can add event from detail page too) -->
    <EventAddEventModal />
  </div>
</template>
