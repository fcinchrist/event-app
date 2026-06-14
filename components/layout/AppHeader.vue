<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
const config = useRuntimeConfig()
const route = useRoute()

const isHome = computed(() => route.path === '/')

// Inisialisasi auth saat mount; di server sudah ditangani middleware auth.ts
// (yang sudah men-set authUser dari cookie).
onMounted(async () => {
  if (store.authUser === null) {
    await store.initAuth()
  }
})

// Hamburger memicu drawer global (satu hamburger, satu drawer untuk
// semua halaman: publik maupun dashboard). State dikelola oleh composable
// `useMobileNav` sehingga sinkron antar layout & DashboardShell.
import { useMobileNav } from '~/presentation/composables/useMobileNav'
const mobileNav = useMobileNav()
function toggleMobileNav(): void {
  mobileNav.toggle()
}

function handleLogoClick(): void {
  navigateTo('/')
}

function handleLogout(): Promise<void> {
  return store.adminLogout().then(() => {
    navigateTo('/admin/login')
  })
}

</script>

<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3">
    <div class="max-w-7xl mx-auto flex justify-between items-center gap-3">
      <!--
        Kiri: hamburger (mobile) + brand.
        Hamburger memicu emit `toggleNav` agar parent (layout/page)
        bisa membuka drawer/sidebar mobile. Di desktop, hamburger
        disembunyikan karena navigasi pakai menu horizontal.
      -->
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          class="lg:hidden -ml-1 p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-colors shrink-0"
          aria-label="Buka Menu Navigasi"
          @click="toggleMobileNav"
        >
          <i class="fa-solid fa-bars text-lg" />
        </button>

        <div class="flex items-center gap-3 cursor-pointer min-w-0" @click="handleLogoClick">
          <div class="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-200 shrink-0">
            <i class="fa-solid fa-calendar-check text-xl" />
          </div>
          <div class="min-w-0">
            <h1 class="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight truncate">
              {{ config.public.companyName }} Events
            </h1>
            <p class="text-[10px] sm:text-xs text-slate-500 font-medium hidden xs:block">
              Reservasi & Absensi Platform
            </p>
          </div>
        </div>
      </div>

      <!--
        Kanan header (desktop saja):
        Route-aware nav + email chip + logout.
        Di mobile, semua ini dipindahkan ke drawer yang dipicu hamburger.
      -->
      <ClientOnly>
        <div class="hidden sm:flex items-center gap-2">
          <template v-if="isHome">
            <NuxtLink
              v-if="store.isAdminLoggedIn"
              to="/dashboard"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 transition-all border border-slate-200 flex items-center gap-1.5"
            >
              <i class="fa-solid fa-chart-line" /> Dashboard
            </NuxtLink>
            <NuxtLink
              v-else
              to="/admin/login"
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 transition-all border border-slate-200 flex items-center gap-1.5"
            >
              <i class="fa-solid fa-lock" /> Admin Login
            </NuxtLink>
          </template>
          <template v-else>
            <NuxtLink
              to="/"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 transition-all border border-slate-200 flex items-center gap-1.5"
            >
              <i class="fa-solid fa-house" /> Halaman Utama
            </NuxtLink>
          </template>

          <!-- Logged in: tampilkan email chip + logout -->
          <template v-if="store.isAdminLoggedIn">
            <span class="bg-slate-900 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 max-w-[180px] truncate">
              <i class="fa-solid fa-shield-halved" />
              <span class="truncate">{{ store.authUser?.email }}</span>
            </span>
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 transition-all border border-slate-200 flex items-center gap-1.5"
              @click="handleLogout"
            >
              <i class="fa-solid fa-arrow-right-from-bracket" /> Logout
            </button>
          </template>
        </div>

        <!-- Skeleton sebelum client hydration -->
        <template #fallback>
          <div class="hidden sm:flex items-center gap-2">
            <div class="h-7 w-24 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </template>
      </ClientOnly>
    </div>
  </header>
</template>
