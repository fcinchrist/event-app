import type { Event } from '~/domain/entities/event'
import { isEventStatusValue, type EventStatusValue } from '~/types/common'

/**
 * Representasi baris mentah dari tabel `public.events` di Supabase.
 * Field `date` bertipe `timestamptz` (ISO string) dan field integer
 * dikembalikan sebagai number. Nama kolom masih snake_case.
 */
export interface EventRow {
  id: string
  title: string
  description: string
  date: string
  location: string
  quota: number
  image: string
  status: string
  created_at: string
  updated_at: string
}

function isEventRow(value: unknown): value is EventRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.location === 'string' &&
    typeof v.quota === 'number' &&
    typeof v.date === 'string'
  )
}

function normalizeStatus(value: unknown): EventStatusValue {
  if (isEventStatusValue(value)) return value
  return 'Aktif'
}

/**
 * Map baris Supabase → domain Event.
 * Field `date` di domain menggunakan format ISO string (sama dengan DB),
 * sehingga nilai langsung di-forward tanpa transformasi tambahan.
 */
export function mapEventRow(row: unknown): Event {
  if (!isEventRow(row)) {
    throw new Error('Invalid event row shape returned from Supabase.')
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    location: row.location,
    quota: row.quota,
    image: row.image,
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
