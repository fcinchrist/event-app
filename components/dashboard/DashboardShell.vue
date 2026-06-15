<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import type { NavItem } from '~/types/navigation'

interface Props {
  items: NavItem[]
  sectionLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  sectionLabel: 'Panel Operasional',
})

const appStore = useAppStore()
const route = useRoute()

// Active when the route matches exactly, or sits under the target (sub-routes).
// The root `/dashboard` alias is normalized to avoid a `/dashboard/` mismatch.
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
      Desktop sidebar (lg+). Each page passes its own `items` so the same
      component is shared by the dashboard root, events, and users pages.
      On mobile the drawer in `layouts/default.vue` renders these items
      instead, driven by the shared `NavItem` type.
    -->
    <nav class="hidden lg:flex w-64 shrink-0 flex-col gap-2 border-r border-slate-200 pr-6">
      <div
        v-if="props.sectionLabel"
        class="text-xs font-bold text-emerald-600 uppercase tracking-widest px-3 mb-3 flex items-center gap-2"
      >
        <span class="w-1.5 h-4 rounded-full bg-emerald-500" />
        {{ props.sectionLabel }}
      </div>
      <NuxtLink
        v-for="item in props.items"
        :key="item.key"
        :to="item.to"
        class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left w-full"
        :class="isActive(item.to)
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
          : 'hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'"
      >
        <i :class="item.icon" class="w-4 text-center" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <div class="flex-grow min-w-0 space-y-6">
      <slot />
    </div>
  </div>
</template>
