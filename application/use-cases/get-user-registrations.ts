import type { RegistrationWithEvent } from '~/domain/entities/registration'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Ambil seluruh event yang pernah diikuti seorang user, dengan
 * data event ter-hydrate (judul, tanggal, lokasi, status, dll).
 * Dipakai di halaman detail Master User.
 *
 * Hasil sudah diurutkan: event terbaru lebih dulu.
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
