<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

onMounted(() => {
  store.init()
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <LayoutAppHeader />
    <main class="flex-1 w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <slot />
      </div>
    </main>
    <LayoutAppFooter />
  </div>
</template>
