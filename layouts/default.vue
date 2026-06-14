<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useMobileNav } from '~/presentation/composables/useMobileNav'

const store = useAppStore()
const route = useRoute()

// Drawer mobile global (satu hamburger, satu drawer, satu state singleton).
// Komposabel `useMobileNav` mengembalikan ref yang sama untuk semua komponen
// yang mengimpornya. Header memicu toggle, layout ini yang merender drawer.
const mobileNav = useMobileNav()
const isHome = computed(() => route.path === '/')
const isDashboard = computed(() => route.path.startsWith('/dashboard'))

function goTo(target: string): void {
  mobileNav.close()
  navigateTo(target)
}
async function handleLogout(): Promise<void> {
  mobileNav.close()
  await store.adminLogout()
  navigateTo('/admin/login')
}

// Tutup drawer otomatis saat route berubah
const routeKey = computed(() => route.fullPath)
watch(routeKey, () => {
  mobileNav.close()
})

onMounted(async () => {
  // Ambil data event publik dari Supabase (bukan dari hardcode/localStorage)
  if (store.events.length === 0) {
    await store.fetchEvents()
  }
  // Hydrate auth state di client (server sudah ditangani middleware)
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
      ============================================
      Drawer navigasi mobile (SATU untuk semua halaman).
      Dipicu oleh hamburger di AppHeader (lewat useMobileNav()).
      Kontennya gabungan: navigasi publik + (jika ada) sub-menu dashboard.
      Auto-close saat: backdrop di-tap, item dipilih, route berubah,
      tombol close ditekan.
      Di desktop (`lg:` ke atas) drawer ini tidak pernah muncul.
      Warna aktif: emerald-600 (standar brand, sama dengan desktop sidebar).
      ============================================
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

          <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto">
            <!-- ============ Halaman Publik ============ -->
            <div class="flex items-center gap-2 px-4 pt-1 pb-1.5">
              <span class="w-1.5 h-3.5 rounded-full bg-emerald-500" />
              <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                Halaman
              </div>
            </div>
            <button
              v-if="!isHome"
              class="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left hover:bg-emerald-50 text-slate-600 hover:text-emerald-700"
              @click="goTo('/')"
            >
              <i class="fa-solid fa-house w-4 text-center" />
              Halaman Utama
            </button>

            <!-- ============ Sub-menu Dashboard (hanya di /dashboard*) ============ -->
            <template v-if="isDashboard">
              <div class="flex items-center gap-2 px-4 pt-3 pb-1.5">
                <span class="w-1.5 h-3.5 rounded-full bg-emerald-500" />
                <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  Panel Operasional
                </div>
              </div>
              <NuxtLink
                to="/dashboard"
                class="block px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5"
                :class="route.path === '/dashboard' || route.path === '/dashboard/'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                  : 'hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'"
                @click="mobileNav.close()"
              >
                <i class="fa-solid fa-chart-line w-4 text-center" />
                Ringkasan Dashboard
              </NuxtLink>
              <NuxtLink
                to="/dashboard/events"
                class="block px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5"
                :class="route.path.startsWith('/dashboard/events')
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                  : 'hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'"
                @click="mobileNav.close()"
              >
                <i class="fa-solid fa-list-check w-4 text-center" />
                Kelola Event
              </NuxtLink>
            </template>

            <!-- ============ Auth ============ -->
            <ClientOnly>
              <template v-if="store.isAdminLoggedIn">
                <NuxtLink to="/dashboard" class="flex items-center gap-2 px-4 pt-3 pb-1.5">
                  <span class="w-1.5 h-3.5 rounded-full bg-emerald-500" />
                  <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                    Akun Admin
                  </div>
                </NuxtLink>
                <div class="px-4 py-2 bg-slate-900 text-emerald-400 rounded-xl text-xs font-bold truncate flex items-center gap-2">
                  <i class="fa-solid fa-circle-user" />
                  <span class="truncate">{{ store.authUser?.email }}</span>
                </div>
                <button
                  class="w-full mt-1.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left text-rose-600 hover:bg-rose-50"
                  @click="handleLogout"
                >
                  <i class="fa-solid fa-arrow-right-from-bracket w-4 text-center" />
                  Logout
                </button>
              </template>
              <template v-else>
                <div class="flex items-center gap-2 px-4 pt-3 pb-1.5">
                  <span class="w-1.5 h-3.5 rounded-full bg-emerald-500" />
                  <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                    Akun
                  </div>
                </div>
                <button
                  class="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-left hover:bg-emerald-50 text-slate-600 hover:text-emerald-700"
                  @click="goTo('/admin/login')"
                >
                  <i class="fa-solid fa-lock w-4 text-center" />
                  Login Admin
                </button>
              </template>
            </ClientOnly>
          </nav>

          <div class="border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
            Event Management &middot; v1.0
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>
