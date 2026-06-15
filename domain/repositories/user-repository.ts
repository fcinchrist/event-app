import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type { PaginatedResult } from '~/types/pagination'

/**
 * Statistik kehadiran seorang user (akumulasi dari semua event).
 * Dipakai untuk menampilkan "pernah daftar berapa event, hadir berapa"
 * — sesuai requirement master user dashboard ringkasan.
 */
export interface UserStats {
  totalRegistered: number
  totalAttended: number
}

/**
 * Parameter untuk `listUsers`. Pagination + search server-side.
 * `search` mencocokkan `nama` ATAU `no_hp` (ILIKE).
 */
export interface UserListParams {
  page: number
  limit: number
  search?: string
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

  /**
   * List user dengan pagination + search server-side.
   * Search melakukan ILIKE ke kolom `nama` dan `no_hp`.
   * Digunakan oleh menu Master User di dashboard admin.
   */
  listUsers(params: UserListParams): Promise<PaginatedResult<EventUser>>
}
