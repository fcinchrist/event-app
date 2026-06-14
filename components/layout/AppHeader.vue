<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
const config = useRuntimeConfig()

onMounted(async () => {
  await store.initAuth()
})

function handleLogoClick(): void {
  navigateTo('/')
}

async function handleLogout(): Promise<void> {
  await store.adminLogout()
  navigateTo('/')
}
</script>

<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
      <div class="flex items-center gap-3 cursor-pointer" @click="handleLogoClick">
        <div class="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-200">
          <i class="fa-solid fa-calendar-check text-xl" />
        </div>
        <div>
          <h1 class="font-extrabold text-lg text-slate-900 tracking-tight">
            {{ config.public.companyName }} Events
          </h1>
          <p class="text-xs text-slate-500 font-medium">Reservasi & Absensi Platform</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Admin Logged In -->
        <div v-if="store.isAdminLoggedIn" class="flex items-center gap-2">
          <span class="bg-slate-900 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <i class="fa-solid fa-shield-halved" /> {{ store.authUser?.email }}
          </span>
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 transition-all border border-slate-200 flex items-center gap-1.5"
            @click="handleLogout"
          >
            <i class="fa-solid fa-arrow-right-from-bracket" /> Logout
          </button>
        </div>

        <!-- Not Logged In -->
        <NuxtLink
          v-else
          to="/admin/login"
          class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 transition-all border border-slate-200 flex items-center gap-1.5"
        >
          <i class="fa-solid fa-lock" /> Admin Login
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
