import {
  isRegistrationStatusValue,
  REGISTRATION_STATUS_VALUES,
} from '~/types/registration-status'
import type {
  Registration,
  RegistrationWithEvent,
  RegistrationWithUser,
} from '~/domain/entities/registration'
import { mapUserRow, type UserRow } from '~/infrastructure/mappers/user-mapper'
import { mapEventRow, type EventRow } from '~/infrastructure/mappers/event-mapper'
import type { RegistrationStatus } from '~/domain/entities/registration'

/**
 * Representasi baris mentah dari tabel `public.event_registrations`.
 * Bisa punya field nested `user: UserRow` (JOIN `event_users`) dan/atau
 * `event: EventRow` (JOIN `events`).
 */
export interface RegistrationRow {
  id: string
  user_id: string
  event_id: string
  status: string
  checkin_at: string | null
  registered_at: string
  user?: UserRow | null
  event?: EventRow | null
}

function isRegistrationRow(value: unknown): value is RegistrationRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.user_id === 'string' &&
    typeof v.event_id === 'string' &&
    typeof v.status === 'string'
  )
}

function normalizeStatus(value: unknown): RegistrationStatus {
  if (isRegistrationStatusValue(value)) {
    return value
  }
  return REGISTRATION_STATUS_VALUES[0]
}

/**
 * Map baris Supabase → domain Registration (snake_case → camelCase).
 * Baris yang tidak valid akan melempar Error.
 */
export function mapRegistrationRow(row: unknown): Registration {
  if (!isRegistrationRow(row)) {
    throw new Error('Invalid registration row shape returned from Supabase.')
  }
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    status: normalizeStatus(row.status),
    checkinAt: row.checkin_at,
    registeredAt: row.registered_at,
  }
}

/**
 * Map baris dengan JOIN user → RegistrationWithUser. Baris yang
 * tidak punya `user` ter-hydrate akan melempar Error.
 */
export function mapRegistrationWithUserRow(
  row: unknown,
): RegistrationWithUser {
  if (!isRegistrationRow(row)) {
    throw new Error('Invalid registration row shape returned from Supabase.')
  }
  if (!row.user) {
    throw new Error('Registration row missing nested `user` (event_users).')
  }
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    status: normalizeStatus(row.status),
    checkinAt: row.checkin_at,
    registeredAt: row.registered_at,
    user: mapUserRow(row.user),
  }
}

export function tryMapRegistrationWithUserRow(
  row: unknown,
): RegistrationWithUser | null {
  if (row === null || row === undefined) return null
  return mapRegistrationWithUserRow(row)
}

/**
 * Map baris dengan JOIN event → RegistrationWithEvent. Baris yang
 * tidak punya `event` ter-hydrate akan melempar Error.
 *
 * Dipakai oleh halaman Master User → detail user untuk menampilkan
 * event yang pernah diikuti user.
 */
export function mapRegistrationWithEventRow(
  row: unknown,
): RegistrationWithEvent {
  if (!isRegistrationRow(row)) {
    throw new Error('Invalid registration row shape returned from Supabase.')
  }
  if (!row.event) {
    throw new Error('Registration row missing nested `event` (events).')
  }
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    status: normalizeStatus(row.status),
    checkinAt: row.checkin_at,
    registeredAt: row.registered_at,
    event: mapEventRow(row.event),
  }
}

export function tryMapRegistrationWithEventRow(
  row: unknown,
): RegistrationWithEvent | null {
  if (row === null || row === undefined) return null
  return mapRegistrationWithEventRow(row)
}
