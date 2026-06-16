<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

const appStore = useAppStore()
const regStore = useRegistrationStore()

// "Now" flag kept in sync between the UI and handlers.
// When the calendar day rolls over (e.g. the user keeps the page open
// past midnight), the `isPast` computed re-evaluates and the UI updates.
const now = ref(new Date())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // A 1-minute tick is enough: the comparison is day-level (YYYY-MM-DD),
  // and the interval also keeps the value fresh if the tab sits idle.
  nowTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer)
})

// Local form state (never mirrored to a global store)
const noHp = ref('')
const nama = ref('')
const inlineError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const wasAutofilled = ref(false)

/**
 * Debounce timer for the phone lookup. We use 600ms (per product spec)
 * so Supabase isn't hammered on every keystroke.
 */
let lookupTimer: ReturnType<typeof setTimeout> | null = null

function onPhoneInput(e?: Event): void {
  wasAutofilled.value = false
  inlineError.value = null
  successMessage.value = null
  // Strip non-digit characters (spaces, +, -, etc.) per the spec:
  // "phone input should only allow numbers". Users who paste a
  // number with a +62 / 62- prefix get it visually normalized to
  // digits only. The final normalization to the 08… format still
  // happens server-side via `normalizePhone`.
  if (e) {
    const target = e.target as HTMLInputElement
    const stripped = target.value.replace(/\D/g, '')
    if (stripped !== target.value) {
      target.value = stripped
    }
    noHp.value = stripped
  }
  if (lookupTimer) clearTimeout(lookupTimer)
  lookupTimer = setTimeout(() => {
    void lookupUser()
  }, 600)
}

async function lookupUser(): Promise<void> {
  const normalized = normalizePhone(noHp.value)
  if (!normalized) return
  const user = await regStore.lookupUserByPhone(normalized)
  if (user) {
    nama.value = user.nama
    wasAutofilled.value = true
  }
}

async function onPhoneBlur(): Promise<void> {
  if (lookupTimer) {
    clearTimeout(lookupTimer)
    lookupTimer = null
  }
  await lookupUser()
}

async function handleSubmit(): Promise<void> {
  inlineError.value = null
  successMessage.value = null

  if (!appStore.selectedEvent) return

  // Client-side guard for UX: if the event is already past / closed,
  // do not send the request. The authoritative check still lives in
  // the BookEvent use case on the server.
  if (isPast.value) {
    inlineError.value = 'Maaf, event ini sudah lewat dan tidak bisa di-booking lagi.'
    return
  }
  if (isClosed.value) {
    inlineError.value = 'Maaf, event ini sudah ditutup atau dibatalkan.'
    return
  }
  if (isFull.value) {
    inlineError.value = 'Pendaftaran ditutup karena kuota sudah penuh.'
    return
  }

  const phoneTrim = noHp.value.trim()
  if (!phoneTrim) {
    inlineError.value = 'Nomor WhatsApp wajib diisi.'
    return
  }
  if (!nama.value.trim() || nama.value.trim().length < 2) {
    inlineError.value = 'Nama wajib diisi (min. 2 karakter).'
    return
  }

  const result = await regStore.registerForEvent({
    noHp: phoneTrim,
    nama: nama.value.trim(),
    eventId: appStore.selectedEvent.id,
  })

  if (result) {
    inlineError.value = result
    return
  }
  successMessage.value = 'Reservasi sukses! Nama Anda telah masuk ke list peserta.'
  noHp.value = ''
  nama.value = ''
  wasAutofilled.value = false
}

const slotsTaken = computed(() => {
  if (!appStore.selectedEvent) return 0
  return regStore.getSlotsTakenByEvent(appStore.selectedEvent.id)
})

const isFull = computed(() => {
  if (!appStore.selectedEvent) return false
  return slotsTaken.value >= appStore.selectedEvent.quota
})

/**
 * True when the event date is before today (compared at the day level,
 * YYYY-MM-DD). Used to disable the form and show a "past event" banner
 * before the user attempts to submit. The authoritative validation still
 * lives in the BookEvent use case to prevent client-side bypass.
 */
const isPast = computed(() => {
  if (!appStore.selectedEvent?.date) return false
  const todayStr = now.value.toISOString().slice(0, 10)
  const eventStr = appStore.selectedEvent.date.slice(0, 10)
  return eventStr < todayStr
})

/**
 * True when the event status is Cancelled (Dibatalkan) or Finished
 * (Selesai). Used to disable the form and show a banner so users
 * don't waste time filling it in.
 */
const isClosed = computed(() => {
  const status = appStore.selectedEvent?.status
  return status === 'Dibatalkan' || status === 'Selesai'
})

const isBookingDisabled = computed(() => {
  return isFull.value || isPast.value || isClosed.value
})
</script>

<template>
  <div
    v-if="appStore.selectedEvent"
    class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4"
  >
    <div>
      <h3 class="font-extrabold text-slate-900 text-lg">Amankan Tiket Anda</h3>
      <p class="text-xs text-slate-500 mt-0.5">
        Isi nomor WhatsApp Anda. Nama akan otomatis terisi kalau sudah pernah daftar.
      </p>
    </div>

    <!-- Kuota -->
    <div class="flex items-center justify-between text-[11px]">
      <span class="text-slate-500 font-medium">Slot terisi</span>
      <span class="font-extrabold text-slate-700">
        {{ slotsTaken }} / {{ appStore.selectedEvent.quota }}
      </span>
    </div>
    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div
        class="h-full bg-emerald-500 transition-all"
        :style="{ width: `${Math.min(100, (slotsTaken / appStore.selectedEvent.quota) * 100)}%` }"
      />
    </div>

    <!-- Past / closed warnings: shown in parallel above the form, each one
         only when relevant. Full + Past + Closed are checked independently. -->
    <div
      v-if="isFull"
      class="bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-xl text-xs flex gap-2"
    >
      <i class="fa-solid fa-circle-exclamation text-base text-rose-500 shrink-0" />
      <p class="font-medium">Pendaftaran ditutup karena kuota batas maksimum room sudah penuh terisi.</p>
    </div>
    <div
      v-if="isPast"
      class="bg-slate-50 border border-slate-200 text-slate-700 p-3.5 rounded-xl text-xs flex gap-2"
    >
      <i class="fa-solid fa-calendar-xmark text-base text-slate-500 shrink-0" />
      <p class="font-medium">Event ini sudah lewat. Pendaftaran telah ditutup dan tidak dapat diproses.</p>
    </div>
    <div
      v-if="isClosed"
      class="bg-amber-50 border border-amber-100 text-amber-800 p-3.5 rounded-xl text-xs flex gap-2"
    >
      <i class="fa-solid fa-ban text-base text-amber-500 shrink-0" />
      <p class="font-medium">Event ini sudah dibatalkan atau ditutup oleh panitia.</p>
    </div>

    <div v-if="!isBookingDisabled" class="space-y-3.5">
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor WhatsApp</label>
        <input
          v-model="noHp"
          type="tel"
          inputmode="numeric"
          placeholder="Contoh: 08123456789"
          class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          :disabled="regStore.isSubmittingBooking"
          @input="onPhoneInput"
          @blur="onPhoneBlur"
        >
        <p v-if="regStore.isLookingUpUser" class="mt-1 text-[10px] text-slate-400 italic flex items-center gap-1">
          <i class="fa-solid fa-spinner fa-spin" /> Mengecek data...
        </p>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</label>
        <input
          v-model="nama"
          type="text"
          placeholder="Contoh: Budi Santoso"
          class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          :disabled="regStore.isSubmittingBooking"
        >
        <p v-if="wasAutofilled" class="mt-1 text-[10px] text-emerald-600 font-medium flex items-center gap-1">
          <i class="fa-solid fa-circle-check" /> Otomatis terisi dari data sebelumnya.
        </p>
      </div>

      <div
        v-if="inlineError"
        class="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-xs flex gap-2"
      >
        <i class="fa-solid fa-circle-exclamation text-rose-500 shrink-0 mt-0.5" />
        <span class="font-medium">{{ inlineError }}</span>
      </div>
      <div
        v-if="successMessage"
        class="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs flex gap-2"
      >
        <i class="fa-solid fa-circle-check text-emerald-500 shrink-0 mt-0.5" />
        <span class="font-medium">{{ successMessage }}</span>
      </div>

      <button
        type="button"
        class="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="regStore.isSubmittingBooking || isBookingDisabled"
        @click="handleSubmit"
      >
        <i
          v-if="!regStore.isSubmittingBooking"
          class="fa-solid fa-paper-plane text-xs"
        />
        <i v-else class="fa-solid fa-spinner fa-spin text-xs" />
        {{
          regStore.isSubmittingBooking
            ? 'Memproses...'
            : isPast
              ? 'Pendaftaran Ditutup'
              : isClosed
                ? 'Event Ditutup'
                : 'Booking Sekarang'
        }}
      </button>
    </div>
  </div>
</template>
