import type { AuthRepository, AuthUser } from '~/domain/repositories/auth-repository'
import { createLogger } from '~/utils/logger'

const log = createLogger('use-case:login')

export interface LoginResult {
  success: boolean
  user: AuthUser | null
  error: string | null
}

export class LoginUser {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    if (!email.trim() || !password.trim()) {
      return { success: false, user: null, error: 'Email dan password wajib diisi.' }
    }

    try {
      const user = await this.authRepository.login(email, password)
      return { success: true, user, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login gagal. Silakan coba lagi.'
      log.error('Login failed', err, { email })
      return { success: false, user: null, error: message }
    }
  }
}
