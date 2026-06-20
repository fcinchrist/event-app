<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAppStore } from '~/presentation/stores/app'
import { useLoginThrottle } from '~/presentation/composables/useLoginThrottle'

definePageMeta({
  layout: 'default',
})

const store = useAppStore()
const config = useRuntimeConfig()
const throttle = useLoginThrottle()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

// Reset error saat user mulai edit (UX: jangan biarkan pesan error lama
// membingungkan setelah admin koreksi input).
function clearError(): void {
  if (errorMessage.value) errorMessage.value = ''
}

// Format sisa waktu lockout jadi string "Xs" / "Xm Ys" untuk UI.
const lockoutLabel = computed<string>(() => {
  const ms = throttle.remainingMs.value
  if (ms <= 0) return ''
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} detik`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes} menit` : `${minutes} menit ${seconds} detik`
})

// Apakah button submit harus disabled?
const isSubmitDisabled = computed<boolean>(
  () => isLoading.value || throttle.isLocked.value,
)

// Apakah user sedang dalam window locked (untuk pesan info di atas form)?
const showLockBanner = computed<boolean>(() => throttle.isLocked.value)

// Redirect if already logged in
onMounted(async () => {
  await store.initAuth()
  if (store.isAdminLoggedIn) {
    navigateTo('/')
  }
})

async function handleLogin(): Promise<void> {
  errorMessage.value = ''
  // Cek throttle dulu — kalau locked, jangan panggil server.
  const lockMsg = throttle.check(email.value)
  if (lockMsg) {
    errorMessage.value = lockMsg
    return
  }
  isLoading.value = true
  const error = await store.loginAdmin(email.value, password.value)
  isLoading.value = false
  if (!error) {
    navigateTo('/')
  } else {
    errorMessage.value = error
  }
}

// Bersihin composable state saat unmount (best-effort; composable
// sebenarnya sudah handle via onScopeDispose, tapi ini defensive).
onBeforeUnmount(() => {
  // Tidak ada side-effect cleanup yang perlu dilakukan di sini.
})
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-center">
          <div class="bg-emerald-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/30">
            <i class="fa-solid fa-shield-halved text-2xl" />
          </div>
          <h2 class="text-xl font-black text-white tracking-tight">Admin Login</h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ config.public.companyName }} Event Management
          </p>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-5">
          <!-- Lockout Banner -->
          <div
            v-if="showLockBanner"
            class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs flex gap-2 items-start"
          >
            <i class="fa-solid fa-lock text-amber-500 shrink-0 mt-0.5" />
            <div class="space-y-0.5">
              <p class="font-bold">
                Login sementara terkunci.
              </p>
              <p class="font-medium">
                Terlalu banyak percobaan gagal. Coba lagi dalam
                <span class="font-bold">{{ lockoutLabel }}</span>.
              </p>
            </div>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-envelope text-sm" />
              </span>
              <input
                v-model="email"
                type="email"
                placeholder="admin@example.com"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                autocomplete="email"
                :disabled="isLoading || throttle.isLocked.value"
                @input="clearError"
              >
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-lock text-sm" />
              </span>
              <input
                v-model="password"
                type="password"
                placeholder="Masukkan password Anda"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                autocomplete="current-password"
                :disabled="isSubmitDisabled"
                @keydown.enter="handleLogin"
                @input="clearError"
              >
            </div>
          </div>

          <!-- Attempts hint (hanya tampil kalau belum locked & ada counter) -->
          <p
            v-if="!showLockBanner && throttle.attempts.value > 0 && throttle.remainingAttempts.value > 0"
            class="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"
          >
            <i class="fa-solid fa-circle-info text-slate-400" />
            {{ throttle.attempts.value }} percobaan gagal. Sisa
            <span class="font-bold text-slate-700">{{ throttle.remainingAttempts.value }}</span>
            sebelum login dikunci sementara.
          </p>

          <!-- Error Message -->
          <div
            v-if="errorMessage"
            class="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start"
          >
            <i class="fa-solid fa-circle-exclamation text-rose-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ errorMessage }}</p>
          </div>

          <button
            :disabled="isSubmitDisabled"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
            @click="handleLogin"
          >
            <template v-if="isLoading">
              <i class="fa-solid fa-spinner animate-spin" /> Memproses...
            </template>
            <template v-else-if="throttle.isLocked.value">
              <i class="fa-solid fa-lock" /> Terkunci — coba lagi dalam {{ lockoutLabel }}
            </template>
            <template v-else>
              <i class="fa-solid fa-arrow-right-to-bracket" /> Masuk sebagai Admin
            </template>
          </button>

          <div class="text-center space-y-2">
            <NuxtLink
              to="/admin/forgot-password"
              class="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              <i class="fa-solid fa-question-circle" /> Lupa password?
            </NuxtLink>
            <br>
            <NuxtLink
              to="/"
              class="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              <i class="fa-solid fa-arrow-left" /> Kembali ke halaman utama
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
