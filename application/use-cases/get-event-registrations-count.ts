import type { RegistrationRepository } from '~/domain/repositories/registration-repository'

/**
 * Ambil jumlah registrasi (slot taken) untuk 1 event — versi ringan
 * tanpa JOIN ke `event_users`. Dipakai oleh halaman utama (EventCard
 * badge "X/Y Terisi") yang hanya butuh angka, bukan data peserta.
 *
 * Keunggulan vs `GetEventRegistrations`:
 *   - Query `count(*)` ringan (tidak menarik semua kolom + relasi user)
 *   - Tidak gagal kalau ada baris orphaned (user sudah dihapus), jadi
 *     halaman publik tidak akan "tiba-tiba jadi 0" saat refresh
 */
export class GetEventRegistrationsCount {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  execute(eventId: string): Promise<number> {
    if (!eventId) {
      throw new Error('Event ID tidak valid.')
    }
    return this.registrationRepository.countByEvent(eventId)
  }
}
