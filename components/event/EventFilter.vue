<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
</script>

<template>
  <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
    <div class="flex items-center justify-between md:justify-start gap-4">
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-filter text-slate-400 text-sm" />
        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Agenda:</span>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-grow justify-end">
      <div class="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
        <button
          :class="store.filterPeriode === 'all' && !store.filterTanggal ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 font-medium'"
          class="px-3 py-1.5 rounded-lg text-xs transition-all"
          @click="store.setFilter('all')"
        >Semua</button>
        <button
          :class="store.filterPeriode === 'aktif' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 font-medium'"
          class="px-3 py-1.5 rounded-lg text-xs transition-all"
          @click="store.setFilter('aktif')"
        >Akan Datang</button>
        <button
          :class="store.filterPeriode === 'hari-h' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 font-medium'"
          class="px-3 py-1.5 rounded-lg text-xs transition-all"
          @click="store.setFilter('hari-h')"
        >Hari H</button>
        <button
          :class="store.filterPeriode === 'lampau' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 font-medium'"
          class="px-3 py-1.5 rounded-lg text-xs transition-all"
          @click="store.setFilter('lampau')"
        >Selesai</button>
      </div>

      <div class="flex items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 justify-between sm:justify-start">
        <span class="text-xs text-slate-400 font-medium whitespace-nowrap">Pilih Tanggal:</span>
        <div class="flex items-center gap-1">
          <input
            type="date"
            :value="store.filterTanggal"
            class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-semibold"
            @input="store.setDateFilter(($event.target as HTMLInputElement).value)"
          >
          <button
            v-if="store.filterTanggal"
            class="text-slate-400 hover:text-rose-500 text-xs px-1"
            @click="store.clearDateFilter()"
          >
            <i class="fa-solid fa-circle-xmark" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
