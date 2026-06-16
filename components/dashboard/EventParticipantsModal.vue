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
 * Format an ISO timestamp → "16 Jun 2026, 13.21" (id-ID, short).
 * Used to display when attendance was verified. Returns an empty
 * string when the input is null / invalid.
 */
function formatVerifiedAt(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Compact relative time used inline next to the verifier email.
 * Examples (id-ID, friendly):
 *   - "baru saja"        (< 1 minute)
 *   - "5 menit lalu"
 *   - "2 jam lalu"
 *   - "kemarin"          (yesterday, same clock)
 *   - "3 hari lalu"
 *   - "16 Jun"           (same year)
 *   - "16 Jun 2025"      (different year)
 * Falls back to the same full format as `formatVerifiedAt` for old
 * timestamps that still need to be rendered.
 */
function relativeVerifiedAt(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHr = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHr / 24)

  if (diffSec < 60) return 'baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  if (diffHr < 24 && isSameCalendarDay(d, now)) {
    return `${diffHr} jam lalu`
  }
  if (diffDay === 1) return 'kemarin'
  if (diffDay < 7) return `${diffDay} hari lalu`

  // Older than a week → show the calendar date.
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
  }
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
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
/**
 * Label untuk filter status (dipakai di empty-state & aria-label).
 * Ditaruh sebagai map ringkas supaya template tidak dipenuhi
 * string panjang.
 */
const FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Semua',
  pending: 'Belum Hadir',
  present: 'Hadir',
  absent: 'Tidak Hadir',
}

/**
 * Style untuk stat-card yang juga berfungsi sebagai filter tab.
 * Card aktif = filled sesuai tone, card idle = outlined soft.
 * min-h-[64px] di mobile / 72px di desktop supaya tap target
 * tetap nyaman (di atas standar 48px).
 */
function statCardClass(key: StatusFilter): string {
  const active = statusFilter.value === key
  const base = 'min-h-[64px] sm:min-h-[72px] rounded-xl p-2 transition-all border-2 active:scale-[0.97] flex flex-col items-center justify-center'
  if (active) {
    const filledMap: Record<StatusFilter, string> = {
      all: 'bg-slate-700 text-white border-slate-700',
      pending: 'bg-amber-500 text-white border-amber-500',
      present: 'bg-emerald-600 text-white border-emerald-600',
      absent: 'bg-rose-600 text-white border-rose-600',
    }
    return `${base} ${filledMap[key]}`
  }
  const idleMap: Record<StatusFilter, string> = {
    all: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
    pending: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    present: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    absent: 'bg-rose-50 border-rose-200 hover:bg-rose-100',
  }
  return `${base} ${idleMap[key]}`
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
      <!-- ============ Stats sekaligus filter ============
           4 stat card clickable yang juga berfungsi sebagai filter
           tab. Tap card = filter list sesuai status. Tidak ada duplikasi
           informasi — angka dan filter jadi satu. -->
      <div class="grid grid-cols-4 gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="statusFilter === 'all'"
          :class="statCardClass('all')"
          @click="statusFilter = 'all'"
        >
          <p class="text-[10px] font-extrabold text-slate-500 uppercase">Total</p>
          <p class="font-extrabold text-slate-800 text-2xl mt-0.5">{{ counts.total }}</p>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="statusFilter === 'pending'"
          :class="statCardClass('pending')"
          @click="statusFilter = 'pending'"
        >
          <p :class="['text-[10px] font-extrabold uppercase', statusFilter === 'pending' ? 'text-white' : 'text-amber-700']">Belum</p>
          <p :class="['font-extrabold text-2xl mt-0.5', statusFilter === 'pending' ? 'text-white' : 'text-amber-700']">{{ counts.terdaftar }}</p>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="statusFilter === 'present'"
          :class="statCardClass('present')"
          @click="statusFilter = 'present'"
        >
          <p :class="['text-[10px] font-extrabold uppercase', statusFilter === 'present' ? 'text-white' : 'text-emerald-700']">Hadir</p>
          <p :class="['font-extrabold text-2xl mt-0.5', statusFilter === 'present' ? 'text-white' : 'text-emerald-700']">{{ counts.hadir }}</p>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="statusFilter === 'absent'"
          :class="statCardClass('absent')"
          @click="statusFilter = 'absent'"
        >
          <p :class="['text-[10px] font-extrabold uppercase', statusFilter === 'absent' ? 'text-white' : 'text-rose-700']">Absen</p>
          <p :class="['font-extrabold text-2xl mt-0.5', statusFilter === 'absent' ? 'text-white' : 'text-rose-700']">{{ counts.tidakHadir }}</p>
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
                ? `Tidak ada peserta di status "${FILTER_LABEL[statusFilter]}".`
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

            <!-- Info: nama + no HP + (jika sudah diverifikasi) siapa & kapan -->
            <div class="flex-grow min-w-0">
              <p class="font-bold text-slate-900 text-base truncate">
                {{ reg.user.nama }}
              </p>
              <p class="text-sm text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                <i class="fa-brands fa-whatsapp text-emerald-500 shrink-0" />
                <span>{{ reg.user.noHp }}</span>
              </p>
              <!--
                Audit trail (migration #5): show who performed the
                verification + when. Only rendered when the row has
                actually been verified (status is not 'Terdaftar').
                The visible time uses a compact, relative form
                ("5 menit lalu", "kemarin", "16 Jun") and the full
                timestamp is exposed via the native `title` tooltip
                on hover.
              -->
              <p
                v-if="reg.status !== 'Terdaftar' && reg.verifiedByEmail"
                class="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5"
                :title="`Diverifikasi pada ${formatVerifiedAt(reg.verifiedAt)}`"
              >
                <i class="fa-solid fa-user-check text-slate-400 shrink-0" />
                <span class="truncate">
                  oleh
                  <span class="font-semibold text-slate-500">{{ reg.verifiedByEmail }}</span>
                </span>
                <span
                  v-if="reg.verifiedAt"
                  class="shrink-0"
                  aria-hidden="true"
                >
                  · {{ relativeVerifiedAt(reg.verifiedAt) }}
                </span>
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
