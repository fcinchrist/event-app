import { createServerClient, parseCookieHeader, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig, useRequestEvent } from '#imports'

/**
 * Server-side Supabase client factory.
 *
 * Menggunakan @supabase/ssr agar session cookie terbaca di sisi server
 * (Supabase JS standar tidak membaca cookie di SSR → session selalu null
 * saat middleware/dashboard dirender server-side).
 */
export function createServerSupabase(): SupabaseClient {
  const config = useRuntimeConfig()
  const event = useRequestEvent()
  if (!event) {
    throw new Error('useRequestEvent() tidak tersedia di luar konteks request server.')
  }
  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Konfigurasi Supabase belum di-set di runtimeConfig.public.')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const header = event.node.req.headers.cookie ?? ''
        return parseCookieHeader(header).map((c) => ({ name: c.name, value: c.value ?? '' }))
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
}

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
