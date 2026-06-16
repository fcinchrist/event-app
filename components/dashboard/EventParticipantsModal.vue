<script setup lang="ts">
import { useRegistrationStore } from '~/presentation/stores/registration'
import type { Event } from '~/domain/entities/event'
import type { RegistrationStatus } from '~/domain/entities/registration'
import {
  REGISTRATION_STATUS_VALUES,
  isRegistrationStatusValue,
} from '~/types/registration-status'
import { createLogger } from '~/utils/logger'

interface Props {
  modelValue: boolean
  event: Event | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const regStore = useRegistrationStore()
const log = createLogger('EventParticipantsModal')

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

/**
 * Filter status: 'all' | 'pending' (Belum Hadir) | 'present' (Hadir)
 * | 'absent' (Tidak Hadir). Default 'pending' supaya operator bisa
 * fokus menandai yang belum di-check-in (alur paling umum saat
 * event baru dimulai).
 */
type StatusFilter = 'all' | 'pending' | 'present' | 'absent'
const statusFilter = ref<StatusFilter>('pending')

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

/**
 * Toast feedback setelah operator tap tombol Hadir/Absen.
 * Pakai `aria-live="polite"` supaya screen reader juga
 * mengumumkan — penting untuk aksesibilitas.
 */
const toast = ref<Toast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(type: Toast['type'], message: string): void {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = {
    id: Date.now(),
    type,
    message,
  }
  toastTimer = setTimeout(() => {
    toast.value = null
  }, 2500)
}

const filteredParticipants = computed(() => {
  const q = search.value.trim().toLowerCase()
  const filter = statusFilter.value
  return participants.value.filter((p) => {
    // Filter status
    if (filter === 'pending' && p.status !== 'Terdaftar') return false
    if (filter === 'present' && p.status !== 'Hadir') return false
    if (filter === 'absent' && p.status !== 'Tidak Hadir') return false
    // Filter search (cukup nama + no HP, ID registrasi disembunyikan
    // supaya tidak membingungkan operator)
    if (!q) return true
    return (
      p.user.nama.toLowerCase().includes(q) ||
      p.user.noHp.includes(q)
    )
  })
})

const STATUS_BADGE: Record<RegistrationStatus, { badge: string; dot: string }> = {
  Terdaftar: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  Hadir: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  'Tidak Hadir': {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
}

function safeStatus(s: string): RegistrationStatus {
  return isRegistrationStatusValue(s) ? s : REGISTRATION_STATUS_VALUES[0]
}

/**
 * Cegah double-tap saat request sedang jalan. Operator yang
 * panik kadang tap beberapa kali — `busyRegId` memastikan
 * setiap baris hanya diproses satu per satu.
 */
const busyRegId = ref<string | null>(null)
async function setStatus(
  reg: { id: string; user: { nama: string } },
  status: RegistrationStatus,
): Promise<void> {
  if (!props.event) return
  if (busyRegId.value !== null) return
  busyRegId.value = reg.id
  try {
    const err = await regStore.markAttendance(props.event.id, reg.id, status)
    if (err) {
      log.warn('Mark attendance failed', { regId: reg.id, err })
      showToast('error', `Gagal mencatat: ${err}`)
    } else {
      const label = status === 'Hadir' ? 'Hadir' : 'Tidak Hadir'
      showToast('success', `✓ ${reg.user.nama} dicatat ${label}`)
    }
  } finally {
    busyRegId.value = null
  }
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
      // Default ke "Belum Hadir" setiap kali modal dibuka
      statusFilter.value = 'pending'
      toast.value = null
    }
  },
)

/**
 * Label pendek untuk tab filter status. Ditaruh di computed
 * supaya template tidak dipenuhi string panjang.
 */
const FILTER_TABS: { key: StatusFilter; label: string; tone: string }[] = [
  { key: 'all', label: 'Semua', tone: 'slate' },
  { key: 'pending', label: 'Belum Hadir', tone: 'amber' },
  { key: 'present', label: 'Hadir', tone: 'emerald' },
  { key: 'absent', label: 'Tidak Hadir', tone: 'rose' },
]

function tabClass(tab: { key: StatusFilter; tone: string }): string {
  const active = statusFilter.value === tab.key
  const base = 'min-h-[44px] px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] border-2'
  if (!active) {
    return `${base} bg-white text-slate-600 border-slate-200 hover:bg-slate-50`
  }
  const toneMap: Record<string, string> = {
    slate: 'bg-slate-700 text-white border-slate-700',
    amber: 'bg-amber-500 text-white border-amber-500',
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    rose: 'bg-rose-600 text-white border-rose-600',
  }
  return `${base} ${toneMap[tab.tone] ?? toneMap.slate}`
}
</script>

<template>
  <UiAppModal
    v-model="open"
    :title="event ? `Absensi: ${event.title}` : 'Absensi Event'"
    subtitle="Tandai peserta yang hadir. Tap tombol hijau untuk HADIR, merah untuk TIDAK HADIR."
    max-width="max-w-2xl"
  >
    <div v-if="event" class="p-4 sm:p-6 space-y-4">
      <!-- ============ Stats ringkas ============ -->
      <div class="grid grid-cols-4 gap-2">
        <div class="bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-extrabold text-slate-500 uppercase">Total</p>
          <p class="font-extrabold text-slate-800 text-2xl mt-0.5">{{ counts.total }}</p>
        </div>
        <div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-extrabold text-amber-700 uppercase">Belum</p>
          <p class="font-extrabold text-amber-700 text-2xl mt-0.5">{{ counts.terdaftar }}</p>
        </div>
        <div class="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-extrabold text-emerald-700 uppercase">Hadir</p>
          <p class="font-extrabold text-emerald-700 text-2xl mt-0.5">{{ counts.hadir }}</p>
        </div>
        <div class="bg-rose-50 border-2 border-rose-200 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-extrabold text-rose-700 uppercase">Absen</p>
          <p class="font-extrabold text-rose-700 text-2xl mt-0.5">{{ counts.tidakHadir }}</p>
        </div>
      </div>

      <!-- ============ Filter tabs (Belum Hadir sebagai default) ============
           4 tab full-width di mobile (grid 2x2), inline di desktop.
           Sentuh 44px (min-h-[44px]), font 14px, label jelas. -->
      <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" role="tablist">
        <button
          v-for="tab in FILTER_TABS"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="statusFilter === tab.key"
          :class="tabClass(tab)"
          @click="statusFilter = tab.key"
        >
          <span>{{ tab.label }}</span>
          <span
            :class="[
              'text-xs font-extrabold px-1.5 py-0.5 rounded-md',
              statusFilter === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-600',
            ]"
          >
            {{
              tab.key === 'all' ? counts.total :
              tab.key === 'pending' ? counts.terdaftar :
              tab.key === 'present' ? counts.hadir :
              counts.tidakHadir
            }}
          </span>
        </button>
      </div>

      <!-- ============ Search ============ -->
      <div class="flex items-center gap-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
        <i class="fa-solid fa-magnifying-glass text-slate-400 text-base" />
        <input
          v-model="search"
          type="text"
          placeholder="Cari nama atau nomor HP…"
          class="min-h-[48px] bg-transparent text-base w-full focus:outline-none placeholder:text-slate-400"
        >
      </div>

      <!-- ============ Participants list ============ -->
      <div class="max-h-[55vh] overflow-y-auto pr-1 -mr-1">
        <DashboardEventParticipantsSkeleton v-if="isLoading" :rows="5" />

        <div
          v-else-if="filteredParticipants.length === 0"
          class="py-12 text-center text-slate-500"
        >
          <i class="fa-solid fa-user-slash text-3xl text-slate-300 mb-2" />
          <p class="text-base font-semibold">
            {{
              statusFilter !== 'all'
                ? `Tidak ada peserta di status "${FILTER_TABS.find((t) => t.key === statusFilter)?.label}".`
                : participants.length === 0
                  ? 'Belum ada peserta yang mendaftar untuk event ini.'
                  : 'Tidak ada hasil pencarian.'
            }}
          </p>
          <button
            v-if="statusFilter !== 'all'"
            type="button"
            class="mt-3 text-sm font-bold text-emerald-700 underline"
            @click="statusFilter = 'all'"
          >
            Tampilkan semua peserta
          </button>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="reg in filteredParticipants"
            :key="reg.id"
            class="p-3 sm:p-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-wrap sm:flex-nowrap items-center gap-3"
          >
            <!-- Avatar inisial lebih besar (w-12 h-12) -->
            <div class="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center font-extrabold text-emerald-700 text-lg shrink-0">
              {{ reg.user.nama.charAt(0).toUpperCase() }}
            </div>

            <!-- Info: nama + no HP (tanpa ID registrasi) -->
            <div class="flex-grow min-w-0">
              <p class="font-bold text-slate-900 text-base truncate">
                {{ reg.user.nama }}
              </p>
              <p class="text-sm text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                <i class="fa-brands fa-whatsapp text-emerald-500 shrink-0" />
                <span>{{ reg.user.noHp }}</span>
              </p>
            </div>

            <!-- Badge status (lebih besar, tidak uppercase 9px) -->
            <span
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border-2 shrink-0',
                STATUS_BADGE[safeStatus(reg.status)].badge,
              ]"
            >
              <span :class="['w-2 h-2 rounded-full', STATUS_BADGE[safeStatus(reg.status)].dot]" />
              {{ safeStatus(reg.status) }}
            </span>

            <!-- Tombol HADIR & TIDAK HADIR
                 - min-h-12 (48px) standar touch target
                 - ada label teks, bukan icon-only
                 - border-2 untuk kontras jelas
                 - disabled saat status sudah sama atau sedang busy
                 - active:scale-[0.98] untuk tap feedback -->
            <div class="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                :class="[
                  'flex-1 sm:flex-initial min-h-[48px] px-3 sm:px-4 rounded-xl text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all border-2 active:scale-[0.98]',
                  reg.status === 'Hadir'
                    ? 'bg-emerald-600 text-white border-emerald-600 cursor-default'
                    : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50',
                ]"
                :disabled="reg.status === 'Hadir' || busyRegId === reg.id"
                :aria-label="`Tandai ${reg.user.nama} hadir`"
                @click="setStatus(reg, 'Hadir')"
              >
                <i
                  :class="[
                    reg.status === 'Hadir' ? 'fa-solid fa-circle-check' : 'fa-solid fa-check',
                    busyRegId === reg.id ? 'fa-spinner' : '',
                  ]"
                />
                <span>Hadir</span>
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 sm:flex-initial min-h-[48px] px-3 sm:px-4 rounded-xl text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all border-2 active:scale-[0.98]',
                  reg.status === 'Tidak Hadir'
                    ? 'bg-rose-600 text-white border-rose-600 cursor-default'
                    : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50',
                ]"
                :disabled="reg.status === 'Tidak Hadir' || busyRegId === reg.id"
                :aria-label="`Tandai ${reg.user.nama} tidak hadir`"
                @click="setStatus(reg, 'Tidak Hadir')"
              >
                <i
                  :class="[
                    reg.status === 'Tidak Hadir' ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-xmark',
                    busyRegId === reg.id ? 'fa-spinner' : '',
                  ]"
                />
                <span>Tidak Hadir</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ Toast feedback ============
           Sticky di bawah modal, animasi slide-up. role=status +
           aria-live=polite untuk screen reader. -->
      <Transition name="toast">
        <div
          v-if="toast"
          :key="toast.id"
          :class="[
            'fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-extrabold flex items-center gap-2 border-2',
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-rose-600 text-white border-rose-700',
          ]"
          role="status"
          aria-live="polite"
        >
          <i
            :class="[
              'fa-solid text-base',
              toast.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation',
            ]"
          />
          <span>{{ toast.message }}</span>
        </div>
      </Transition>
    </div>
  </UiAppModal>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
