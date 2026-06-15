import type { EventUser } from '~/domain/entities/event-user'
import type { Event } from '~/domain/entities/event'

/**
 * Lifecycle of a single registration (1 row = 1 user × 1 event):
 * - 'Terdaftar'    : user submitted the form, not yet checked in.
 * - 'Hadir'        : organizer marked the user as checked in on site.
 * - 'Tidak Hadir'  : organizer marked the user as a no-show.
 *
 * Status transitions are toggled manually by the admin via the dashboard.
 */
export type RegistrationStatus = 'Terdaftar' | 'Hadir' | 'Tidak Hadir'

export const REGISTRATION_STATUS_VALUES: readonly RegistrationStatus[] = [
  'Terdaftar',
  'Hadir',
  'Tidak Hadir',
] as const

export function isRegistrationStatusValue(value: unknown): value is RegistrationStatus {
  return (
    typeof value === 'string' &&
    (REGISTRATION_STATUS_VALUES as readonly string[]).includes(value)
  )
}

export interface Registration {
  id: string             // 'REG-2026-00001'
  userId: string         // FK -> event_users.id
  eventId: string        // FK -> events.id (uuid)
  status: RegistrationStatus
  checkinAt: string | null
  registeredAt: string
}

export interface RegistrationWithUser extends Registration {
  user: EventUser
}

/**
 * Registration joined with its event (used by the "events followed
 * by this user" panel on the master user detail page). The `event`
 * relation is loaded via the PostgREST embed `event:events(*)`.
 */
export interface RegistrationWithEvent extends Registration {
  event: Event
}

export interface RegistrationInput {
  userId: string
  eventId: string
}
