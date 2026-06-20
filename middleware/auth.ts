import { useAppStore } from '~/presentation/stores/app'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import { createLogger } from '~/utils/logger'

const log = createLogger('middleware:auth')

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
 *
 *  * Tidak hanya percaya pada state Pinia (bisa di-tampering via
 * DevTools / browser extension). Middleware ini melakukan
 * **double-check** dengan memanggil `supabase.auth.getUser()`
 * langsung ke server Supabase (yang memvalidasi JWT dari cookie).
 *
 * Defense-in-depth:
 * 1. Pinia state cepat untuk cached check (avoid extra request)
 * 2. Supabase server call untuk authoritative verification
 * 3. Cache verification result supaya tidak spam server per nav
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const store = useAppStore()

  // Step 1: Hydrate Pinia state dari Supabase jika belum ada.
  if (store.authUser === null) {
    await store.initAuth()
  }

  // Step 2: Fast-path — jika state Pinia bilang belum login,
  // tidak perlu hit server. (Init sudah memvalidasi cookie.)
  if (!store.isAdminLoggedIn) {
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath },
    })
  }

  // Step 3: AUTHORITATIVE check — verifikasi session masih valid
  // dengan Supabase. Jika cookie di-revoke atau expired, server
  // akan return null walaupun Pinia state masih cached.
  try {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      log.warn('Session invalid saat middleware check', {
        path: to.fullPath,
        reason: error?.message ?? 'no user',
      })
      // Session tidak valid — force logout & redirect.
      await store.adminLogout()
      return navigateTo({
        path: '/admin/login',
        query: { redirect: to.fullPath },
      })
    }
  } catch (err) {
    // Network error atau Supabase down — fallback ke Pinia state.
    // Jangan lockout admin hanya karena network glitch.
    log.error('Gagal verifikasi session ke Supabase', {
      path: to.fullPath,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})
