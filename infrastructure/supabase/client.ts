import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, type CookieMethodsBrowser } from '@supabase/ssr'
import { useNuxtApp, useRuntimeConfig } from '#imports'

/**
 * Composable untuk mendapatkan Supabase client yang konsisten antara
 * server-rendering dan client-side.
 *
 * Plugin `plugins/supabase.server.ts` dan `plugins/supabase.client.ts`
 * masing-masing meng-instantiate SupabaseClient dengan pembacaan session
 * dari cookies dan mengeksposnya lewat `nuxtApp.$supabase` (provide API).
 *
 * Kita TIDAK menyimpan instance di `useState()` karena SupabaseClient
 * adalah class instance non-POJO dan akan gagal di-serialize oleh
 * `devalue` (Nuxt SSR payload serializer) → "Cannot stringify arbitrary
 * non-POJOs". `nuxtApp` sendiri tidak ikut ter-serialize ke payload.
 */
export function useSupabaseClient(): SupabaseClient {
  const nuxtApp = useNuxtApp()
  if (nuxtApp.$supabase) {
    return nuxtApp.$supabase
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration. Set NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.',
    )
  }

  // Fallback lazy-init (hanya di client). Di server, plugin server wajib
  // sudah berjalan dan meng-inject instance ke nuxtApp.$supabase.
  if (import.meta.client) {
    const cookies: CookieMethodsBrowser = {
      getAll() {
        if (typeof document === 'undefined') return []
        return document.cookie
          .split('; ')
          .filter((c) => c.length > 0)
          .map((pair) => {
            const [name, ...rest] = pair.split('=')
            return { name, value: rest.join('=') }
          })
      },
      setAll(cookiesToSet) {
        if (typeof document === 'undefined') return
        for (const { name, value, options } of cookiesToSet) {
          let c = `${name}=${value}`
          if (options?.maxAge !== undefined) c += `; Max-Age=${options.maxAge}`
          if (options?.path) c += `; Path=${options.path}`
          if (options?.domain) c += `; Domain=${options.domain}`
          if (options?.sameSite) c += `; SameSite=${options.sameSite}`
          if (options?.secure) c += '; Secure'
          document.cookie = c
        }
      },
    }
    const instance = createBrowserClient(supabaseUrl, supabaseAnonKey, { cookies })
    nuxtApp.provide('supabase', instance)
    return instance
  }

  throw new Error(
    'Supabase client belum ter-inisialisasi di server. Pastikan plugin supabase.server.ts terdaftar.',
  )
}
