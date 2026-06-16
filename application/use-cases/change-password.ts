import type { AuthRepository } from '~/domain/repositories/auth-repository'
import { createLogger } from '~/utils/logger'

const log = createLogger('use-case:change-password')

export interface ChangePasswordResult {
  success: boolean
  error: string | null
}

/**
 * Use case untuk admin yang SEDANG LOGIN ingin mengganti password
 * dari halaman profil/settings.
 *
 * Validasi yang dilakukan di sini (lagi, di luar auth repo):
 *   - Semua field wajib diisi
 *   - Password baru minimal 6 karakter
 *   - Password baru != password lama (mencegah no-op)
 *
 * Untuk verifikasi password lama, [`AuthRepository.changePassword`](../../../infrastructure/repositories/supabase-auth-repository.ts)
 * sudah melakukan re-auth via Supabase. Kalau password lama salah,
 * repository melemparkan error yang akan kita petakan ke result.
 */
export class ChangePassword {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<ChangePasswordResult> {
    if (!currentPassword.trim()) {
      return { success: false, error: 'Password lama wajib diisi.' }
    }
    if (!newPassword.trim()) {
      return { success: false, error: 'Password baru wajib diisi.' }
    }
    if (newPassword.length < 6) {
      return { success: false, error: 'Password baru minimal 6 karakter.' }
    }
    if (newPassword !== confirmPassword) {
      return { success: false, error: 'Konfirmasi password baru tidak cocok.' }
    }
    if (currentPassword === newPassword) {
      return {
        success: false,
        error: 'Password baru harus berbeda dengan password lama.',
      }
    }

    try {
      await this.authRepository.changePassword(currentPassword, newPassword)
      return { success: true, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui password.'
      log.error('Change password failed', err)
      return { success: false, error: message }
    }
  }
}
