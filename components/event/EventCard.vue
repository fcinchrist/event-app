<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { ref } from 'vue'
import type { Event } from '~/domain/entities/event'

const props = defineProps<{
  event: Event
}>()

const store = useAppStore()
const imageLoaded = ref(false)
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative">
    <div>
      <div class="h-48 overflow-hidden relative bg-slate-100">
        <!-- Image loading skeleton -->
        <div v-if="!imageLoaded" class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
        <img
          :src="props.event.image"
          alt="Poster Event"
          class="w-full h-full object-cover transition-opacity duration-300"
          :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
          @load="imageLoaded = true"
        >
        <div class="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">
          <span>{{ store.getEventStatusBadge(props.event.date) }}</span>
        </div>
        <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <i class="fa-solid fa-users text-emerald-600" />
          <span>{{ store.getSlotsTaken(props.event.id) }}/{{ props.event.quota }} Terisi</span>
        </div>
      </div>
      <div class="p-5">
        <NuxtLink
          :to="`/event/${props.event.id}`"
          class="font-bold text-lg text-slate-900 leading-snug hover:text-emerald-600 transition-colors block"
        >
          {{ props.event.title }}
        </NuxtLink>
        <p class="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
          <i class="fa-solid fa-calendar-days text-slate-400" />
          <span>{{ store.formatDate(props.event.date) }}</span>
        </p>
        <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <i class="fa-solid fa-location-dot text-slate-400" />
          <span class="truncate">{{ props.event.location }}</span>
        </p>
        <p class="text-sm text-slate-600 mt-3 line-clamp-2">{{ props.event.description }}</p>
      </div>
    </div>
    <div class="p-5 pt-0">
      <NuxtLink
        :to="`/event/${props.event.id}`"
        class="w-full py-2.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        <span>Lihat Detail & Daftar</span>
        <i class="fa-solid fa-arrow-right text-xs" />
      </NuxtLink>
    </div>
  </div>
</template>
