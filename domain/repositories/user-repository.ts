import type {
  EventUser,
  EventUserFormData,
  EventUserPublicSummary,
} from '~/domain/entities/event-user'
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

/**
 * Statistik kehadiran seorang user yang dikelompokkan per kategori event.
 * Dipakai oleh halaman detail user (section "Tingkat Kehadiran per Kategori")
 * untuk menampilkan persentase kehadiran + total daftar + total hadir
 * per kategori. Daftar event yang event.category_id NULL akan
 * dikelompokkan ke "Tanpa Kategori" (categoryId = null, name = 'Tanpa Kategori').
 */
export interface CategoryAttendanceStat {
  categoryId: string | null
  categoryName: string
  totalRegistered: number
  totalAttended: number
  /**
   * Persentase kehadiran (0-100), dibulatkan ke bilangan bulat.
   * 0 jika totalRegistered = 0.
   */
  attendanceRate: number
}

export interface UserRepository {
  /**
   * Cari user berdasarkan nomor HP yang sudah dinormalisasi
   * (digits only, awalan '0', panjang 10-15).
   *
   * Return ENTITY [`EventUser`] lengkap (termasuk `userStatus`,
   * `memberType`, `createdAt`). Dipakai oleh alur booking
   * ([`BookEvent`](application/use-cases/book-event.ts)) yang
   * butuh semua kolom untuk konsistensi default
   * [`RegisterUser`](application/use-cases/register-user.ts).
   *
   * Karena [`SupabaseUserRepository.findByPhone`] sekarang
   * dipanggil via RPC `SECURITY DEFINER`, method ini TIDAK boleh
   * dipanggil dari klien publik untuk enumerasi massal (lihat
   * catatan keamanan di implementasinya).
   *
   * Untuk autofill form publik, gunakan
   * [`UserRepository.findByPhonePublic`] yang return shape
   * minimal.
   */
  findByPhone(noHp: string): Promise<EventUser | null>

  /**
   * Lookup publik AMAN — hanya `(id, nama)`.
   *
   * Dipakai oleh [`FindUserByPhone`](application/use-cases/find-user-by-phone.ts)
   * untuk autofill form booking tanpa mengekspos PII lain. Backed
   * by RPC [`public.lookup_event_user_by_phone(text)`](supabase/migrations/006_admin_users_and_rls_hardening.sql)
   * (lihat migration #6).
   *
   * Return null kalau no HP belum terdaftar atau input invalid.
   */
  findByPhonePublic(noHp: string): Promise<EventUserPublicSummary | null>

  findById(id: string): Promise<EventUser | null>

  /**
   * Insert user baru. ID di-generate oleh repository agar konsisten
   * dengan format 'USR-YYYY-NNNNN'. Melempar Error jika noHp sudah ada.
   */
  create(input: EventUserFormData): Promise<EventUser>

  /**
   * Update data user (nama, noHp, userStatus, memberType).
   * noHp akan dinormalisasi oleh use-case sebelum dipanggil.
   * Melempar Error jika id tidak ditemukan / noHp konflik dengan user lain.
   */
  update(id: string, input: EventUserFormData): Promise<EventUser>

  /**
   * Hapus user. Relasi `event_registrations` akan ter-cascade
   * (lihat migration 002: `on delete cascade`).
   * Melempar Error jika id tidak ditemukan.
   */
  delete(id: string): Promise<void>

  getStats(id: string): Promise<UserStats>

  /**
   * List user dengan pagination + search server-side.
   * Search melakukan ILIKE ke kolom `nama` dan `no_hp`.
   * Digunakan oleh menu Master User di dashboard admin.
   */
  listUsers(params: UserListParams): Promise<PaginatedResult<EventUser>>

  /**
   * Ambil statistik kehadiran per kategori event untuk seorang user,
   * di-filter berdasarkan tahun pendaftaran event (registered_at).
   * Jika `year` = null → seluruh tahun (lifetime).
   * Tahun mengikuti `event.date`, bukan `registered_at` (event
   * adalah timeline utamanya, sehingga kehadiran "tahun 2025"
   * dihitung dari event yang tanggalnya di tahun 2025).
   */
  getStatsByCategory(
    userId: string,
    year: number | null,
  ): Promise<CategoryAttendanceStat[]>

  /**
   * Ambil daftar tahun unik dari event yang pernah diikuti user,
   * diurutkan descending (tahun terbaru dulu). Tahun mengikuti
   * `event.date`. Cocok untuk mengisi filter year-pills di UI.
   */
  getRegistrationYears(userId: string): Promise<number[]>
}
