import type { Registration } from '~/domain/entities/registration'
import type { EventRepository } from '~/domain/repositories/event-repository'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

export interface BookEventInput {
  noHp: string
  nama?: string
  eventId: string
}

/**
 * Orchestrates the public event booking flow:
 *   1. Normalize the phone number
 *   2. Validate the event exists and its date is not in the past
 *   3. Look up an existing user by phone number
 *   4. If none exists, create a new user (name is required from input)
 *   5. Check for an existing registration (userId, eventId)
 *   6. If one exists, throw "You are already registered for this event"
 *   7. Insert a new registration
 *
 * Date validation is performed here (not only in the form) so the
 * check remains authoritative even if the UI is bypassed (e.g.
 * manual requests via DevTools or third-party integrations).
 */
export class BookEvent {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly registrationRepository: RegistrationRepository,
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(input: BookEventInput, now: Date = new Date()): Promise<Registration> {
    const noHp = normalizePhone(input.noHp)
    if (!noHp) {
      throw new Error('Nomor HP tidak valid.')
    }
    if (!input.eventId) {
      throw new Error('Event tidak valid.')
    }

    // 1. Validate the event: it must exist, be active, and not in the past.
    //    Compare at the day level (YYYY-MM-DD) so that an event running
    //    today can still be booked up until its start time.
    const event = await this.eventRepository.getById(input.eventId)
    if (!event) {
      throw new Error('Event tidak ditemukan.')
    }
    if (event.status === 'Dibatalkan') {
      throw new Error('Event ini sudah dibatalkan.')
    }
    if (event.status === 'Selesai') {
      throw new Error('Event ini sudah ditutup.')
    }
    const todayStr = now.toISOString().slice(0, 10)
    const eventDateStr = event.date.slice(0, 10)
    if (eventDateStr < todayStr) {
      throw new Error('Maaf, event ini sudah lewat dan tidak bisa di-booking lagi.')
    }

    // 2. Look up the user, or create one if missing
    let user = await this.userRepository.findByPhone(noHp)
    if (!user) {
      if (!input.nama || input.nama.trim().length < 2) {
        throw new Error(
          'Nomor HP belum pernah terdaftar. Mohon isi nama Anda.',
        )
      }
      user = await this.userRepository.create({
        noHp,
        nama: input.nama.trim(),
      })
    }

    // 3. Check for a duplicate registration
    const existing = await this.registrationRepository.findByUserAndEvent(
      user.id,
      input.eventId,
    )
    if (existing) {
      throw new Error('Nomor HP ini sudah terdaftar di event ini.')
    }

    // 4. Insert the new registration
    return this.registrationRepository.create({
      userId: user.id,
      eventId: input.eventId,
    })
  }
}
