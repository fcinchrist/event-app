import type {
  Registration,
  RegistrationInput,
  RegistrationStatus,
  RegistrationWithUser,
} from '~/domain/entities/registration'

export interface RegistrationListParams {
  eventId?: string
  userId?: string
  status?: RegistrationStatus
}

export interface RegistrationRepository {
  /**
   * Ambil list registrasi. Default include `user:event_users(*)` join
   * sehingga UI langsung dapat nama & no HP peserta.
   */
  getAll(params?: RegistrationListParams): Promise<RegistrationWithUser[]>

  getById(id: string): Promise<Registration | null>

  /**
   * Cek apakah user sudah pernah daftar di event tertentu.
   * Dipakai oleh use case `BookEvent` untuk mencegah duplikat
   * sebelum insert.
   */
  findByUserAndEvent(userId: string, eventId: string): Promise<Registration | null>

  /**
   * Insert registrasi baru. ID di-generate oleh repository
   * ('REG-YYYY-NNNNN'). Melempar Error jika (userId, eventId) duplikat
   * (constraint unique di DB).
   */
  create(input: RegistrationInput): Promise<Registration>

  /**
   * Update status registrasi. Otomatis set `checkin_at = now()` saat
   * status baru = 'Hadir', dan null saat kembali ke 'Terdaftar'.
   */
  updateStatus(id: string, status: RegistrationStatus): Promise<Registration>

  delete(id: string): Promise<void>

  countByEvent(eventId: string): Promise<number>
}
