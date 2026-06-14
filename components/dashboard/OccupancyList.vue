<script setup lang="ts">
export interface OccupancyItem {
  id: string
  title: string
  taken: number
  quota: number
}

interface Props {
  items: OccupancyItem[]
}

const props = defineProps<Props>()

function rateOf(item: OccupancyItem): number {
  if (item.quota <= 0) return 0
  return Math.round((item.taken / item.quota) * 100)
}
</script>

<template>
  <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
    <div>
      <h3 class="font-bold text-slate-900 text-base">Okupansi Slot Event</h3>
      <p class="text-xs text-slate-500">Daftar event beserta tingkat pengisian kuotanya.</p>
    </div>

    <div v-if="props.items.length === 0" class="py-8 text-center text-xs text-slate-400 italic">
      Belum ada data event untuk ditampilkan.
    </div>

    <div v-else class="space-y-4 my-6">
      <div v-for="item in props.items" :key="item.id" class="space-y-1.5">
        <div class="flex justify-between items-center text-xs">
          <span class="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-none">
            {{ item.title }}
          </span>
          <span class="text-slate-500 font-semibold shrink-0 ml-2">
            {{ item.taken }}/{{ item.quota }} ({{ rateOf(item) }}%)
          </span>
        </div>
        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            class="bg-emerald-600 h-full rounded-full transition-all duration-500"
            :style="`width: ${rateOf(item)}%`"
          />
        </div>
      </div>
    </div>

    <div class="text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-3">
      Update otomatis setiap ada registrasi atau check-in baru.
    </div>
  </div>
</template>
