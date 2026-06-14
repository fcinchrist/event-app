<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

interface NavItem {
  key: string
  label: string
  icon: string
  to: string
}

interface Props {
  items: NavItem[]
  sectionLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  sectionLabel: 'Panel Operasional',
})

const appStore = useAppStore()
const route = useRoute()

// Aktifkan link sidebar jika path sama atau merupakan sub-path
function isActive(to: string): boolean {
  if (to === '/dashboard') {
    return route.path === '/dashboard' || route.path === '/dashboard/'
  }
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6 lg:gap-8">
    <!--
      ============================================
      Sidebar (desktop only)
      ============================================
      Daftar menu navigasi dashboard dengan NuxtLink ke route berbeda.
      URL masing-masing sudah terpisah sehingga bisa di-bookmark:
        - /dashboard         → Ringkasan
        - /dashboard/events  → Kelola Event

      Di mobile, drawer navigasi ada di layouts/default.vue dan
      dipicu oleh hamburger tunggal di AppHeader — supaya user
      tidak bingung mencari menu di dua tempat.
    -->
    <nav class="hidden lg:flex w-64 shrink-0 flex-col gap-2 border-r border-slate-200 pr-6">
      <div
        v-if="props.sectionLabel"
        class="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-3"
      >
        {{ props.sectionLabel }}
      </div>
      <NuxtLink
        v-for="item in props.items"
        :key="item.key"
        :to="item.to"
        class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left w-full"
        :class="isActive(item.to)
          ? 'bg-slate-900 text-white'
          : 'hover:bg-slate-100 text-slate-600'"
      >
        <i :class="item.icon" class="w-4 text-center" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <!--
      ============================================
      Konten halaman (di-slot dari parent)
      ============================================
    -->
    <div class="flex-grow min-w-0 space-y-6">
      <slot />
    </div>
  </div>
</template>
