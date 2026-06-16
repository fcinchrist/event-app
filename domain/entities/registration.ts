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
  /**
   * Email of the admin/organizer who last changed the attendance
   * status. NULL for old rows (before migration #5) and for rows
   * whose status is still the default 'Terdaftar' (never actioned).
   *
   * Stored as TEXT (not a FK to auth.users) so:
   *   1. It does not add coupling to the auth schema.
   *   2. It can be filled directly from the Supabase session, no join.
   *   3. It stays human-readable for audit purposes.
   */
  verifiedByEmail: string | null
  /**
   * Timestamp of the last attendance status change.
   * NULL for old rows / rows that have never been verified.
   * May differ from `checkinAt` because `checkinAt` is only set
   * when the status is 'Hadir', whereas `verifiedAt` is set on
   * every status change (including to 'Tidak Hadir').
   */
  verifiedAt: string | null
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
