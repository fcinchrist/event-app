import type {
  AttendancePeriod,
  AttendanceSummary,
} from '~/domain/repositories/registration-repository'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Use case: ambil ringkasan kehadiran per anggota, di-filter berdasarkan
 * periode (`all` / `day` / `year`). Dipakai oleh dashboard admin untuk
 * section "Counting Kehadiran All Anggota".
 *
 * Catatan: delegasi 1:1 ke repository. Validasi input sengaja
 * dilakukan di sini (bukan di repository) supaya boundary use case
 * konsisten dengan use case lain di project ini (lihat
 * `GetEventRegistrations`, `GetEventRegistrationsCount`).
 */
export class GetAttendanceByPeriod {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  execute(period: AttendancePeriod): Promise<AttendanceSummary[]> {
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
    return this.registrationRepository.getAttendanceByUser(period)
  }
}
