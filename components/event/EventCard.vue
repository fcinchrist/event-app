<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import { useEventCategoryStore } from '~/presentation/stores/event-category'
import { resolveEventImage } from '~/utils/event-image'
import { computed, ref } from 'vue'
import type { Event } from '~/domain/entities/event'

const props = defineProps<{
  event: Event
}>()

const store = useAppStore()
const regStore = useRegistrationStore()
const categoryStore = useEventCategoryStore()
const imageLoaded = ref(false)
// `false` until one of: (a) the original image has loaded, or (b) the
// fallback image has also failed → in that case we hide the `<img>` and
// just show the icon placeholder.
const imageErrored = ref(false)

// Use the helper so events without a cover image automatically get the
// fallback from the env (`NUXT_PUBLIC_DEFAULT_EVENT_IMAGE`). `imageSrc`
// is a `computed` so it stays reactive (event.image can change when an
// admin edits the event).
const imageSrc = computed(() => resolveEventImage(props.event.image))
const showImage = computed(() => imageSrc.value.length > 0 && !imageErrored.value)

// Resolve the event's category name from the cached categories map.
// Returns `null` when the event has no category so the template can
// hide the pill entirely.
const categoryName = computed<string | null>(() => {
  if (!props.event.categoryId) return null
  return categoryStore.byId[props.event.categoryId]?.name ?? null
})
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative">
    <div>
      <div class="h-48 overflow-hidden relative bg-slate-100">
        <!-- Image loading skeleton -->
        <div v-if="!imageLoaded" class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
        <!--
          Placeholder icon shown when BOTH `event.image` and the env
          default are empty (or the default itself 404s). Ensures the
          card never renders a broken `<img>` or broken icon state.
        -->
        <div v-if="!showImage" class="absolute inset-0 flex items-center justify-center text-slate-300" aria-hidden="true">
          <i class="fa-regular fa-image text-4xl" />
        </div>
        <NuxtImg
          v-else
          :src="imageSrc"
          :alt="`Poster event: ${props.event.title}`"
          loading="lazy"
          decoding="async"
          width="400"
          height="192"
          sizes="100vw sm:50vw lg:33vw"
          format="webp"
          quality="75"
          class="w-full h-full object-cover transition-opacity duration-300"
          :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
          @load="imageLoaded = true"
          @error="imageErrored = true"
        />
        <div class="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">
          <span>{{ store.getEventStatusBadge(props.event.date) }}</span>
        </div>
        <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <i class="fa-solid fa-users text-emerald-600" aria-hidden="true" />
          <span>{{ regStore.getSlotsTakenByEvent(props.event.id) }}/{{ props.event.quota }} Terisi</span>
        </div>
      </div>
      <div class="p-5">
        <NuxtLink
          :to="`/event/${props.event.id}`"
          class="font-bold text-lg text-slate-900 leading-snug hover:text-emerald-600 transition-colors block"
        >
          {{ props.event.title }}
        </NuxtLink>
        <span
          v-if="categoryName"
          class="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wider"
        >
          <i class="fa-solid fa-tag text-[10px]" aria-hidden="true" />
          {{ categoryName }}
        </span>
        <p class="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
          <i class="fa-solid fa-calendar-days text-slate-400" aria-hidden="true" />
          <span>{{ store.formatDate(props.event.date) }}</span>
        </p>
        <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <i class="fa-solid fa-location-dot text-slate-400" aria-hidden="true" />
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
        <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>
