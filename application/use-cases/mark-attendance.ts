import type { Registration, RegistrationStatus } from '~/domain/entities/registration'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Mark attendance use case.
 *
 * Used by admins/organizers to toggle a participant's attendance
 * status (Hadir / Tidak Hadir) from the dashboard.
 *
 * `verifiedByEmail` is the email of the currently logged-in admin
 * who clicked the button — it is forwarded to the repository and
 * persisted in the `verified_by_email` + `verified_at` columns
 * (see migration #5) as a simple audit trail.
 */
export class MarkAttendance {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  async execute(
    registrationId: string,
    status: RegistrationStatus,
    verifiedByEmail?: string | null,
  ): Promise<Registration> {
    if (!registrationId) {
      throw new Error('Registration ID is not valid.')
    }
    return this.registrationRepository.updateStatus(
      registrationId,
      status,
      verifiedByEmail ?? null,
    )
  }
}
