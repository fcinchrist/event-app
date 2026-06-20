import type { Registration } from '~/domain/entities/registration'
import type { EventRepository } from '~/domain/repositories/event-repository'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'
import type { UserRepository } from '~/domain/repositories/user-repository'
import {
  normalizePhone,
  validatePhoneFormat,
  PHONE_VALIDATION_ERROR,
} from '~/application/use-cases/normalize-phone'

export interface BookEventInput {
  eventId: string
  noHp: string
  nama: string
  memberType?: 'internal' | 'external'
}

export class BookEvent {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventRepository: EventRepository,
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  async execute(input: BookEventInput, now: Date = new Date()): Promise<Registration> {
    // 1. Validate event exists and is open for booking.
    const event = await this.eventRepository.getById(input.eventId)
    if (!event) throw new Error('Event tidak ditemukan.')
    if (event.status !== 'Aktif') {
      throw new Error('Event belum dipublikasikan atau sudah ditutup.')
    }
    if (new Date(event.date) < now) {
      throw new Error('Event sudah lewat.')
    }

    // 2. Resolve user (autofill existing, or create new).
    const normalizedPhone = validatePhoneFormat(normalizePhone(input.noHp))
    if (!normalizedPhone) {
      throw new Error(PHONE_VALIDATION_ERROR)
    }

    let user = await this.userRepository.findByPhone(normalizedPhone)
    if (!user) {
      user = await this.userRepository.create({
        noHp: normalizedPhone,
        nama: input.nama,
        memberType: input.memberType ?? 'external',
      })
    }

    // 3. Duplicate check via RPC (after migration 006, anon SELECT
    //    on event_registrations is blocked, so we use a SECURITY
    //    DEFINER boolean RPC).
    const alreadyRegistered = await this.registrationRepository.existsByUserAndEvent(
      user.id,
      input.eventId,
    )
    if (alreadyRegistered) {
      throw new Error('Nomor HP ini sudah terdaftar di event ini.')
    }

    // 4. Quota check.
    const taken = await this.registrationRepository.countByEvent(input.eventId)
    if (event.quota != null && taken >= event.quota) {
      throw new Error('Kuota event sudah penuh.')
    }

    // 5. Create registration.
    return this.registrationRepository.create({
      userId: user.id,
      eventId: input.eventId,
    })
  }
}
