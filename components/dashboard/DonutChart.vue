<script setup lang="ts">
interface Props {
  presentCount: number
  absentCount: number
}

const props = defineProps<Props>()

const total = computed<number>(() => props.presentCount + props.absentCount)

const presentPercent = computed<number>(() => {
  if (total.value === 0) return 0
  return Math.round((props.presentCount / total.value) * 100)
})
</script>

<template>
  <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
    <div>
      <h3 class="font-bold text-slate-900 text-base">Rasio Status Kehadiran</h3>
      <p class="text-xs text-slate-500">Perbandingan anggota yang hadir vs belum hadir.</p>
    </div>

    <div class="my-6 flex justify-center">
      <div
        class="relative w-40 h-40 rounded-full flex items-center justify-center border border-slate-100 shadow-inner"
        :style="`background: conic-gradient(#10b981 0% ${presentPercent}%, #f59e0b ${presentPercent}% 100%)`"
      >
        <div class="bg-white w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-md">
          <span class="text-2xl font-black text-slate-900">{{ presentPercent }}%</span>
          <span class="text-[9px] font-extrabold text-slate-400 uppercase">Hadir</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-4">
      <div class="flex items-center gap-1.5 justify-center">
        <span class="w-3 h-3 rounded-full bg-emerald-500" />
        <span class="font-bold text-slate-700">{{ props.presentCount }} Hadir</span>
      </div>
      <div class="flex items-center gap-1.5 justify-center">
        <span class="w-3 h-3 rounded-full bg-amber-500" />
        <span class="font-bold text-slate-700">{{ props.absentCount }} Belum Datang</span>
      </div>
    </div>
  </div>
</template>
