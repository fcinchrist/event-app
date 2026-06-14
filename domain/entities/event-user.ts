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
export interface EventUser {
  id: string
  noHp: string
  nama: string
  createdAt: string
  updatedAt: string
}

export interface EventUserFormData {
  noHp: string
  nama: string
}
