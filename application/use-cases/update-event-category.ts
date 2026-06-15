import type {
  EventCategory,
  EventCategoryFormData,
} from '~/domain/entities/event-category'
import type { EventCategoryRepository } from '~/domain/repositories/event-category-repository'

/**
 * Use case: update an existing master category.
 *
 * Validates id + name (min 2 chars), trims the detail, then delegates
 * to the repository. Throws when the name is taken by another row.
 */
export class UpdateEventCategory {
  constructor(private readonly repository: EventCategoryRepository) {}

  async execute(id: string, input: EventCategoryFormData): Promise<EventCategory> {
    if (!id) {
      throw new Error('Category id is required.')
    }
    const name = (input.name ?? '').trim()
    if (name.length < 2) {
      throw new Error('Category name is required (min. 2 characters).')
    }
    return this.repository.update(id, {
      name,
      detail: (input.detail ?? '').trim(),
    })
  }
}
