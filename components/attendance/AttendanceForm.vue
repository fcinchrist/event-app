<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

function handleAttendance(): void {
  const result = store.submitAttendanceCheck()
  if (result && result.startsWith('success:')) {
    const name = result.replace('success:', '')
    alert(`Absensi Berhasil! Terimakasih ${name}, status kehadiran Anda telah dikonfirmasi.`)
  } else if (result) {
    alert(result)
  }
}
</script>

<template>
  <div
    v-if="store.selectedEvent"
    class="bg-white rounded-3xl p-6 border shadow-sm transition-all"
    :class="store.isHariH(store.selectedEvent.date) ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200 opacity-60 bg-slate-50'"
  >
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <i
            class="fa-solid fa-clipboard-user"
            :class="store.isHariH(store.selectedEvent.date) ? 'text-indigo-600' : 'text-slate-400'"
          />
          Absensi Kehadiran
        </h3>
        <span
          :class="store.isHariH(store.selectedEvent.date) ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'"
          class="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
        >
          {{ store.isHariH(store.selectedEvent.date) ? 'Buka' : 'Terkunci' }}
        </span>
      </div>
      <p class="text-[11px] text-slate-500 leading-normal">
        <span v-if="store.isHariH(store.selectedEvent.date)" class="text-indigo-700 font-medium">
          <i class="fa-solid fa-circle-check animate-pulse" /> Sesi dibuka! Pilih namamu dan beri checklist kehadiran.
        </span>
        <span v-else>
          <i class="fa-solid fa-lock" /> Hanya aktif pada hari H acara.
        </span>
      </p>
    </div>

    <div v-if="store.isHariH(store.selectedEvent.date)" class="mt-4 pt-3 border-t border-slate-200/60 space-y-3">
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pilih Nama Anda</label>
        <select
          v-model="store.attendanceFormBookingId"
          class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
        >
          <option value="">-- Cari Nama Sesuai Booking --</option>
          <option
            v-for="bk in store.bookingsForSelectedEvent"
            :key="bk.id"
            :value="bk.id"
            :disabled="bk.status === 'Hadir'"
          >
            {{ bk.name }} ({{ bk.status }})
          </option>
        </select>
      </div>
      <button
        class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100"
        @click="handleAttendance"
      >
        <i class="fa-solid fa-square-check" /> Checklist Kehadiran
      </button>
    </div>
  </div>
</template>
