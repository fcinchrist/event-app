import type { EventUser } from '~/domain/entities/event-user'
import type { Event } from '~/domain/entities/event'

/**
 * Status lifecycle sebuah registrasi (1 baris = 1 user × 1 event):
 * - 'Terdaftar'   : user sudah submit form, belum check-in
 * - 'Hadir'       : panitia menandai user sudah check-in di lokasi
 * - 'Tidak Hadir' : panitia menandai user tidak hadir saat acara
 *
 * Status kehadiran di-toggle manual oleh admin lewat dashboard.
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
 * Hasil join registrasi dengan event (untuk halaman "event yang
 * diikuti user" di master user). Relasi event di-load via PostgREST
 * embed `event:events(*)`.
 */
export interface RegistrationWithEvent extends Registration {
  event: Event
}

export interface RegistrationInput {
  userId: string
  eventId: string
}
