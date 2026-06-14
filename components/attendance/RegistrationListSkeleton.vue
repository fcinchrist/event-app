<script setup lang="ts">
interface Props {
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  rows: 4,
})
</script>

<template>
  <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
    <div class="flex justify-between items-center">
      <div class="space-y-2">
        <UiSkeletonBlock variant="bar" width="w-40" height="h-4" />
        <UiSkeletonBlock variant="bar" width="w-64" height="h-2.5" />
      </div>
      <UiSkeletonBlock variant="bar" width="w-20" height="h-6" rounded="rounded-xl" />
    </div>
    <div class="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-2">
      <div
        v-for="i in props.rows"
        :key="`reg-skel-${i}`"
        class="py-3 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3 min-w-0 flex-grow">
          <UiSkeletonBlock variant="circle" width="w-7" height="h-7" />
          <div class="flex-grow space-y-1.5 min-w-0">
            <UiSkeletonBlock variant="bar" width="w-2/3" height="h-3" />
            <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2" />
          </div>
        </div>
        <UiSkeletonBlock variant="bar" width="w-14" height="h-4" rounded="rounded-md" />
      </div>
    </div>
  </div>
</template>
