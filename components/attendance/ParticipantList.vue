<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

function handleCancel(bookingId: string): void {
  if (confirm('Admin Confirmed: Apakah Anda yakin ingin membatalkan/menghapus pendaftaran peserta ini?')) {
    store.cancelBooking(bookingId)
  }
}
</script>

<template>
  <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="font-bold text-slate-900 text-base">Peserta Terdaftar</h3>
        <p class="text-xs text-slate-500">List manifest reservasi saat ini untuk event ini.</p>
      </div>
      <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-xl text-xs font-bold">
        {{ store.bookingsForSelectedEvent.length }} Orang
      </span>
    </div>

    <div class="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-2">
      <div
        v-for="(bk, index) in store.bookingsForSelectedEvent"
        :key="bk.id"
        class="py-3 flex items-center justify-between gap-4 text-xs"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">
            {{ index + 1 }}
          </div>
          <div class="min-w-0">
            <p class="font-bold text-slate-900 truncate">{{ bk.name }}</p>
            <p class="text-[10px] text-slate-400 font-mono">ID: {{ bk.id }} | WA: {{ store.maskPhoneNumber(bk.wa) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span
            :class="bk.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
            class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md"
          >
            {{ bk.status }}
          </span>
          <button
            v-if="store.role === 'admin'"
            class="bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-2 py-1 rounded-lg transition-all text-[10px] flex items-center gap-1"
            @click="handleCancel(bk.id)"
          >
            <i class="fa-solid fa-user-minus" /> Cancel
          </button>
        </div>
      </div>
      <div v-if="store.bookingsForSelectedEvent.length === 0" class="py-8 text-center text-slate-400 italic">
        Belum ada peserta yang membooking slot event ini.
      </div>
    </div>
  </div>
</template>
