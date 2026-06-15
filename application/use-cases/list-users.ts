import type { EventUser } from '~/domain/entities/event-user'
import type {
  UserListParams,
  UserRepository,
} from '~/domain/repositories/user-repository'
import type { PaginatedResult } from '~/types/pagination'

/**
 * Use case: list master users with pagination + search.
 * - Clamps `page` to a minimum of 1.
 * - Clamps `limit` to 1..100 (matches the repository cap).
 */
export class ListUsers {
  constructor(private readonly userRepository: UserRepository) {}

  execute(params: UserListParams): Promise<PaginatedResult<EventUser>> {
    const page = Math.max(1, params.page)
    const limit = Math.min(100, Math.max(1, params.limit))
    return this.userRepository.listUsers({ ...params, page, limit })
  }
}
