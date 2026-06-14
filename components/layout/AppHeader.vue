<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
const config = useRuntimeConfig()
</script>

<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
      <div class="flex items-center gap-3 cursor-pointer" @click="store.navigateTo('list')">
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

      <div class="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          :class="store.role === 'member' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 font-medium'"
          class="px-4 py-1.5 rounded-lg text-xs transition-all duration-200 flex items-center gap-1.5"
          @click="store.setRole('member')"
        >
          <i class="fa-solid fa-users" /> Event
        </button>
        <button
          :class="store.role === 'admin' ? 'bg-slate-900 text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 font-medium'"
          class="px-4 py-1.5 rounded-lg text-xs transition-all duration-200 flex items-center gap-1.5"
          @click="store.setRole('admin')"
        >
          <i class="fa-solid fa-lock" /> Admin
        </button>
      </div>
    </div>
  </header>
</template>
