<script setup lang="ts">
/**
 * Loading skeleton for the Master User table. Mirrors the real
 * table layout: header row (desktop only) plus avatar + name + phone
 * + event count + registered date + action cells.
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
    <!-- Header row (desktop only) -->
    <div
      v-if="props.showHeader"
      class="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200"
    >
      <div class="col-span-4"><UiSkeletonBlock variant="bar" width="w-16" height="h-3" /></div>
      <div class="col-span-3"><UiSkeletonBlock variant="bar" width="w-20" height="h-3" /></div>
      <div class="col-span-2 text-center"><UiSkeletonBlock variant="bar" width="w-12" height="h-3" class="mx-auto" /></div>
      <div class="col-span-2"><UiSkeletonBlock variant="bar" width="w-16" height="h-3" /></div>
      <div class="col-span-1 text-right"><UiSkeletonBlock variant="bar" width="w-10" height="h-3" class="ml-auto" /></div>
    </div>

    <!-- Rows (desktop) -->
    <div class="hidden md:block divide-y divide-slate-100">
      <div
        v-for="i in props.rows"
        :key="`d-${i}`"
        class="px-5 py-3 grid grid-cols-12 gap-3 items-center"
      >
        <!-- User: avatar + name + id -->
        <div class="col-span-4 flex items-center gap-3 min-w-0">
          <UiSkeletonBlock variant="circle" width="w-10" height="h-10" />
          <div class="flex-grow space-y-2 min-w-0">
            <UiSkeletonBlock variant="bar" width="w-3/4" height="h-3.5" />
            <UiSkeletonBlock variant="bar" width="w-1/3" height="h-2.5" />
          </div>
        </div>
        <!-- Phone -->
        <div class="col-span-3">
          <UiSkeletonBlock variant="bar" width="w-2/3" height="h-3" />
        </div>
        <!-- Event count -->
        <div class="col-span-2 flex justify-center">
          <UiSkeletonBlock variant="block" width="w-10" height="h-6" rounded="rounded-lg" />
        </div>
        <!-- Registered date -->
        <div class="col-span-2 space-y-1.5">
          <UiSkeletonBlock variant="bar" width="w-5/6" height="h-3" />
          <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2.5" />
        </div>
        <!-- Action -->
        <div class="col-span-1 flex items-center justify-end">
          <UiSkeletonBlock variant="block" width="w-20" height="h-7" rounded="rounded-lg" />
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
        <UiSkeletonBlock variant="circle" width="w-12" height="h-12" />
        <div class="flex-grow space-y-2 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-grow space-y-1.5 min-w-0">
              <UiSkeletonBlock variant="bar" width="w-3/4" height="h-3.5" />
              <UiSkeletonBlock variant="bar" width="w-1/2" height="h-3" />
            </div>
            <UiSkeletonBlock variant="block" width="w-10" height="h-6" rounded="rounded-lg" />
          </div>
          <div class="space-y-1.5">
            <UiSkeletonBlock variant="bar" width="w-2/3" height="h-2.5" />
            <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2.5" />
          </div>
          <div class="pt-1">
            <UiSkeletonBlock variant="block" width="w-full" height="h-8" rounded="rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
