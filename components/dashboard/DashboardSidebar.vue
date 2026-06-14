<script setup lang="ts">
interface NavItem {
  key: string
  label: string
  icon: string
}

interface Props {
  modelValue: string
  items: NavItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function select(key: string): void {
  emit('update:modelValue', key)
}
</script>

<template>
  <div class="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-2 border-b lg:border-b-0 lg:border-r border-slate-200 pb-4 lg:pb-0 lg:pr-6 whitespace-nowrap">
    <div class="hidden lg:block text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
      Panel Operasional
    </div>
    <button
      v-for="item in props.items"
      :key="item.key"
      class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left w-full"
      :class="props.modelValue === item.key
        ? 'bg-slate-900 text-white'
        : 'hover:bg-slate-100 text-slate-600'"
      @click="select(item.key)"
    >
      <i :class="item.icon" class="w-4 text-center" />
      {{ item.label }}
    </button>
  </div>
</template>
