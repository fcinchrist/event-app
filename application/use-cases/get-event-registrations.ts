import type { RegistrationWithUser } from '~/domain/entities/registration'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Ambil list peserta 1 event (untuk dashboard admin & halaman publik).
 * Return selalu include `user` ter-hydrate dari JOIN `event_users`.
 */
export class GetEventRegistrations {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  execute(eventId: string): Promise<RegistrationWithUser[]> {
    if (!eventId) {
      throw new Error('Event ID tidak valid.')
    }
    return this.registrationRepository.getAll({ eventId })
  }
}
