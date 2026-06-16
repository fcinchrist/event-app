<script setup lang="ts">
/**
 * PeriodFilter
 * ------------
 * Komponen filter periode untuk ringkasan dashboard admin.
 *
 * Mode:
 *   - `all`   → tidak ada filter (default)
 *   - `day`   → input tanggal spesifik (type=date, format browser YYYY-MM-DD)
 *   - `year`  → input tahun (4 digit)
 *
 * Mengikuti konvensi komponen dashboard yang sudah ada (lihat
 * `OccupancyList`, `RecentActivity`): props-based, no global store
 * dependency di dalam komponen, emit event ke parent.
 */

import type { DashboardPeriodFilter, DashboardPeriodMode } from '~/presentation/stores/dashboard'

interface Props {
  modelValue: DashboardPeriodFilter
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: DashboardPeriodFilter]
  'apply': [value: DashboardPeriodFilter]
  'reset': []
}>()

const currentYear = new Date().getFullYear()

// Backing state — supaya input day/year bisa "disusun" dulu
// sebelum user tekan Apply (UX lebih ramah, tanpa nge-trigger refetch
// setiap kali user ngetik angka).
const localMode = ref<DashboardPeriodMode>(props.modelValue.mode)
const localDate = ref<string>(props.modelValue.date)
const localYear = ref<number>(props.modelValue.year)

watch(
  () => props.modelValue,
  (next) => {
    localMode.value = next.mode
    localDate.value = next.date
    localYear.value = next.year
  },
  { deep: true },
)

function setMode(mode: DashboardPeriodMode): void {
  localMode.value = mode
  if (mode === 'all') {
    emit('update:modelValue', { mode: 'all', date: '', year: localYear.value })
  } else if (mode === 'day') {
    if (localDate.value) {
      emit('update:modelValue', { mode: 'day', date: localDate.value, year: localYear.value })
    }
  } else {
    emit('update:modelValue', { mode: 'year', date: '', year: localYear.value })
  }
}

function onDateInput(e: Event): void {
  const target = e.target as HTMLInputElement
  localDate.value = target.value
  if (localMode.value === 'day') {
    emit('update:modelValue', { mode: 'day', date: target.value, year: localYear.value })
  }
}

function onYearInput(e: Event): void {
  const target = e.target as HTMLInputElement
  const n = Number(target.value)
  localYear.value = Number.isFinite(n) ? n : currentYear
  if (localMode.value === 'year') {
    emit('update:modelValue', { mode: 'year', date: '', year: localYear.value })
  }
}

function onApply(): void {
  emit('apply', {
    mode: localMode.value,
    date: localDate.value,
    year: localYear.value,
  })
}

function onReset(): void {
  localMode.value = 'all'
  localDate.value = ''
  localYear.value = currentYear
  emit('apply', { mode: 'all', date: '', year: currentYear })
  // Beri tahu parent untuk invalidate visual state (mis. untuk
  // sembunyikan tombol Reset itu sendiri ketika filter sudah
  // kembali ke default 'all' + date kosong).
  emit('reset')
}
</script>

<template>
  <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-5 rounded-full bg-emerald-500" />
          <h3 class="font-bold text-slate-900 text-sm">Filter Periode Data</h3>
        </div>
        <!-- Tombol reset selalu tersedia di header supaya user bisa
             mengosongkan filter dalam 1 klik dari mode manapun
             (Semua Waktu / Per Hari / Per Tahun). -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
          title="Reset filter ke default (Semua Waktu)"
          @click="onReset"
        >
          <i class="fa-solid fa-rotate-right" />
          <span>Reset</span>
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <!-- Mode: Semua waktu -->
        <button
          type="button"
          class="px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2"
          :class="localMode === 'all'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
          @click="setMode('all')"
        >
          <i class="fa-solid fa-infinity" />
          Semua Waktu
        </button>

        <!-- Mode: Per hari (dd/mm/yyyy) -->
        <button
          type="button"
          class="px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2"
          :class="localMode === 'day'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
          @click="setMode('day')"
        >
          <i class="fa-regular fa-calendar" />
          Per Hari (dd/mm/yyyy)
        </button>

        <!-- Mode: Per tahun (yyyy) -->
        <button
          type="button"
          class="px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2"
          :class="localMode === 'year'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
          @click="setMode('year')"
        >
          <i class="fa-solid fa-calendar-days" />
          Per Tahun (yyyy)
        </button>
      </div>

      <!-- Sub-input spesifik per mode -->
      <div v-if="localMode === 'day'" class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div class="sm:col-span-2">
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pilih Tanggal
          </label>
          <input
            type="date"
            :value="localDate"
            class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
            @input="onDateInput"
          >
        </div>
        <UiAppButton variant="primary" :loading="props.isLoading" @click="onApply">
          <i class="fa-solid fa-magnifying-glass" /> Terapkan
        </UiAppButton>
      </div>

      <div v-else-if="localMode === 'year'" class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div class="sm:col-span-2">
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pilih Tahun
          </label>
          <input
            type="number"
            :value="localYear"
            min="1970"
            max="2999"
            step="1"
            placeholder="2026"
            class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
            @input="onYearInput"
          >
        </div>
        <UiAppButton variant="primary" :loading="props.isLoading" @click="onApply">
          <i class="fa-solid fa-magnifying-glass" /> Terapkan
        </UiAppButton>
      </div>

      <!-- Footer action hanya untuk mode day/year yang butuh tombol
           Terapkan. Tombol reset di header sudah cukup untuk mode
           'all'. -->
    </div>
  </div>
</template>
