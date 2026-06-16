<script setup lang="ts">
export interface OccupancyItem {
  id: string
  title: string
  taken: number
  quota: number
}

interface Props {
  items: OccupancyItem[]
  /**
   * Number of events per page. Default 5 (per spec: "5/5").
   * Set to 0 to disable pagination (show all).
   */
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 5,
})

function rateOf(item: OccupancyItem): number {
  if (item.quota <= 0) return 0
  return Math.round((item.taken / item.quota) * 100)
}

/**
 * Client-side pagination. Resets to page=1 whenever `items`
 * changes (e.g. after a refetch of registrations in another
 * period) so the user is never stranded on an empty page.
 */
const currentPage = ref(1)

watch(
  () => props.items,
  () => {
    currentPage.value = 1
  },
)

const totalItems = computed(() => props.items.length)

/**
 * Total number of pages. If `pageSize` <= 0, show everything
 * (a virtual single page containing all items). Minimum 1 so
 * the pager never renders "Page 1 of 0".
 */
const totalPages = computed(() => {
  if (props.pageSize <= 0) return 1
  return Math.max(1, Math.ceil(totalItems.value / props.pageSize))
})

const pagedItems = computed<OccupancyItem[]>(() => {
  if (props.pageSize <= 0) return props.items
  const start = (currentPage.value - 1) * props.pageSize
  return props.items.slice(start, start + props.pageSize)
})

const shouldShowPagination = computed<boolean>(
  () => props.pageSize > 0 && totalPages.value > 1,
)

const pageLabel = computed<string>(() => {
  if (totalItems.value === 0) return ''
  if (props.pageSize <= 0) return `${totalItems.value} event`
  const start = (currentPage.value - 1) * props.pageSize + 1
  const end = Math.min(currentPage.value * props.pageSize, totalItems.value)
  return `${start}–${end} of ${totalItems.value}`
})

function goPrev(): void {
  if (currentPage.value > 1) currentPage.value -= 1
}

function goNext(): void {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}
</script>

<template>
  <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
    <div>
      <h3 class="font-bold text-slate-900 text-base">Okupansi Slot Event</h3>
      <p class="text-xs text-slate-500">Daftar event beserta tingkat pengisian kuotanya.</p>
    </div>

    <div v-if="pagedItems.length === 0" class="py-8 text-center text-xs text-slate-400 italic">
      Belum ada data event untuk ditampilkan.
    </div>

    <div v-else class="space-y-4 my-6">
      <div v-for="item in pagedItems" :key="item.id" class="space-y-1.5">
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

    <!-- Footer: pagination (5/page) + event count label. The
         pager is only shown when pageSize > 0 and the total
         page count is > 1. Buttons are sized to remain tappable
         on mobile when stacked next to other sections. -->
    <div
      v-if="totalItems > 0"
      class="flex items-center justify-between gap-2 border-t border-slate-100 pt-3"
    >
      <div class="text-[10px] text-slate-400 italic truncate">
        {{ pageLabel }} event
      </div>
      <div v-if="shouldShowPagination" class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          :disabled="currentPage === 1"
          class="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center justify-center"
          aria-label="Halaman sebelumnya"
          @click="goPrev"
        >
          <i class="fa-solid fa-chevron-left text-[10px]" />
        </button>
        <div class="text-[10px] font-semibold text-slate-600 px-2 py-1 bg-slate-50 rounded-md border border-slate-200">
          <span class="text-emerald-700 font-extrabold">{{ currentPage }}</span>
          /
          <span class="font-bold text-slate-800">{{ totalPages }}</span>
        </div>
        <button
          type="button"
          :disabled="currentPage === totalPages"
          class="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center justify-center"
          aria-label="Halaman berikutnya"
          @click="goNext"
        >
          <i class="fa-solid fa-chevron-right text-[10px]" />
        </button>
      </div>
    </div>
  </div>
</template>
