import type { AuthRepository } from '~/domain/repositories/auth-repository'

export interface RequestPasswordResetResult {
  success: boolean
  error: string | null
}

export class RequestPasswordReset {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(email: string, redirectTo: string): Promise<RequestPasswordResetResult> {
    if (!email.trim()) {
      return { success: false, error: 'Email wajib diisi.' }
    }

    try {
      await this.authRepository.resetPasswordForEmail(email, redirectTo)
      return { success: true, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim email reset password.'
      return { success: false, error: message }
    }
  }
}
