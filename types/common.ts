export type EventStatus = 'Akan Datang' | 'Hari H Kegiatan' | 'Selesai / Lampau'

export type BookingStatus = 'Belum Hadir' | 'Hadir'

export type FilterPeriode = 'all' | 'aktif' | 'hari-h' | 'lampau' | 'custom'

export type AppRole = 'member' | 'admin'

/**
 * Status lifecycle sebuah event.
 * - 'Aktif': event tampil normal di publik, bisa di-booking
 * - 'Dibatalkan': event disembunyikan dari publik, admin masih bisa melihatnya
 * - 'Selesai': event sudah lewat (otomatis berdasarkan tanggal, atau di-set manual)
 */
export type EventStatusValue = 'Aktif' | 'Dibatalkan' | 'Selesai'

export const EVENT_STATUS_VALUES: readonly EventStatusValue[] = [
  'Aktif',
  'Dibatalkan',
  'Selesai',
] as const

export function isEventStatusValue(value: unknown): value is EventStatusValue {
  return typeof value === 'string' && (EVENT_STATUS_VALUES as readonly string[]).includes(value)
}
