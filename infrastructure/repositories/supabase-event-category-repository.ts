import type {
  EventCategory,
  EventCategoryFormData,
} from '~/domain/entities/event-category'
import type { EventCategoryRepository } from '~/domain/repositories/event-category-repository'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import { mapEventCategoryRow } from '~/infrastructure/mappers/event-category-mapper'
import { generateUniqueId } from '~/application/use-cases/generate-id'

/**
 * Supabase-backed implementation of `EventCategoryRepository`.
 *
 * - `id` is generated via `generateUniqueId('CAT', …)` so the format
 *   (`CAT-YYYY-NNNNN`) stays consistent with `USR-` and `REG-`.
 * - Delete is RESTRICT-ed by the FK on `events.category_id`. The
 *   23503 (foreign_key_violation) error is translated into a
 *   human-readable message so the UI can show it verbatim.
 */
export class SupabaseEventCategoryRepository implements EventCategoryRepository {
  async list(): Promise<EventCategory[]> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    const rows: unknown[] = Array.isArray(data) ? data : []
    return rows.map((row) => mapEventCategoryRow(row))
  }

  async getById(id: string): Promise<EventCategory | null> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return data ? mapEventCategoryRow(data) : null
  }

  async create(input: EventCategoryFormData): Promise<EventCategory> {
    const supabase = useSupabaseClient()

    // Generate a `CAT-YYYY-NNNNN` id; retry until unique.
    const id = await generateUniqueId('CAT', async (candidate: string) => {
      const { data } = await supabase
        .from('event_categories')
        .select('id')
        .eq('id', candidate)
        .maybeSingle()
      return data !== null
    })

    const { data, error } = await supabase
      .from('event_categories')
      .insert({
        id,
        name: input.name.trim(),
        detail: (input.detail ?? '').trim(),
      })
      .select('*')
      .single()

    if (error) {
      // 23505 = unique_violation (duplicate name)
      if (error.code === '23505') {
        throw new Error('A category with that name already exists.')
      }
      throw new Error(error.message)
    }

    return mapEventCategoryRow(data)
  }

  async update(id: string, input: EventCategoryFormData): Promise<EventCategory> {
    const supabase = useSupabaseClient()

    const { data, error } = await supabase
      .from('event_categories')
      .update({
        name: input.name.trim(),
        detail: (input.detail ?? '').trim(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('A category with that name already exists.')
      }
      throw new Error(error.message)
    }

    return mapEventCategoryRow(data)
  }

  async delete(id: string): Promise<void> {
    const supabase = useSupabaseClient()

    const { error } = await supabase
      .from('event_categories')
      .delete()
      .eq('id', id)

    if (error) {
      // 23503 = foreign_key_violation. The FK on `events.category_id`
      // uses ON DELETE RESTRICT, so this fires whenever at least one
      // event still references the category.
      if (error.code === '23503') {
        throw new Error(
          'Category is in use by one or more events. Reassign or delete those events first.',
        )
      }
      throw new Error(error.message)
    }
  }
}
