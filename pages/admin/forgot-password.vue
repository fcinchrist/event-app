<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '~/presentation/stores/app'
import { useRequestPasswordResetThrottle } from '~/presentation/composables/useRequestPasswordResetThrottle'

definePageMeta({
  layout: 'default',
})

const store = useAppStore()
const config = useRuntimeConfig()
const cooldown = useRequestPasswordResetThrottle()

const email = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)

// Format sisa cooldown jadi string "Xs" untuk UI.
const cooldownLabel = computed<string>(() => {
  const ms = cooldown.remainingMs.value
  if (ms <= 0) return ''
  return `${Math.ceil(ms / 1000)} detik`
})

const isSubmitDisabled = computed<boolean>(
  () => isLoading.value || cooldown.isCoolingDown.value,
)

async function handleForgotPassword(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''
  if (cooldown.isCoolingDown.value) {
    errorMessage.value = `Mohon tunggu ${cooldownLabel.value} sebelum mengirim ulang.`
    return
  }
  isLoading.value = true
  const error = await store.requestPasswordReset(email.value)
  isLoading.value = false
  // Sama seperti sebelumnya: kalau success, tampilkan pesan generik
  // (tidak membedakan email terdaftar atau tidak — Bug #3 mitigation).
  if (!error) {
    successMessage.value = 'Email reset password telah dikirim. Silakan cek inbox Anda (termasuk folder spam).'
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
            <i class="fa-solid fa-envelope-open-text text-2xl" />
          </div>
          <h2 class="text-xl font-black text-white tracking-tight">Lupa Password</h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ config.public.companyName }} Event Management
          </p>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-5">
          <p class="text-xs text-slate-500 text-center">
            Masukkan email akun admin Anda. Kami akan mengirimkan link untuk mereset password.
          </p>

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
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                autocomplete="email"
                :disabled="isLoading"
                @keydown.enter="handleForgotPassword"
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

          <!-- Success Message -->
          <div
            v-if="successMessage"
            class="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-xs flex gap-2 items-start"
          >
            <i class="fa-solid fa-circle-check text-emerald-500 shrink-0 mt-0.5" />
            <p class="font-medium">{{ successMessage }}</p>
          </div>

          <button
            :disabled="isSubmitDisabled"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
            @click="handleForgotPassword"
          >
            <template v-if="isLoading">
              <i class="fa-solid fa-spinner animate-spin" /> Mengirim...
            </template>
            <template v-else-if="cooldown.isCoolingDown.value">
              <i class="fa-solid fa-clock" /> Tunggu {{ cooldownLabel }} untuk kirim ulang
            </template>
            <template v-else>
              <i class="fa-solid fa-paper-plane" /> Kirim Link Reset Password
            </template>
          </button>

          <div class="text-center">
            <NuxtLink
              to="/admin/login"
              class="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              <i class="fa-solid fa-arrow-left" /> Kembali ke halaman login
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
