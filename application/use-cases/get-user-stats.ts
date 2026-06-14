import type { UserStats } from '~/domain/repositories/user-repository'
import type { UserRepository } from '~/domain/repositories/user-repository'

export class GetUserStats {
  constructor(private readonly userRepository: UserRepository) {}

  execute(userId: string): Promise<UserStats> {
    if (!userId) {
      throw new Error('User ID tidak valid.')
    }
    return this.userRepository.getStats(userId)
  }
}
