import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'

/**
 * Statistik kehadiran seorang user (akumulasi dari semua event).
 * Dipakai untuk menampilkan "pernah daftar berapa event, hadir berapa"
 * — sesuai requirement master user dashboard ringkasan.
 */
export interface UserStats {
  totalRegistered: number
  totalAttended: number
}

export interface UserRepository {
  /**
   * Cari user berdasarkan nomor HP yang sudah dinormalisasi
   * (digits only, awalan '0', panjang 10-15).
   * Return null kalau tidak ditemukan.
   */
  findByPhone(noHp: string): Promise<EventUser | null>

  findById(id: string): Promise<EventUser | null>

  /**
   * Insert user baru. ID di-generate oleh repository agar konsisten
   * dengan format 'USR-YYYY-NNNNN'. Melempar Error jika noHp sudah ada.
   */
  create(input: EventUserFormData): Promise<EventUser>

  getStats(id: string): Promise<UserStats>
}
