<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

/**
 * Halaman ganti password untuk admin yang SEDANG LOGIN.
 *
 * Beda dengan `/admin/reset-password` (alur "lupa password" via link
 * email) — di sini user sudah login dan memasukkan password lama
 * untuk membuktikan identitas sebelum password baru disimpan.
 *
 * Guard: hanya admin yang sudah login yang boleh akses. Kalau
 * belum login → redirect ke `/admin/login`.
 */
definePageMeta({
  layout: 'default',
  middleware: ['auth'],
})

const store = useAppStore()
const config = useRuntimeConfig()
const route = useRoute()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)

/**
 * Toggle visibility per field. 3 state terpisah supaya user
 * bisa show/hide masing-masing input secara independen.
 */
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

async function handleChangePassword(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  const error = await store.changePassword(
    currentPassword.value,
    newPassword.value,
    confirmPassword.value,
  )
  isLoading.value = false

  if (!error) {
    successMessage.value =
      'Password berhasil diperbarui. Anda tetap login di sesi ini.'
    // Clear sensitive fields
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    showCurrent.value = false
    showNew.value = false
    showConfirm.value = false
  } else {
    errorMessage.value = error
  }
}

/**
 * Hitung kekuatan password secara client-side (heuristik
 * sederhana). Return label Indonesia + tone warna untuk badge.
 *   - 'weak'    : < 6 karakter ATAU semua digit
 *   - 'medium'  : 6-9 karakter, ada huruf
 *   - 'strong'  : ≥ 10 karakter + ada angka + ada simbol
 */
const passwordStrength = computed<
  { label: string; tone: 'rose' | 'amber' | 'emerald' } | null
>(() => {
  const pw = newPassword.value
  if (!pw) return null
  if (pw.length < 6) return { label: 'Lemah', tone: 'rose' }
  const hasLetter = /[A-Za-z]/.test(pw)
  const hasNumber = /\d/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  if (pw.length >= 10 && hasLetter && hasNumber && hasSymbol) {
    return { label: 'Kuat', tone: 'emerald' }
  }
  return { label: 'Sedang', tone: 'amber' }
})

const STRENGTH_CLASS: Record<'rose' | 'amber' | 'emerald', string> = {
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="w-full max-w-md">
      <!--
        Card utama: shadow + border tipis. Padding konsisten
        (p-6) dengan halaman auth lain (/admin/login, /admin/reset-password)
        supaya feel-nya nyambung.
      -->
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-center">
          <div class="bg-emerald-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/30">
            <i class="fa-solid fa-key text-2xl" />
          </div>
          <h2 class="text-xl font-black text-white tracking-tight">Ubah Password</h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ config.public.companyName }} Event Management
          </p>
        </div>

        <!-- Akun aktif info -->
        <div class="px-6 pt-5">
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <i class="fa-solid fa-shield-halved text-emerald-600" />
            <span class="text-slate-500">Login sebagai:</span>
            <span class="font-bold text-slate-800 truncate">{{ store.authUser?.email }}</span>
          </div>
        </div>

        <!-- Form -->
        <form
          class="p-6 space-y-5"
          novalidate
          @submit.prevent="handleChangePassword"
        >
          <p class="text-xs text-slate-500 text-center">
            Masukkan password lama Anda, lalu pilih password baru yang kuat.
          </p>

          <!-- Current Password -->
          <div>
            <label
              for="cp-current"
              class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              Password Lama
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-lock text-sm" />
              </span>
              <input
                id="cp-current"
                v-model="currentPassword"
                :type="showCurrent ? 'text' : 'password'"
                placeholder="Password Anda saat ini"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                autocomplete="current-password"
                required
              >
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-emerald-600 transition-colors"
                :aria-label="showCurrent ? 'Sembunyikan password' : 'Tampilkan password'"
                @click="showCurrent = !showCurrent"
              >
                <i :class="showCurrent ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
              </button>
            </div>
          </div>

          <!-- New Password -->
          <div>
            <label
              for="cp-new"
              class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              Password Baru
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-key text-sm" />
              </span>
              <input
                id="cp-new"
                v-model="newPassword"
                :type="showNew ? 'text' : 'password'"
                placeholder="Minimal 6 karakter"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                autocomplete="new-password"
                required
              >
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-emerald-600 transition-colors"
                :aria-label="showNew ? 'Sembunyikan password' : 'Tampilkan password'"
                @click="showNew = !showNew"
              >
                <i :class="showNew ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
              </button>
            </div>
            <!-- Strength badge (muncul setelah user mulai mengetik) -->
            <div
              v-if="passwordStrength"
              class="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold"
            >
              <span
                :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full border', STRENGTH_CLASS[passwordStrength.tone]]"
              >
                <i :class="[
                  'fa-solid',
                  passwordStrength.tone === 'rose' ? 'fa-circle-exclamation'
                    : passwordStrength.tone === 'amber' ? 'fa-circle-half-stroke'
                    : 'fa-circle-check',
                ]" />
                Kekuatan: {{ passwordStrength.label }}
              </span>
              <span class="text-slate-400 font-medium">
                · Minimal 6 karakter, kombinasikan huruf & angka untuk hasil terbaik.
              </span>
            </div>
          </div>

          <!-- Confirm Password -->
          <div>
            <label
              for="cp-confirm"
              class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              Konfirmasi Password Baru
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-key text-sm" />
              </span>
              <input
                id="cp-confirm"
                v-model="confirmPassword"
                :type="showConfirm ? 'text' : 'password'"
                placeholder="Ulangi password baru"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                autocomplete="new-password"
                required
              >
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-emerald-600 transition-colors"
                :aria-label="showConfirm ? 'Sembunyikan password' : 'Tampilkan password'"
                @click="showConfirm = !showConfirm"
              >
                <i :class="showConfirm ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="errorMessage"
            class="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start"
            role="alert"
          >
            <i class="fa-solid fa-circle-exclamation text-rose-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ errorMessage }}</p>
          </div>

          <!-- Success Message -->
          <div
            v-if="successMessage"
            class="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start"
            role="status"
            aria-live="polite"
          >
            <i class="fa-solid fa-circle-check text-emerald-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ successMessage }}</p>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <template v-if="isLoading">
              <i class="fa-solid fa-spinner animate-spin" /> Memproses...
            </template>
            <template v-else>
              <i class="fa-solid fa-floppy-disk" /> Simpan Password Baru
            </template>
          </button>

          <div class="text-center space-y-2">
            <!--
              Tombol "Kembali": kalau ada `redirect` query (dari
              middleware auth), pakai itu. Default ke dashboard.
            -->
            <NuxtLink
              :to="(route.query.redirect as string) || '/dashboard'"
              class="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              <i class="fa-solid fa-arrow-left" /> Kembali
            </NuxtLink>
            <br>
            <NuxtLink
              to="/admin/forgot-password"
              class="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              <i class="fa-solid fa-question-circle" /> Lupa password lama?
            </NuxtLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
