<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

function handleBooking(): void {
  const error = store.submitBooking()
  if (error) {
    alert(error)
  } else {
    alert('Reservasi Sukses! Nama Anda telah masuk ke list peserta.')
  }
}
</script>

<template>
  <div v-if="store.selectedEvent" class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
    <div>
      <h3 class="font-extrabold text-slate-900 text-lg">Amankan Tiket Anda</h3>
      <p class="text-xs text-slate-500 mt-0.5">Isi data ringkas berikut untuk mendaftar secara langsung.</p>
    </div>

    <div
      v-if="store.getSlotsTaken(store.selectedEvent.id) >= store.selectedEvent.quota"
      class="bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-xl text-xs flex gap-2"
    >
      <i class="fa-solid fa-circle-exclamation text-base text-rose-500 shrink-0" />
      <p class="font-medium">Pendaftaran ditutup karena kuota batas maksimum room sudah penuh terisi.</p>
    </div>

    <div v-else class="space-y-3.5">
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</label>
        <input
          v-model="store.bookingForm.name"
          type="text"
          placeholder="Contoh: Budi Santoso"
          class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor WhatsApp</label>
        <input
          v-model="store.bookingForm.wa"
          type="tel"
          placeholder="Contoh: 08123456789"
          class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
      </div>

      <button
        class="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
        @click="handleBooking"
      >
        <i class="fa-solid fa-paper-plane text-xs" /> Booking Sekarang
      </button>
    </div>
  </div>
</template>
