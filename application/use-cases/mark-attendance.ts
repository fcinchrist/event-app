import type { Registration, RegistrationStatus } from '~/domain/entities/registration'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

export class MarkAttendance {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  async execute(
    registrationId: string,
    status: RegistrationStatus,
  ): Promise<Registration> {
    if (!registrationId) {
      throw new Error('Registration ID tidak valid.')
    }
    return this.registrationRepository.updateStatus(registrationId, status)
  }
}
