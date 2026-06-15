import type { EventCategory } from '~/domain/entities/event-category'

/**
 * Raw row shape returned by Supabase for `public.event_categories`.
 * Field names are snake_case, matching the DB columns.
 */
export interface EventCategoryRow {
  id: string
  name: string
  detail: string
  created_at: string
  updated_at: string
}

function isEventCategoryRow(value: unknown): value is EventCategoryRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string'
    && typeof v.name === 'string'
    && typeof v.detail === 'string'
    && typeof v.created_at === 'string'
    && typeof v.updated_at === 'string'
  )
}

/**
 * Map a Supabase row → the domain `EventCategory`. Throws when the
 * row is missing required fields (the caller should treat this as a
 * bug in the query, not a recoverable runtime error).
 */
export function mapEventCategoryRow(row: unknown): EventCategory {
  if (!isEventCategoryRow(row)) {
    throw new Error('Invalid event_category row shape returned from Supabase.')
  }
  return {
    id: row.id,
    name: row.name,
    detail: row.detail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Same as `mapEventCategoryRow` but returns `null` for invalid rows
 * instead of throwing. Useful in optional contexts like list filters.
 */
export function tryMapEventCategoryRow(row: unknown): EventCategory | null {
  return isEventCategoryRow(row) ? mapEventCategoryRow(row) : null
}
