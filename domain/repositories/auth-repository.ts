export interface AuthUser {
  id: string
  email: string
}

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  getCurrentUser(): Promise<AuthUser | null>
  resetPasswordForEmail(email: string, redirectTo: string): Promise<void>
  /**
   * Update password user yang SEDANG LOGIN.
   *
   * Dipakai oleh alur "lupa password" → klik link di email → set
   * password baru (Supabase sudah menyediakan session recovery).
   * Tidak melakukan verifikasi password lama.
   */
  updatePassword(newPassword: string): Promise<void>
  /**
   * Ganti password admin yang SEDANG LOGIN.
   *
   * Wajib memasukkan `currentPassword` untuk membuktikan user
   * memang tahu password lama sebelum diizinkan menulis yang
   * baru. Implementasi: re-auth via `signInWithPassword` lalu
   * panggil `updateUser({ password })`.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>
}
