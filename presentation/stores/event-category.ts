import { defineStore } from 'pinia'
import type {
  EventCategory,
  EventCategoryFormData,
} from '~/domain/entities/event-category'
import { SupabaseEventCategoryRepository } from '~/infrastructure/repositories/supabase-event-category-repository'
import { GetEventCategories } from '~/application/use-cases/get-event-categories'
import { CreateEventCategory } from '~/application/use-cases/create-event-category'
import { UpdateEventCategory } from '~/application/use-cases/update-event-category'
import { DeleteEventCategory } from '~/application/use-cases/delete-event-category'

interface EventCategoryState {
  categories: EventCategory[]
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
}

function getRepository(): SupabaseEventCategoryRepository {
  return new SupabaseEventCategoryRepository()
}

export const useEventCategoryStore = defineStore('event-category', {
  state: (): EventCategoryState => ({
    categories: [],
    // `isLoading` defaults to FALSE: the home page / event detail
    // pages need to render even when categories have not been
    // fetched yet (no skeleton for an optional dropdown). The
    // categories page sets it to TRUE explicitly on mount.
    isLoading: false,
    isSubmitting: false,
    error: null,
  }),

  getters: {
    /**
     * Fast lookup map of `id → EventCategory`. Used by EventCard and
     * the event detail page to resolve an `event.categoryId` to its
     * display name without scanning the array on every render.
     */
    byId(state): Record<string, EventCategory> {
      const map: Record<string, EventCategory> = {}
      for (const c of state.categories) {
        map[c.id] = c
      }
      return map
    },
  },

  actions: {
    /**
     * Fetch every category. Never wipes the existing cache on error
     * (same pattern as the registration store): we only seed the
     * initial empty array on the very first load.
     */
    async fetchCategories(): Promise<void> {
      this.isLoading = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetEventCategories(repo)
        const result = await useCase.execute()
        this.categories = result
      } catch (err: unknown) {
        // Don't wipe existing categories on error; just record it.
        this.error = err instanceof Error ? err.message : 'Failed to load categories.'
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Create a new category. On success, insert the new item into
     * the local list while keeping the array sorted by name.
     */
    async createCategory(
      input: EventCategoryFormData,
    ): Promise<{ success: boolean; error: string | null; category: EventCategory | null }> {
      this.isSubmitting = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new CreateEventCategory(repo)
        const category = await useCase.execute(input)
        this.insertSorted(category)
        return { success: true, error: null, category }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create category.'
        this.error = message
        return { success: false, error: message, category: null }
      } finally {
        this.isSubmitting = false
      }
    },

    /**
     * Update an existing category in place.
     */
    async updateCategory(
      id: string,
      input: EventCategoryFormData,
    ): Promise<{ success: boolean; error: string | null; category: EventCategory | null }> {
      this.isSubmitting = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new UpdateEventCategory(repo)
        const category = await useCase.execute(id, input)
        // Remove the old entry, then re-insert sorted so the list
        // stays in name order after an update.
        this.categories = this.categories.filter((c) => c.id !== id)
        this.insertSorted(category)
        return { success: true, error: null, category }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update category.'
        this.error = message
        return { success: false, error: message, category: null }
      } finally {
        this.isSubmitting = false
      }
    },

    /**
     * Delete a category. The use case throws a friendly error when
     * at least one event still references the category; we surface
     * that message verbatim to the admin.
     */
    async deleteCategory(
      id: string,
    ): Promise<{ success: boolean; error: string | null }> {
      this.isSubmitting = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new DeleteEventCategory(repo)
        await useCase.execute(id)
        this.categories = this.categories.filter((c) => c.id !== id)
        return { success: true, error: null }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete category.'
        this.error = message
        return { success: false, error: message }
      } finally {
        this.isSubmitting = false
      }
    },

    /**
     * Keep the local `categories` array sorted by `name` (case
     * insensitive). The repository's `list()` already returns
     * them sorted, so this is purely for the local mutations.
     */
    insertSorted(category: EventCategory): void {
      const next = [...this.categories, category]
      next.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
      this.categories = next
    },
  },
})
