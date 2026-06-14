<script setup lang="ts">
/**
 * EventsTableSkeleton — placeholder tabel Kelola Event.
 *
 * Mengikuti layout aktual tabel di pages/dashboard/events.vue:
 * - Header tabel (6 kolom, hidden di mobile)
 * - Rows: avatar + judul + tanggal + lokasi + kuota + status + actions
 *
 * Props:
 * - rows: jumlah baris skeleton (default 5)
 * - showHeader: tampilkan header tabel (default true)
 */
interface Props {
  rows?: number
  showHeader?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
  showHeader: true,
})
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <!-- Header tabel (desktop only) -->
    <div
      v-if="props.showHeader"
      class="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200"
    >
      <div class="col-span-4"><UiSkeletonBlock variant="bar" width="w-16" height="h-3" /></div>
      <div class="col-span-2"><UiSkeletonBlock variant="bar" width="w-16" height="h-3" /></div>
      <div class="col-span-2"><UiSkeletonBlock variant="bar" width="w-16" height="h-3" /></div>
      <div class="col-span-1"><UiSkeletonBlock variant="bar" width="w-12" height="h-3" /></div>
      <div class="col-span-1"><UiSkeletonBlock variant="bar" width="w-14" height="h-3" /></div>
      <div class="col-span-2"><UiSkeletonBlock variant="bar" width="w-10" height="h-3" /></div>
    </div>

    <!-- Rows (desktop) -->
    <div class="hidden md:block divide-y divide-slate-100">
      <div
        v-for="i in props.rows"
        :key="`d-${i}`"
        class="px-5 py-3 grid grid-cols-12 gap-3 items-center"
      >
        <!-- Event: avatar + judul + id -->
        <div class="col-span-4 flex items-center gap-3 min-w-0">
          <UiSkeletonBlock variant="circle" width="w-12" height="h-12" />
          <div class="flex-grow space-y-2 min-w-0">
            <UiSkeletonBlock variant="bar" width="w-3/4" height="h-3.5" />
            <UiSkeletonBlock variant="bar" width="w-1/3" height="h-2.5" />
          </div>
        </div>
        <!-- Tanggal -->
        <div class="col-span-2 space-y-1.5">
          <UiSkeletonBlock variant="bar" width="w-2/3" height="h-3" />
          <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2.5" />
        </div>
        <!-- Lokasi -->
        <div class="col-span-2">
          <UiSkeletonBlock variant="bar" width="w-5/6" height="h-3" />
        </div>
        <!-- Kuota -->
        <div class="col-span-1 flex justify-center">
          <UiSkeletonBlock variant="block" width="w-10" height="h-6" rounded="rounded-lg" />
        </div>
        <!-- Status -->
        <div class="col-span-1 flex justify-center">
          <UiSkeletonBlock variant="pill" width="w-16" height="h-5" />
        </div>
        <!-- Aksi -->
        <div class="col-span-2 flex items-center justify-end gap-1.5">
          <UiSkeletonBlock variant="block" width="w-8" height="h-8" rounded="rounded-lg" />
          <UiSkeletonBlock variant="block" width="w-8" height="h-8" rounded="rounded-lg" />
          <UiSkeletonBlock variant="block" width="w-8" height="h-8" rounded="rounded-lg" />
        </div>
      </div>
    </div>

    <!-- Rows (mobile) -->
    <div class="md:hidden divide-y divide-slate-100">
      <div
        v-for="i in props.rows"
        :key="`m-${i}`"
        class="p-4 flex gap-3"
      >
        <UiSkeletonBlock variant="circle" width="w-16" height="h-16" />
        <div class="flex-grow space-y-2 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-grow space-y-1.5 min-w-0">
              <UiSkeletonBlock variant="bar" width="w-3/4" height="h-3.5" />
              <UiSkeletonBlock variant="bar" width="w-1/2" height="h-3" />
            </div>
            <UiSkeletonBlock variant="pill" width="w-16" height="h-5" />
          </div>
          <div class="space-y-1.5">
            <UiSkeletonBlock variant="bar" width="w-2/3" height="h-2.5" />
            <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2.5" />
            <UiSkeletonBlock variant="bar" width="w-1/3" height="h-2.5" />
          </div>
          <div class="flex items-center gap-1.5 pt-1">
            <UiSkeletonBlock variant="block" width="w-full" height="h-7" rounded="rounded-lg" />
            <UiSkeletonBlock variant="block" width="w-full" height="h-7" rounded="rounded-lg" />
            <UiSkeletonBlock variant="block" width="w-9" height="h-7" rounded="rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
