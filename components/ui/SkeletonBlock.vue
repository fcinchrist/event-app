<script setup lang="ts">
/**
 * SkeletonBlock — placeholder loading universal.
 *
 * Dipakai di semua halaman yang menunggu data (event list, KPI, charts,
 * tabel, dsb). Menggantikan LoadingSpinner di seluruh aplikasi sesuai
 * panduan di helper.md (section "Loading State").
 *
 * Bentuk yang tersedia:
 * - <SkeletonBlock />              → baris/bar generik (full width)
 * - <SkeletonBlock variant="circle" /> → avatar/icon (lingkaran)
 * - <SkeletonBlock variant="text" />   → 1 baris teks pendek
 * - <SkeletonBlock variant="block" />  → blok lebih besar (default)
 *
 * Props:
 * - width: kelas Tailwind untuk lebar (mis. 'w-1/2', 'w-32')
 * - height: kelas Tailwind untuk tinggi (mis. 'h-4', 'h-10')
 * - rounded: kelas Tailwind untuk radius (default 'rounded-lg')
 * - variant: shorthand untuk kombinasi umum
 * - pulse: true (default) pakai animate-pulse
 */
type Variant = 'block' | 'text' | 'circle' | 'bar' | 'pill'

interface Props {
  variant?: Variant
  width?: string
  height?: string
  rounded?: string
  pulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'block',
  width: 'w-full',
  height: 'h-4',
  rounded: '',
  pulse: true,
})

const variantStyles = computed<{ w: string; h: string; r: string }>(() => {
  switch (props.variant) {
    case 'text':
      return { w: 'w-full', h: 'h-3', r: 'rounded' }
    case 'bar':
      return { w: 'w-3/4', h: 'h-3', r: 'rounded' }
    case 'pill':
      return { w: 'w-20', h: 'h-5', r: 'rounded-full' }
    case 'circle':
      return { w: 'w-10', h: 'h-10', r: 'rounded-full' }
    case 'block':
    default:
      return { w: 'w-full', h: 'h-24', r: 'rounded-xl' }
  }
})

const finalWidth = computed(() => props.width || variantStyles.value.w)
const finalHeight = computed(() => props.height || variantStyles.value.h)
const finalRounded = computed(() => props.rounded || variantStyles.value.r)
</script>

<template>
  <div
    :class="[
      'bg-slate-200/70 inline-block align-top',
      finalWidth,
      finalHeight,
      finalRounded,
      pulse ? 'animate-pulse' : '',
    ]"
  />
</template>
