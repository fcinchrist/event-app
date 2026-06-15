<script setup lang="ts">
import { useRegistrationStore } from '~/presentation/stores/registration'
import type { Event } from '~/domain/entities/event'
import type { RegistrationStatus } from '~/domain/entities/registration'
import {
  REGISTRATION_STATUS_VALUES,
  isRegistrationStatusValue,
} from '~/types/registration-status'

interface Props {
  modelValue: boolean
  event: Event | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const regStore = useRegistrationStore()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const participants = computed(() => {
  if (!props.event) return []
  return regStore.participantsByEvent[props.event.id] ?? []
})

const isLoading = computed(() => {
  if (!props.event) return false
  return regStore.isLoadingByEvent[props.event.id] === true
})

const search = ref('')

const filteredParticipants = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return participants.value
  return participants.value.filter((p) => {
    return (
      p.user.nama.toLowerCase().includes(q) ||
      p.user.noHp.includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  })
})

const STATUS_BADGE: Record<RegistrationStatus, string> = {
  Terdaftar: 'bg-amber-100 text-amber-800 border-amber-200',
  Hadir: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Tidak Hadir': 'bg-rose-100 text-rose-800 border-rose-200',
}

function safeStatus(s: string): RegistrationStatus {
  return isRegistrationStatusValue(s) ? s : REGISTRATION_STATUS_VALUES[0]
}

async function setStatus(
  regId: string,
  status: RegistrationStatus,
): Promise<void> {
  if (!props.event) return
  await regStore.markAttendance(props.event.id, regId, status)
}

const counts = computed(() => {
  const list = participants.value
  return {
    total: list.length,
    terdaftar: list.filter((p) => p.status === 'Terdaftar').length,
    hadir: list.filter((p) => p.status === 'Hadir').length,
    tidakHadir: list.filter((p) => p.status === 'Tidak Hadir').length,
  }
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && props.event) {
      // Refresh the participant list every time the modal opens
      void regStore.fetchParticipants(props.event.id)
      search.value = ''
    }
  },
)
</script>

<template>
  <UiAppModal
    v-model="open"
    :title="event ? `Peserta: ${event.title}` : 'Peserta Event'"
    max-width="max-w-2xl"
  >
    <div v-if="event" class="p-6">
      <!-- Stats ringkas -->
      <div class="grid grid-cols-4 gap-2 mb-4">
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-bold text-slate-500 uppercase">Total</p>
          <p class="font-extrabold text-slate-800 text-lg">{{ counts.total }}</p>
        </div>
        <div class="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-bold text-amber-700 uppercase">Terdaftar</p>
          <p class="font-extrabold text-amber-800 text-lg">{{ counts.terdaftar }}</p>
        </div>
        <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-bold text-emerald-700 uppercase">Hadir</p>
          <p class="font-extrabold text-emerald-800 text-lg">{{ counts.hadir }}</p>
        </div>
        <div class="bg-rose-50 border border-rose-100 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-bold text-rose-700 uppercase">Absen</p>
          <p class="font-extrabold text-rose-800 text-lg">{{ counts.tidakHadir }}</p>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500">
        <i class="fa-solid fa-magnifying-glass text-slate-400 text-xs" />
        <input
          v-model="search"
          type="text"
          placeholder="Cari nama, no HP, atau ID registrasi..."
          class="bg-transparent text-xs w-full focus:outline-none"
        >
      </div>

      <!-- Participants list -->
      <div class="max-h-[55vh] overflow-y-auto pr-1">
        <DashboardEventParticipantsSkeleton v-if="isLoading" :rows="5" />

        <div
          v-else-if="filteredParticipants.length === 0"
          class="py-10 text-center text-slate-400 italic text-sm"
        >
          <i class="fa-solid fa-user-slash text-2xl mb-2" />
          <p>
            {{
              participants.length === 0
                ? 'Belum ada peserta yang mendaftar untuk event ini.'
                : 'Tidak ada hasil pencarian.'
            }}
          </p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="reg in filteredParticipants"
            :key="reg.id"
            class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3"
          >
            <div class="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center font-extrabold text-emerald-700 shrink-0 text-xs">
              {{ reg.user.nama.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-grow min-w-0">
              <p class="font-bold text-slate-900 text-sm truncate">
                {{ reg.user.nama }}
              </p>
              <p class="text-[10px] text-slate-500 font-mono truncate">
                {{ reg.user.noHp }} · {{ reg.id }}
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                :class="STATUS_BADGE[safeStatus(reg.status)]"
                class="text-[9px] font-extrabold uppercase px-2 py-1 rounded-md border"
              >
                {{ safeStatus(reg.status) }}
              </span>
              <div class="flex flex-col gap-0.5">
                <button
                  type="button"
                  class="w-7 h-7 rounded-md flex items-center justify-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all disabled:opacity-40"
                  :disabled="reg.status === 'Hadir'"
                  title="Tandai Hadir"
                  @click="setStatus(reg.id, 'Hadir')"
                >
                  <i class="fa-solid fa-check text-[10px]" />
                </button>
                <button
                  type="button"
                  class="w-7 h-7 rounded-md flex items-center justify-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all disabled:opacity-40"
                  :disabled="reg.status === 'Tidak Hadir'"
                  title="Tandai Tidak Hadir"
                  @click="setStatus(reg.id, 'Tidak Hadir')"
                >
                  <i class="fa-solid fa-xmark text-[10px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiAppModal>
</template>
