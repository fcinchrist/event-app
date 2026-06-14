<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import type { RegistrationStatus } from '~/domain/entities/registration'
import {
  REGISTRATION_STATUS_VALUES,
  isRegistrationStatusValue,
} from '~/types/registration-status'

const appStore = useAppStore()
const regStore = useRegistrationStore()

const participants = computed(() => {
  const id = appStore.selectedEvent?.id
  if (!id) return []
  return regStore.participantsByEvent[id] ?? []
})

const isLoading = computed(() => {
  const id = appStore.selectedEvent?.id
  if (!id) return false
  return regStore.isLoadingByEvent[id] === true
})

const totalCount = computed(() => participants.value.length)

const hadirCount = computed(
  () => participants.value.filter((p) => p.status === 'Hadir').length,
)

const STATUS_BADGE: Record<RegistrationStatus, string> = {
  Terdaftar: 'bg-amber-100 text-amber-800',
  Hadir: 'bg-emerald-100 text-emerald-800',
  'Tidak Hadir': 'bg-rose-100 text-rose-800',
}

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  Terdaftar: 'Terdaftar',
  Hadir: 'Hadir',
  'Tidak Hadir': 'Tidak Hadir',
}

/**
 * Fallback: kalau nilai status dari DB ternyata tidak dikenal
 * (data legacy / corrupt), tetap render dengan label 'Terdaftar'.
 */
function safeStatus(s: string): RegistrationStatus {
  return isRegistrationStatusValue(s) ? s : REGISTRATION_STATUS_VALUES[0]
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`
}

onMounted(() => {
  const id = appStore.selectedEvent?.id
  if (id) {
    void regStore.fetchParticipants(id)
  }
})

watch(
  () => appStore.selectedEvent?.id,
  (newId) => {
    if (newId) {
      void regStore.fetchParticipants(newId)
    }
  },
)
</script>

<template>
  <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
    <div class="flex justify-between items-start gap-3">
      <div>
        <h3 class="font-bold text-slate-900 text-base">Peserta Terdaftar</h3>
        <p class="text-xs text-slate-500">
          List manifest reservasi saat ini untuk event ini.
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-xl text-xs font-bold">
          {{ totalCount }} Orang
        </span>
        <span class="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-xl text-[10px] font-extrabold">
          <i class="fa-solid fa-user-check" /> {{ hadirCount }}
        </span>
      </div>
    </div>

    <div class="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-2">
      <template v-if="isLoading">
        <div
          v-for="i in 4"
          :key="`pl-skel-${i}`"
          class="py-3 flex items-center justify-between gap-4"
        >
          <div class="flex items-center gap-3 min-w-0 flex-grow">
            <UiSkeletonBlock variant="circle" width="w-7" height="h-7" />
            <div class="flex-grow space-y-1.5 min-w-0">
              <UiSkeletonBlock variant="bar" width="w-2/3" height="h-3" />
              <UiSkeletonBlock variant="bar" width="w-1/2" height="h-2" />
            </div>
          </div>
          <UiSkeletonBlock variant="bar" width="w-14" height="h-4" rounded="rounded-md" />
        </div>
      </template>

      <template v-else>
        <div
          v-for="(reg, index) in participants"
          :key="reg.id"
          class="py-3 flex items-center justify-between gap-4 text-xs"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">
              {{ index + 1 }}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 truncate">
                {{ reg.user.nama }}
              </p>
              <p class="text-[10px] text-slate-400 font-mono">
                ID: {{ reg.id }} | WA: {{ maskPhone(reg.user.noHp) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              :class="STATUS_BADGE[safeStatus(reg.status)]"
              class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md"
            >
              {{ STATUS_LABELS[safeStatus(reg.status)] }}
            </span>
          </div>
        </div>

        <div
          v-if="participants.length === 0"
          class="py-8 text-center text-slate-400 italic"
        >
          Belum ada peserta yang membooking slot event ini.
        </div>
      </template>
    </div>
  </div>
</template>
