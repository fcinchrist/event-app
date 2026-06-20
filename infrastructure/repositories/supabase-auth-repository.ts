import type { AuthRepository, AuthUser } from '~/domain/repositories/auth-repository'
import { useSupabaseClient } from '~/infrastructure/supabase/client'

export class SupabaseAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<AuthUser> {
    const supabase = useSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Login failed: no user returned.')
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
    }
  }

  async logout(): Promise<void> {
    const supabase = useSupabaseClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = useSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    return {
      id: user.id,
      email: user.email ?? '',
    }
  }

  /**
   * resetPasswordForEmail — anti email enumeration (Bug #3).
   *
   * Sebelumnya: method ini melempar error apa adanya dari Supabase Auth
   * ("Email not confirmed", "User not found", "Email rate limit exceeded").
   * Itu memungkinkan attacker untuk membedakan "email terdaftar" vs
   * "tidak terdaftar" dengan membandingkan response.
   *
   * Sekarang: SELALU return success ke caller. Kalau Supabase return error,
   * kita log warning secara internal (untuk monitoring admin) tapi TIDAK
   * melempar ke caller. UI atas (`forgot-password.vue`) tetap menampilkan
   * pesan generik yang sama baik untuk email terdaftar maupun tidak.
   *
   * Caveat: error kode `over_email_send_rate_limit` tetap kita log sebagai
   * warning karena itu sinyal teknis (bukan enumerasi). Untuk itu, use-case
   * layer (`request-password-reset.ts`) menambahkan constant delay supaya
   * timing tidak bocor apakah email valid atau tidak.
   *
   * Error codes yang kita telan (return success):
   *   - email_not_confirmed
   *   - user_not_found  (legacy; beberapa versi Supabase pakai ini)
   *   - validation_failed (email format salah — bukan enumeration vector,
   *     tapi UI sudah validasi sendiri, jadi tetap silent)
   */
  async resetPasswordForEmail(email: string, redirectTo: string): Promise<void> {
    const supabase = useSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      // Log untuk monitoring admin (tidak ditampilkan ke caller).
      // eslint-disable-next-line no-console
      console.warn(
        '[auth] resetPasswordForEmail returned an error (silently swallowed to prevent email enumeration):',
        error.message,
      )
      // Silent: return success regardless. Caller tidak boleh propagate
      // error ini ke UI karena akan membuka enumeration vector.
      return
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const supabase = useSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Change password untuk admin yang SEDANG LOGIN.
   *
   * Alur:
   *   1. Re-authenticate dengan password lama via `signInWithPassword`
   *      untuk membuktikan user memang tahu password lama (Supabase
   *      mengharuskan ini untuk update sensitif dari sisi client).
   *   2. Setelah re-auth berhasil, panggil `updateUser({ password })`
   *      untuk menulis password baru.
   *
   * Catatan keamanan:
   *   - `signInWithPassword` kedua TIDAK men-logout session admin
   *     (Supabase me-reuse session yang ada kalau email/password cocok).
   *   - Kalau password lama salah, kita propagate error Supabase
   *     apa adanya (biasanya "Invalid login credentials") — caller
   *     bisa memetakan ke pesan Indonesia yang lebih ramah.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const supabase = useSupabaseClient()

    // Ambil email user aktif — kalau null, kita tidak bisa re-auth,
    // jadi langsung gagal.
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) {
      throw new Error(userErr.message)
    }
    const email = userData.user?.email
    if (!email) {
      throw new Error(
        'Sesi admin tidak valid. Silakan login ulang untuk mengganti password.',
      )
    }

    // 1) Verifikasi password lama dengan sign-in ulang.
    //    Supabase akan me-reuse session aktif kalau email/password cocok,
    //    jadi admin tidak akan ter-logout paksa.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInErr) {
      // Map error paling umum ke pesan yang lebih jelas.
      const msg = signInErr.message.toLowerCase()
      if (msg.includes('invalid login credentials')) {
        throw new Error('Password lama salah.')
      }
      throw new Error(signInErr.message)
    }

    // 2) Tulis password baru.
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (updateErr) {
      throw new Error(updateErr.message)
    }
  }
}
