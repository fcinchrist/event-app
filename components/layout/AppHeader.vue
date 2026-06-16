<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
const config = useRuntimeConfig()
const route = useRoute()

const isHome = computed(() => route.path === '/')

// Note: `initAuth` is already called in app.vue (root) so it stays in
// sync across SSR + client. There is no need to call it again here.

// The hamburger triggers a global drawer (one hamburger, one drawer for
// every page: public, dashboard, admin). State is owned by the
// `useMobileNav` composable so layouts and DashboardShell stay in sync.
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
  <!--
    ============================================
    AppHeader — Navbar (white background)
    ============================================
    Background stays white. What is tweaked:
    - "Admin Login" / "Dashboard" / "Home" buttons — emerald primary
    - Admin email chip — emerald primary (matches the buttons next to it)
    - "Logout" button — solid red (rose) with a shadow

    Because `initAuth` already runs during SSR (see app.vue), `authUser`
    is populated on the server and hydrated directly into the client —
    no ClientOnly wrapper, no jumping/flash on refresh.
  -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3">
    <div class="max-w-7xl mx-auto flex justify-between items-center gap-3">
      <!--
        Left: hamburger (mobile) + brand.
      -->
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          class="lg:hidden -ml-1 p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-colors shrink-0"
          aria-label="Open navigation menu"
          @click="toggleMobileNav"
        >
          <i class="fa-solid fa-bars text-lg" aria-hidden="true" />
        </button>

        <div class="flex items-center gap-3 cursor-pointer min-w-0" @click="handleLogoClick">
          <div class="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-200 shrink-0" aria-hidden="true">
            <i class="fa-solid fa-calendar-check text-xl" />
          </div>
          <div class="min-w-0">
            <span class="block font-extrabold text-base sm:text-lg text-slate-900 tracking-tight truncate" role="heading" aria-level="2">
              {{ config.public.companyName }} Events
            </span>
            <p class="text-[10px] sm:text-xs text-slate-500 font-medium hidden xs:block">
              Reservasi & Absensi Platform
            </p>
          </div>
        </div>
      </div>

      <!--
        Kanan header (desktop saja):
        - Tombol "Dashboard" / "Admin Login" / "Halaman Utama" — emerald primary
        - Email chip admin — emerald primary (sama dengan tombol di sebelahnya)
        - Tombol "Ubah Password" — slate outline (seimbang dengan email chip)
        - Tombol Logout — full red (rose) dengan shadow

        Dimensi placeholder skeleton (saat SSR pertama sebelum initAuth
        selesai) disamakan dengan tombol aslinya (h-7 = py-1.5 + text-xs)
        supaya tidak ada layout shift saat hydration.
      -->
      <div class="hidden sm:flex items-center gap-2">
        <template v-if="isHome">
          <NuxtLink
            v-if="store.isAdminLoggedIn"
            to="/dashboard"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-100 transition-all flex items-center gap-1.5"
          >
            <i class="fa-solid fa-chart-line" aria-hidden="true" /> Dashboard
          </NuxtLink>
          <NuxtLink
            v-else
            to="/admin/login"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-100 transition-all flex items-center gap-1.5"
          >
            <i class="fa-solid fa-lock" aria-hidden="true" /> Admin Login
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink
            to="/"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-100 transition-all flex items-center gap-1.5"
          >
            <i class="fa-solid fa-house" aria-hidden="true" /> Halaman Utama
          </NuxtLink>
        </template>

        <!-- Logged in: show email chip + change-password + logout -->
        <template v-if="store.isAdminLoggedIn">
          <!-- Email chip: emerald primary (matches the brand buttons) -->
          <span class="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 max-w-[180px] truncate shadow-sm shadow-emerald-100">
            <i class="fa-solid fa-shield-halved" aria-hidden="true" />
            <span class="truncate">{{ store.authUser?.email }}</span>
          </span>
          <!-- Ubah Password: outline slate, balance dengan tombol di sebelahnya -->
          <NuxtLink
            to="/admin/change-password"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-1.5"
            aria-label="Ubah password admin"
          >
            <i class="fa-solid fa-key" aria-hidden="true" /> Ubah Password
          </NuxtLink>
          <!-- Logout: full red (rose) -->
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-100 transition-all flex items-center gap-1.5"
            @click="handleLogout"
          >
            <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /> Logout
          </button>
        </template>
      </div>
    </div>
  </header>
</template>
