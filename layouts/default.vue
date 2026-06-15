<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useMobileNav } from '~/presentation/composables/useMobileNav'
import type { NavItem } from '~/types/navigation'

const store = useAppStore()
const route = useRoute()

// Single hamburger + single drawer for every page (public and dashboard).
// State is shared via the `useMobileNav` singleton composable.
const mobileNav = useMobileNav()

const isHome = computed(() => route.path === '/')
const isDashboard = computed(() => route.path.startsWith('/dashboard'))
const isLoggedIn = computed(() => store.isAdminLoggedIn)

// Mirrors the active-state logic used by DashboardShell so the drawer
// and the desktop sidebar always highlight the same item.
function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  if (to === '/dashboard') {
    return route.path === '/dashboard' || route.path === '/dashboard/'
  }
  return route.path === to || route.path.startsWith(`${to}/`)
}

// Public-facing menu (hidden while already on the home page).
const PUBLIC_ITEMS: NavItem[] = [
  { key: 'home', label: 'Halaman Utama', icon: 'fa-solid fa-house', to: '/' },
]

// Dashboard sub-menu, kept in sync with the desktop sidebar.
const DASHBOARD_ITEMS: NavItem[] = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage',    label: 'Kelola Event',        icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'users',     label: 'Master User',         icon: 'fa-solid fa-users',      to: '/dashboard/users' },
]

function goTo(target: string): void {
  mobileNav.close()
  navigateTo(target)
}

async function handleLogout(): Promise<void> {
  mobileNav.close()
  await store.adminLogout()
  navigateTo('/admin/login')
}

// Auto-close the drawer whenever the route changes.
const routeKey = computed(() => route.fullPath)
watch(routeKey, () => {
  mobileNav.close()
})

onMounted(async () => {
  if (store.events.length === 0) {
    await store.fetchEvents()
  }
  if (store.authUser === null) {
    await store.initAuth()
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <LayoutAppHeader />

    <main class="flex-1 w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <slot />
      </div>
    </main>

    <LayoutAppFooter />

    <!--
      Global mobile drawer (one for every page).
      Triggered by the hamburger in AppHeader via `useMobileNav()`.
      Contents: public menu + (when on /dashboard) dashboard sub-menu + auth.
      Auto-closes on backdrop tap, item click, or route change.
      Hidden on `lg:` and up — the desktop sidebar handles that breakpoint.
      Active style mirrors the desktop sidebar: emerald-600 background + white text.
    -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="mobileNav.isOpen.value"
          class="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60]"
          aria-hidden="true"
          @click="mobileNav.close()"
        />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        enter-from-class="-translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-200 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="-translate-x-full"
      >
        <aside
          v-if="mobileNav.isOpen.value"
          class="lg:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-slate-200 z-[70] flex flex-col shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Navigasi"
        >
          <!-- Drawer header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div class="flex items-center gap-2">
              <div class="bg-emerald-600 text-white p-1.5 rounded-lg shrink-0">
                <i class="fa-solid fa-bars text-sm" />
              </div>
              <span class="font-extrabold text-sm text-slate-900 tracking-tight">
                Menu Navigasi
              </span>
            </div>
            <button
              type="button"
              class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors"
              aria-label="Tutup Menu"
              @click="mobileNav.close()"
            >
              <i class="fa-solid fa-xmark text-lg" />
            </button>
          </div>

          <nav class="flex-grow p-3 overflow-y-auto">
            <!-- ============ Group: Halaman Publik ============ -->
            <!-- Hidden when already on the home page (no point showing a button that goes to where you already are). -->
            <div v-if="!isHome" class="space-y-1">
              <div class="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Halaman
              </div>
              <button
                v-for="item in PUBLIC_ITEMS"
                :key="item.key"
                type="button"
                class="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left"
                :class="isActive(item.to)
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'"
                @click="goTo(item.to)"
              >
                <i :class="item.icon" class="w-4 text-center" />
                {{ item.label }}
              </button>
            </div>

            <!-- ============ Group: Panel Operasional ============ -->
            <!-- Always visible for logged-in admins so the drawer is a true global navigator. -->
            <ClientOnly>
              <div v-if="isLoggedIn" class="mt-2 space-y-1">
                <div class="px-3 pt-2 pb-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  Panel Operasional
                </div>
                <NuxtLink
                  v-for="item in DASHBOARD_ITEMS"
                  :key="item.key"
                  :to="item.to"
                  class="block px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5"
                  :class="isActive(item.to)
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'"
                  @click="mobileNav.close()"
                >
                  <i :class="item.icon" class="w-4 text-center" />
                  {{ item.label }}
                </NuxtLink>
              </div>
            </ClientOnly>

            <!-- ============ Group: Akun ============ -->
            <div class="mt-2 pt-3 border-t border-slate-100 space-y-1">
              <ClientOnly>
                <template v-if="isLoggedIn">
                  <div class="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Akun Admin
                  </div>
                  <div class="flex items-center gap-2 min-w-0 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-100">
                    <i class="fa-solid fa-shield-halved shrink-0" />
                    <span class="truncate min-w-0 flex-1">{{ store.authUser?.email }}</span>
                  </div>
                  <button
                    type="button"
                    class="w-full mt-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left text-rose-600 hover:bg-rose-50"
                    @click="handleLogout"
                  >
                    <i class="fa-solid fa-arrow-right-from-bracket w-4 text-center" />
                    Logout
                  </button>
                </template>
                <template v-else>
                  <div class="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Akun
                  </div>
                  <button
                    type="button"
                    class="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    @click="goTo('/admin/login')"
                  >
                    <i class="fa-solid fa-lock w-4 text-center" />
                    Login Admin
                  </button>
                </template>
              </ClientOnly>
            </div>
          </nav>

          <div class="border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
            Event Management &middot; v1.0
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>
