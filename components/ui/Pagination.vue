<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
</script>

<template>
  <div v-if="store.totalPage > 1" class="flex items-center justify-center gap-2 pt-4">
    <button
      :disabled="store.page === 1"
      class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
      @click="store.page--"
    >
      <i class="fa-solid fa-chevron-left text-xs" />
    </button>
    <div class="text-xs font-semibold text-slate-600">
      Halaman <span>{{ store.page }}</span> dari <span>{{ store.totalPage }}</span>
    </div>
    <button
      :disabled="store.page === store.totalPage"
      class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
      @click="store.page++"
    >
      <i class="fa-solid fa-chevron-right text-xs" />
    </button>
  </div>
</template>
