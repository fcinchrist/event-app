import { useAppStore } from '~/presentation/stores/app'

/**
 * Middleware untuk route yang hanya boleh diakses admin
 * yang sudah login via Supabase Auth.
 *
 * Daftar route yang dilindungi didaftarkan di `app.ts`
 * (atau per-halaman via `definePageMeta`).
 *
 * Aturan:
 * - Jika belum login → redirect ke /admin/login
 * - Jika sudah login → boleh lanjut
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const store = useAppStore()

  // Pastikan state auth user sudah ter-hydrate
  if (store.authUser === null) {
    await store.initAuth()
  }

  if (!store.isAdminLoggedIn) {
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath },
    })
  }
})
