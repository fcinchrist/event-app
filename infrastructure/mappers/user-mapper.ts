import type { EventUser } from '~/domain/entities/event-user'

/**
 * Representasi baris mentah dari tabel `public.event_users` di Supabase.
 * Nama kolom masih snake_case. Baris lain (event_registrations) yang
 * join ke tabel ini akan punya shape `user: UserRow`.
 */
export interface UserRow {
  id: string
  no_hp: string
  nama: string
  created_at: string
  updated_at: string
}

function isUserRow(value: unknown): value is UserRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.no_hp === 'string' &&
    typeof v.nama === 'string'
  )
}

/**
 * Map baris Supabase → domain EventUser (snake_case → camelCase).
 * Baris null / bukan shape yang valid akan melempar Error.
 */
export function mapUserRow(row: unknown): EventUser {
  if (!isUserRow(row)) {
    throw new Error('Invalid user row shape returned from Supabase.')
  }
  return {
    id: row.id,
    noHp: row.no_hp,
    nama: row.nama,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Sama dengan `mapUserRow` tapi return null untuk input null
 * (berguna untuk query `.maybeSingle()` yang return null kalau
 * row tidak ditemukan).
 */
export function tryMapUserRow(row: unknown): EventUser | null {
  if (row === null || row === undefined) return null
  return mapUserRow(row)
}
