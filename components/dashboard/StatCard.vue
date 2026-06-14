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

// Semua tone diturunkan dari brand "emerald" sesuai standar.
// Tone lain dipertahankan untuk backward compat, tapi default = emerald
// sehingga seluruh ringkasan dashboard konsisten hijau.
const toneStyles: Record<Tone, { ring: string; iconBg: string; iconText: string; valueText: string; hintText: string }> = {
  emerald: {
    ring: 'ring-emerald-100',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    valueText: 'text-emerald-700',
    hintText: 'text-emerald-600/80',
  },
  indigo: {
    ring: 'ring-indigo-100',
    iconBg: 'bg-indigo-50',
    iconText: 'text-indigo-600',
    valueText: 'text-emerald-700',
    hintText: 'text-indigo-600/80',
  },
  amber: {
    ring: 'ring-amber-100',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    valueText: 'text-emerald-700',
    hintText: 'text-amber-600/80',
  },
  rose: {
    ring: 'ring-rose-100',
    iconBg: 'bg-rose-50',
    iconText: 'text-rose-600',
    valueText: 'text-emerald-700',
    hintText: 'text-rose-600/80',
  },
  slate: {
    ring: 'ring-slate-100',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    valueText: 'text-emerald-700',
    hintText: 'text-slate-500',
  },
}

const style = computed(() => toneStyles[props.tone])
</script>

<template>
  <div
    class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-transparent transition-all hover:shadow-md"
    :class="style.ring"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
        {{ props.label }}
      </div>
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        :class="style.iconBg"
      >
        <i :class="[props.icon, style.iconText, 'text-sm']" />
      </div>
    </div>
    <div
      class="text-2xl font-black mt-2"
      :class="style.valueText"
    >
      {{ props.value }}
    </div>
    <div
      v-if="props.hint"
      class="text-[10px] mt-1.5 font-semibold flex items-center gap-1"
      :class="style.hintText"
    >
      <i v-if="props.hintIcon" :class="props.hintIcon" />
      <span>{{ props.hint }}</span>
    </div>
  </div>
</template>
