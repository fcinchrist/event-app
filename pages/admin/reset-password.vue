<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

definePageMeta({
  layout: 'default',
})

const store = useAppStore()
const config = useRuntimeConfig()

const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const isSessionValid = ref(false)

onMounted(async () => {
  // Supabase processes the recovery token from the URL hash automatically.
  // Wait briefly for session to be established from the token.
  await new Promise(resolve => setTimeout(resolve, 1000))
  await store.initAuth()

  if (store.isAdminLoggedIn) {
    isSessionValid.value = true
  } else {
    errorMessage.value = 'Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta link baru.'
  }
})

async function handleResetPassword(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  const error = await store.updatePassword(newPassword.value, confirmPassword.value)
  isLoading.value = false

  if (!error) {
    successMessage.value = 'Password berhasil diperbarui! Anda akan diarahkan ke halaman login...'
    setTimeout(() => {
      store.adminLogout().then(() => {
        navigateTo('/admin/login')
      })
    }, 2000)
  } else {
    errorMessage.value = error
  }
}
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-center">
          <div class="bg-emerald-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/30">
            <i class="fa-solid fa-key text-2xl" />
          </div>
          <h2 class="text-xl font-black text-white tracking-tight">Reset Password</h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ config.public.companyName }} Event Management
          </p>
        </div>

        <!-- Invalid Session -->
        <div v-if="errorMessage && !isSessionValid" class="p-6 space-y-5">
          <div class="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start">
            <i class="fa-solid fa-circle-exclamation text-rose-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ errorMessage }}</p>
          </div>
          <div class="text-center">
            <NuxtLink
              to="/admin/login"
              class="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              <i class="fa-solid fa-arrow-left" /> Kembali ke halaman login
            </NuxtLink>
          </div>
        </div>

        <!-- Reset Form -->
        <div v-else-if="isSessionValid && !successMessage" class="p-6 space-y-5">
          <p class="text-xs text-slate-500 text-center">
            Masukkan password baru Anda di bawah ini.
          </p>

          <!-- New Password -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Password Baru
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-lock text-sm" />
              </span>
              <input
                v-model="newPassword"
                type="password"
                placeholder="Minimal 6 karakter"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                autocomplete="new-password"
              >
            </div>
          </div>

          <!-- Confirm Password -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Konfirmasi Password
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-lock text-sm" />
              </span>
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="Ulangi password baru"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                autocomplete="new-password"
                @keydown.enter="handleResetPassword"
              >
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="errorMessage"
            class="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start"
          >
            <i class="fa-solid fa-circle-exclamation text-rose-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ errorMessage }}</p>
          </div>

          <button
            :disabled="isLoading"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
            @click="handleResetPassword"
          >
            <template v-if="isLoading">
              <i class="fa-solid fa-spinner animate-spin" /> Memproses...
            </template>
            <template v-else>
              <i class="fa-solid fa-key" /> Simpan Password Baru
            </template>
          </button>
        </div>

        <!-- Success -->
        <div v-else-if="successMessage" class="p-6 space-y-5">
          <div class="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start">
            <i class="fa-solid fa-circle-check text-emerald-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Loading state -->
        <div v-else class="p-6 text-center">
          <div class="text-slate-400 flex flex-col items-center gap-3">
            <i class="fa-solid fa-spinner animate-spin text-2xl" />
            <p class="text-xs font-medium">Memverifikasi link reset password...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
