import type { EventUser, MemberType, UserStatus } from '~/domain/entities/event-user'

/**
 * Representasi baris mentah dari tabel `public.event_users` di Supabase.
 * Nama kolom masih snake_case. Baris lain (event_registrations) yang
 * join ke tabel ini akan punya shape `user: UserRow`.
 *
 * `user_status` & `member_type` ditambahkan oleh migration 004.
 * Pada baris lama (atau row yang ditulis sebelum kolom ini ada)
 * nilainya bisa null, sehingga mapper memberi default 'active' / 'internal'.
 */
export interface UserRow {
  id: string
  no_hp: string
  nama: string
  user_status?: string | null
  member_type?: string | null
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
 * Narrow nilai mentah string|null|undefined dari kolom enum Supabase
 * menjadi `UserStatus`. Fallback ke 'active' untuk data lama / null.
 */
function normalizeUserStatus(value: unknown): UserStatus {
  if (value === 'inactive' || value === 'banned') return value
  return 'active'
}

function normalizeMemberType(value: unknown): MemberType {
  if (value === 'external') return 'external'
  return 'internal'
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
    userStatus: normalizeUserStatus(row.user_status),
    memberType: normalizeMemberType(row.member_type),
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
