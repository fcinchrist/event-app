import type { RegistrationWithEvent } from '~/domain/entities/registration'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Loads every event a user has ever registered for, with the event
 * data hydrated (title, date, location, status, etc.). Result is
 * pre-sorted with the newest event first.
 */
export class GetUserRegistrations {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  execute(userId: string): Promise<RegistrationWithEvent[]> {
    if (!userId) {
      throw new Error('User ID tidak valid.')
    }
    return this.registrationRepository.listByUserWithEvent(userId)
  }
}
