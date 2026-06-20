/**
 * EventUser – master user publik (tanpa auth).
 *
 * Setiap user yang pernah mendaftar di event manapun akan disimpan
 * di tabel ini sehingga，下次 daftar tinggal ketik no HP dan namanya
 * otomatis ter-isi (autofill).
 *
 * ID format: 'USR-2026-00001' (tahun + 5 digit urut).
 * noHp disimpan dalam format ternormalisasi '08123456789' (digit only,
 * selalu diawali '0' untuk konsistensi pencarian).
 */

/**
 * Status akun master user.
 *  - active   : boleh digunakan normal (default, sesuai DEFAULT di migration 004)
 *  - inactive : akun di-nonaktifkan (mis. user pindah / berhenti hadir)
 *  - banned   : akun diblokir (mis. melakukan pelanggaran)
 */
export type UserStatus = 'active' | 'inactive' | 'banned'

/**
 * Tipe keanggotaan user.
 *  - internal : anggota internal komunitas (di-set manual oleh admin dari dashboard)
 *  - external : peserta umum / di luar komunitas (default untuk alur publik,
 *               sesuai DEFAULT aplikasi di RegisterUser & AddUserModal)
 *
 * Catatan: DEFAULT kolom DB tetap 'internal' demi back-fill baris lama.
 * Default aplikasi untuk pendaftaran publik baru adalah 'external'.
 */
export type MemberType = 'internal' | 'external'

/**
 * Label Indonesia untuk setiap nilai UserStatus / MemberType.
 * Dipakai oleh badge dan dropdown di UI admin.
 */
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  banned: 'Diblokir',
}

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  internal: 'Internal',
  external: 'Eksternal',
}

export interface EventUser {
  id: string
  noHp: string
  nama: string
  userStatus: UserStatus
  memberType: MemberType
  createdAt: string
  updatedAt: string
}

/**
 * Bentuk minimal `EventUser` yang BOLEH dikembalikan ke klien publik
 * (form booking tanpa login). Hanya `id` & `nama` — tanpa `noHp`,
 * `userStatus`, `memberType`, atau timestamp internal.
 *
 * Ini adalah hasi output dari RPC
 * [`public.lookup_event_user_by_phone(text)`](supabase/migrations/006_admin_users_and_rls_hardening.sql)
 * yang dipasang di migration #6 untuk menutup kebocoran PII lewat
 * `event_users_read_public` (migration 002).
 *
 * Pakai tipe ini untuk binding state autofill, BUKAN [`EventUser`].
 */
export interface EventUserPublicSummary {
  id: string
  nama: string
}

/**
 * Data yang dikirim caller untuk membuat / memperbarui user.
 *
 * `userStatus` dan `memberType` dibuat OPSIONAL di level form data
 * karena alur publik (form booking di [`BookEvent`](application/use-cases/book-event.ts:70))
 * tidak знает status keanggotaan user. Kalau caller tidak mengirim,
 * [`RegisterUser`](application/use-cases/register-user.ts:19) akan
 * mengisi default `active` + `internal` (sesuai DEFAULT migration 004)
 * dan [`SupabaseUserRepository.update`](infrastructure/repositories/supabase-user-repository.ts:101)
 * akan mengabaikan field yang tidak dikirim.
 */
export interface EventUserFormData {
  noHp: string
  nama: string
  userStatus?: UserStatus
  memberType?: MemberType
}
