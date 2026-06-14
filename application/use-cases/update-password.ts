import type { AuthRepository } from '~/domain/repositories/auth-repository'

export interface UpdatePasswordResult {
  success: boolean
  error: string | null
}

export class UpdatePassword {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(newPassword: string, confirmPassword: string): Promise<UpdatePasswordResult> {
    if (!newPassword.trim()) {
      return { success: false, error: 'Password baru wajib diisi.' }
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Password minimal 6 karakter.' }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'Konfirmasi password tidak cocok.' }
    }

    try {
      await this.authRepository.updatePassword(newPassword)
      return { success: true, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui password.'
      return { success: false, error: message }
    }
  }
}
