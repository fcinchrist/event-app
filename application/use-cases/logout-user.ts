import type { AuthRepository } from '~/domain/repositories/auth-repository'

export class LogoutUser {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(): Promise<void> {
    await this.authRepository.logout()
  }
}
