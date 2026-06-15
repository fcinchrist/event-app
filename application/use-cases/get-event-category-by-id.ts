import type { EventCategory } from '~/domain/entities/event-category'
import type { EventCategoryRepository } from '~/domain/repositories/event-category-repository'

/**
 * Use case: fetch a single category by id. Returns `null` when the
 * category does not exist (the caller is expected to handle the
 * null case — typically used by the detail page when resolving
 * an event's `categoryId`).
 */
export class GetEventCategoryById {
  constructor(private readonly repository: EventCategoryRepository) {}

  execute(id: string): Promise<EventCategory | null> {
    return this.repository.getById(id)
  }
}
