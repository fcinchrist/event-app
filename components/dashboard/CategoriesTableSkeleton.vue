<script setup lang="ts">
/**
 * Skeleton placeholder for the master category table.
 * Renders `rows` skeleton rows so the layout matches the real table
 * (Name + Detail + Actions). Pure presentational, no logic.
 */
interface Props {
  rows?: number
}

withDefaults(defineProps<Props>(), {
  rows: 5,
})
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div class="p-5 space-y-3">
      <UiSkeletonBlock
        v-for="i in rows"
        :key="i"
        height="h-12"
        rounded="rounded-xl"
      />
    </div>
  </div>
</template>
