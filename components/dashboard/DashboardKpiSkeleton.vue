<script setup lang="ts">
/**
 * DashboardKpiSkeleton — placeholder untuk 4 kartu KPI di
 * pages/dashboard/index.vue (Ringkasan Dashboard).
 *
 * Mengikuti layout StatCard: padding, label uppercase, value besar,
 * hint di bawah, icon swatch di kanan atas.
 */
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      v-for="i in 4"
      :key="i"
      class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"
    >
      <div class="flex items-start justify-between gap-3">
        <UiSkeletonBlock variant="bar" width="w-24" height="h-2.5" />
        <UiSkeletonBlock variant="block" width="w-9" height="h-9" rounded="rounded-xl" />
      </div>
      <UiSkeletonBlock variant="block" width="w-20" height="h-7" rounded="rounded-lg" class="mt-2" />
      <UiSkeletonBlock variant="bar" width="w-2/3" height="h-2.5" class="mt-2" />
    </div>
  </div>
</template>
