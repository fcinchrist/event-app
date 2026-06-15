import type { EventUser } from '~/domain/entities/event-user'
import type {
  UserListParams,
  UserRepository,
} from '~/domain/repositories/user-repository'
import type { PaginatedResult } from '~/types/pagination'

/**
 * Use case: list user master dengan pagination + search.
 *
 * Mengikuti pola `GetEvents`:
 * - Page di-clamp minimal 1
 * - Limit di-clamp 1..MAX (saat ini 100, sama dengan repo)
 * - Search & pagination di-forward apa adanya ke repository
 */
export class ListUsers {
  constructor(private readonly userRepository: UserRepository) {}

  execute(params: UserListParams): Promise<PaginatedResult<EventUser>> {
    const page = Math.max(1, params.page)
    const limit = Math.min(100, Math.max(1, params.limit))
    return this.userRepository.listUsers({ ...params, page, limit })
  }
}
