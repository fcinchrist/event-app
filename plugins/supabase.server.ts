import { defineNuxtPlugin, useNuxtApp } from '#imports'
import { createServerClient, parseCookieHeader, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig, useRequestEvent } from '#imports'

/**
 * Plugin server-side: membuat Supabase client dengan pembacaan session
 * dari cookie request. Hasilnya di-expose via `nuxtApp.$supabase` (provide)
 * sehingga middleware & halaman yang dirender server bisa mendapatkan
 * user yang sama persis dengan client.
 *
 * PENTING: instance tidak disimpan di `useState()` (lihat plugins/supabase.client.ts
 * untuk alasan lengkap) — supaya tidak ikut ter-serialize ke SSR payload.
 */
export default defineNuxtPlugin({
  name: 'supabase-server',
  enforce: 'pre',
  setup() {
    const nuxtApp = useNuxtApp()
    if (nuxtApp.$supabase) return

    const config = useRuntimeConfig()
    const event = useRequestEvent()
    if (!event) return

    const supabaseUrl = config.public.supabaseUrl
    const supabaseAnonKey = config.public.supabaseAnonKey
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[supabase] Supabase URL/Key belum dikonfigurasi.')
      return
    }

    const supabase: SupabaseClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          const header = event.node.req.headers.cookie ?? ''
          return parseCookieHeader(header).map((c) => ({
            name: c.name,
            value: c.value ?? '',
          }))
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            event.node.res.appendHeader(
              'set-cookie',
              serializeCookie(name, value, options ?? {}),
            )
          }
        },
      },
    })

    return {
      provide: {
        supabase,
      },
    }
  },
})

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const segments = [`${name}=${value}`]
  if (options.path) segments.push(`Path=${options.path}`)
  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`)
  if (options.domain) segments.push(`Domain=${options.domain}`)
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`)
  if (options.secure) segments.push('Secure')
  if (options.httpOnly) segments.push('HttpOnly')
  return segments.join('; ')
}
