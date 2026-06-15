<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useRegistrationStore } from '~/presentation/stores/registration'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

const appStore = useAppStore()
const regStore = useRegistrationStore()

// Flag "sekarang" agar konsisten dipakai bersama antara UI & handler.
// Saat hari berganti (mis. user buka halaman melewati tengah malam),
// computed isPast akan ikut re-evaluasi dan UI terupdate otomatis.
const now = ref(new Date())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // Tick tiap 1 menit cukup: granularity pembanding di sini YYYY-MM-DD,
  // tapi interval ini juga menjaga konsistensi kalau tab idle lama.
  nowTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer)
})

// Form state lokal (tidak masuk ke global store)
const noHp = ref('')
const nama = ref('')
const inlineError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const wasAutofilled = ref(false)

/**
 * Lookup debounce timer. Kita pakai 600ms (sesuai requirement user)
 * supaya tidak bombard Supabase setiap keystroke.
 */
let lookupTimer: ReturnType<typeof setTimeout> | null = null

function onPhoneInput(): void {
  wasAutofilled.value = false
  inlineError.value = null
  successMessage.value = null
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

  // Guard client-side untuk UX: kalau event sudah lewat / ditutup,
  // jangan kirim request. Validasi akhir tetap ada di server (use case).
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
 * True kalau tanggal event sudah lewat dari hari ini (level hari, YYYY-MM-DD).
 * Dipakai untuk disable form & tampilkan banner "sudah lewat" sebelum user
 * mencoba submit. Validasi authoritative tetap ada di BookEvent use case
 * untuk mencegah bypass dari client.
 */
const isPast = computed(() => {
  if (!appStore.selectedEvent?.date) return false
  const todayStr = now.value.toISOString().slice(0, 10)
  const eventStr = appStore.selectedEvent.date.slice(0, 10)
  return eventStr < todayStr
})

/**
 * True kalau event ber-status Dibatalkan atau Selesai. Dipakai untuk
 * disable form & tampilkan banner agar user tidak salah input.
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

    <!-- Past / closed warnings: tampil paralel di atas form, masing-masing
         hanya kalau relevan. Full + Past + Closed dicek independent. -->
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
