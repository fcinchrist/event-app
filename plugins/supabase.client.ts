import { defineNuxtPlugin } from '#imports'
import { useNuxtApp } from '#imports'
import { createBrowserClient, type CookieMethodsBrowser } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

/**
 * Plugin client-side: membuat Supabase client yang membaca/menulis
 * session dari cookies browser sehingga state auth konsisten antara
 * server-rendered HTML (yang membaca cookie) dan client-side hydration.
 *
 * PENTING: instance SupabaseClient TIDAK boleh disimpan di `useState()`
 * karena `useState()` ikut di-serialize ke SSR payload (`__NUXT_DATA__`).
 * `SupabaseClient` adalah class instance non-POJO yang gagal di-stringify
 * oleh `devalue` → "Cannot stringify arbitrary non-POJOs".
 *
 * Solusi: simpan instance di `nuxtApp` lewat `provide('supabase', ...)`.
 * `nuxtApp` tidak ikut ter-serialize, hanya tersedia saat runtime.
 */
export default defineNuxtPlugin({
  name: 'supabase-client',
  enforce: 'pre',
  setup() {
    const nuxtApp = useNuxtApp()
    if (nuxtApp.$supabase) return

    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabaseUrl
    const supabaseAnonKey = config.public.supabaseAnonKey

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[supabase] Supabase URL/Key belum dikonfigurasi.')
      return
    }

    const cookieMethods: CookieMethodsBrowser = {
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
          let cookie = `${name}=${value}`
          if (options?.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`
          if (options?.path) cookie += `; Path=${options.path}`
          if (options?.domain) cookie += `; Domain=${options.domain}`
          if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`
          if (options?.secure) cookie += '; Secure'
          document.cookie = cookie
        }
      },
    }

    const supabase: SupabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: cookieMethods,
    })

    return {
      provide: {
        supabase,
      },
    }
  },
})
