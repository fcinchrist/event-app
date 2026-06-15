import type {
  EventCategory,
  EventCategoryFormData,
} from '~/domain/entities/event-category'
import type { EventCategoryRepository } from '~/domain/repositories/event-category-repository'

/**
 * Use case: create a new master category.
 *
 * Validates:
 * - `name` is required and at least 2 characters (after trim).
 * - `detail` is optional; trimmed before persistence.
 *
 * Throws (in English) when validation fails or when the database
 * reports a duplicate name.
 */
export class CreateEventCategory {
  constructor(private readonly repository: EventCategoryRepository) {}

  async execute(input: EventCategoryFormData): Promise<EventCategory> {
    const name = (input.name ?? '').trim()
    if (name.length < 2) {
      throw new Error('Category name is required (min. 2 characters).')
    }
    return this.repository.create({
      name,
      detail: (input.detail ?? '').trim(),
    })
  }
}
