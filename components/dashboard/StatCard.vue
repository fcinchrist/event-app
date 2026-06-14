<script setup lang="ts">
type Tone = 'emerald' | 'indigo' | 'amber' | 'slate' | 'rose'

interface Props {
  label: string
  value: string | number
  icon: string
  tone?: Tone
  hint?: string
  hintIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'emerald',
  hint: '',
  hintIcon: '',
})

const hintColorClass = computed<string>(() => {
  switch (props.tone) {
    case 'indigo':
      return 'text-indigo-600'
    case 'amber':
      return 'text-amber-600'
    case 'rose':
      return 'text-rose-600'
    case 'slate':
      return 'text-slate-500'
    default:
      return 'text-emerald-600'
  }
})
</script>

<template>
  <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div class="text-slate-400 text-xs font-bold uppercase tracking-wider">
      {{ props.label }}
    </div>
    <div class="text-2xl font-black text-slate-950 mt-1">
      {{ props.value }}
    </div>
    <div
      v-if="props.hint"
      class="text-[10px] mt-1 font-semibold flex items-center gap-1"
      :class="hintColorClass"
    >
      <i v-if="props.hintIcon" :class="props.hintIcon" />
      <span>{{ props.hint }}</span>
    </div>
  </div>
</template>
