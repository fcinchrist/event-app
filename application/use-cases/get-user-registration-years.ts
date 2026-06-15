import type { UserRepository } from '~/domain/repositories/user-repository'

export class GetUserRegistrationYears {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Daftar tahun unik dari `event.date` yang pernah diikuti user,
   * diurutkan descending (tahun terbaru dulu). Dipakai untuk
   * filter year-pills di halaman detail user.
   */
  async execute(userId: string): Promise<number[]> {
    if (!userId) {
      throw new Error('ID user tidak valid.')
    }
    return this.userRepository.getRegistrationYears(userId)
  }
}
