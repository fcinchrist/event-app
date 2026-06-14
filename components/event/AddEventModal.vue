<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

function handleSubmit(): void {
  const error = store.submitNewEvent()
  if (error) {
    alert(error)
  } else {
    alert(`Sukses merilis event baru: "${store.newEventForm.title}"`)
  }
}
</script>

<template>
  <div
    v-if="store.showAddEventModal"
    class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  >
    <div
      class="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
      @click.away="store.showAddEventModal = false"
    >
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 class="font-extrabold text-slate-900 text-lg">Buat Event Komunitas Baru</h3>
          <p class="text-xs text-slate-400 mt-0.5">Lengkapi data berikut untuk merilis agenda baru.</p>
        </div>
        <button class="text-slate-400 hover:text-rose-600 transition-colors" @click="store.showAddEventModal = false">
          <i class="fa-solid fa-xmark text-lg" />
        </button>
      </div>

      <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Judul / Nama Event</label>
          <input
            v-model="store.newEventForm.title"
            type="text"
            placeholder="Contoh: Friendship Gathering & BBQ"
            class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal & Waktu</label>
            <input
              v-model="store.newEventForm.date"
              type="datetime-local"
              class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-600"
            >
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Batas Kuota Peserta</label>
            <input
              v-model="store.newEventForm.quota"
              type="number"
              placeholder="50"
              class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lokasi Kegiatan</label>
          <input
            v-model="store.newEventForm.location"
            type="text"
            placeholder="Contoh: Central Park / Ruang Aula Lantai 2"
            class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">URL Cover / Gambar Poster</label>
          <input
            v-model="store.newEventForm.image"
            type="text"
            placeholder="Kosongkan jika ingin memakai poster default..."
            class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Deskripsi Ringkas Event</label>
          <textarea
            v-model="store.newEventForm.description"
            rows="3"
            placeholder="Tuliskan agenda seru atau syarat pakaian kegiatan di sini..."
            class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div class="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
        <button
          class="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-all"
          @click="store.showAddEventModal = false"
        >
          Batal
        </button>
        <button
          class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          @click="handleSubmit"
        >
          Simpan & Terbitkan
        </button>
      </div>
    </div>
  </div>
</template>
