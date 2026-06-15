import type { EventCategoryRepository } from '~/domain/repositories/event-category-repository'

/**
 * Use case: delete a master category.
 *
 * The database FK (`events.category_id` → `event_categories.id` with
 * `ON DELETE RESTRICT`) blocks this operation whenever at least one
 * event still references the category. The repository translates the
 * 23503 (foreign_key_violation) error into a friendly English
 * message, so the UI can show it verbatim.
 */
export class DeleteEventCategory {
  constructor(private readonly repository: EventCategoryRepository) {}

  async execute(id: string): Promise<void> {
    if (!id) {
      throw new Error('Category id is required.')
    }
    await this.repository.delete(id)
  }
}
