<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

definePageMeta({
  layout: 'default',
})

const store = useAppStore()
const config = useRuntimeConfig()

const password = ref('')
const errorMessage = ref('')

// Redirect if already logged in
onMounted(() => {
  if (store.isAdminLoggedIn) {
    navigateTo('/')
  }
})

function handleLogin(): void {
  errorMessage.value = ''
  if (!password.value.trim()) {
    errorMessage.value = 'Masukkan password admin Anda.'
    return
  }
  const success = store.adminLogin(password.value)
  if (success) {
    navigateTo('/')
  } else {
    errorMessage.value = 'Password salah. Silakan coba lagi.'
    password.value = ''
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
            <i class="fa-solid fa-shield-halved text-2xl" />
          </div>
          <h2 class="text-xl font-black text-white tracking-tight">Admin Login</h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ config.public.companyName }} Event Management
          </p>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Password Admin
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <i class="fa-solid fa-lock text-sm" />
              </span>
              <input
                v-model="password"
                type="password"
                placeholder="Masukkan password admin"
                class="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                @keydown.enter="handleLogin"
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
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
            @click="handleLogin"
          >
            <i class="fa-solid fa-arrow-right-to-bracket" /> Masuk sebagai Admin
          </button>

          <div class="text-center">
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
