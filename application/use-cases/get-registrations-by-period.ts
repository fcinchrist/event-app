import type {
  AttendancePeriod,
  RegistrationWithUserAndEvent,
} from '~/domain/repositories/registration-repository'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Use case: ambil list registrasi (dengan user & event ter-hydrate)
 * yang difilter berdasarkan periode tanggal event. Dipakai oleh
 * summary dashboard untuk menghitung KPI / donut / occupancy /
 * recent activity sesuai filter periode aktif.
 *
 * Konsisten dengan use case `GetAttendanceByPeriod`: validasi input
 * dilakukan di sini, delegasi 1:1 ke repository.
 */
export class GetRegistrationsByPeriod {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  execute(period: AttendancePeriod): Promise<RegistrationWithUserAndEvent[]> {
    if (period.kind === 'day') {
      if (!period.date || !/^\d{4}-\d{2}-\d{2}$/.test(period.date)) {
        throw new Error('Format tanggal tidak valid (gunakan YYYY-MM-DD).')
      }
    }
    if (period.kind === 'year') {
      const y = period.year
      if (!Number.isInteger(y) || y < 1970 || y > 2999) {
        throw new Error('Tahun tidak valid.')
      }
    }
    return this.registrationRepository.listWithEventByPeriod(period)
  }
}
