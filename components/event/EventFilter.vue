<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useEventCategoryStore } from '~/presentation/stores/event-category'

const store = useAppStore()
const categoryStore = useEventCategoryStore()

// Pre-fetch the category list (cheap, public-read) on mount so the
// pill row can render. Safe no-op when already loaded.
onMounted(() => {
  void categoryStore.fetchCategories()
})

function selectCategory(id: string | null): void {
  store.setCategoryFilter(id)
}
</script>

<template>
  <div class="space-y-3">
    <!--
      Category pill row. Sits above the period/date filter so it's
      the first thing a visitor sees. Pill colors match the
      `emerald` brand accent used everywhere else.
    -->
    <div
      v-if="categoryStore.categories.length > 0"
      class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm"
    >
      <div class="flex items-center gap-2 mb-2.5">
        <i class="fa-solid fa-tags text-slate-400 text-sm" />
        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Filter Kategori:
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          :class="store.filterCategoryId === null
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5"
          @click="selectCategory(null)"
        >
          <i class="fa-solid fa-layer-group text-[10px]" />
          Semua
        </button>
        <button
          v-for="category in categoryStore.categories"
          :key="category.id"
          type="button"
          :class="store.filterCategoryId === category.id
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5"
          @click="selectCategory(category.id)"
        >
          <i class="fa-solid fa-tag text-[10px]" />
          {{ category.name }}
        </button>
      </div>
    </div>

    <!--
      Period + date filter (unchanged from the previous version).
    -->
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
  </div>
</template>
