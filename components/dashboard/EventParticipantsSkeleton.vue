<script setup lang="ts">
interface Props {
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
})
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="i in props.rows"
      :key="`part-skel-${i}`"
      class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3"
    >
      <UiSkeletonBlock variant="circle" width="w-9" height="h-9" />
      <div class="flex-grow space-y-1.5 min-w-0">
        <UiSkeletonBlock variant="bar" width="w-1/3" height="h-3" />
        <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2" />
      </div>
      <UiSkeletonBlock variant="bar" width="w-16" height="h-6" rounded="rounded-md" />
    </div>
  </div>
</template>
