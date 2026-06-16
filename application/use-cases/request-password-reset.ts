import type { AuthRepository } from '~/domain/repositories/auth-repository'
import { createLogger } from '~/utils/logger'

const log = createLogger('use-case:request-password-reset')

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
      log.error('Password reset request failed', err, { email, redirectTo })
      return { success: false, error: message }
    }
  }
}
