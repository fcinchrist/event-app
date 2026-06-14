import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Type augmentation untuk `nuxtApp.$supabase` yang di-provide oleh
 * `plugins/supabase.client.ts` dan `plugins/supabase.server.ts`.
 *
 * Kita tidak boleh menyimpan SupabaseClient di `useState()` karena
 * devalue (Nuxt SSR payload serializer) tidak bisa men-serialize
 * class instance non-POJO. Sebagai gantinya, instance di-expose
 * lewat `nuxtApp` (provide API) yang TIDAK ikut ter-serialize.
 *
 * File ini membuat TypeScript strict-mode mengenali `useNuxtApp().$supabase`
 * sebagai `SupabaseClient | undefined` (sebelum plugin diinisialisasi).
 */
declare module '#app' {
  interface NuxtApp {
    $supabase: SupabaseClient
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $supabase: SupabaseClient
  }
}

export {}
