import type { EventCategory } from '~/domain/entities/event-category'
import type { EventCategoryRepository } from '~/domain/repositories/event-category-repository'

/**
 * Use case: list every master category, ordered by name.
 * No pagination — the admin is expected to keep the total small.
 */
export class GetEventCategories {
  constructor(private readonly repository: EventCategoryRepository) {}

  execute(): Promise<EventCategory[]> {
    return this.repository.list()
  }
}
