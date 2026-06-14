<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  block: false,
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'border border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
    case 'danger':
      return 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-100'
    case 'ghost':
      return 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    default:
      return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100'
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-xs'
    case 'lg':
      return 'px-6 py-3 text-sm'
    default:
      return 'px-4 py-2.5 text-xs'
  }
})
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled || props.loading"
    class="rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[
      variantClass,
      sizeClass,
      props.block ? 'w-full' : '',
    ]"
  >
    <i v-if="props.loading" class="fa-solid fa-circle-notch fa-spin text-xs" />
    <slot />
  </button>
</template>
