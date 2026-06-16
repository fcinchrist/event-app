import type { EventRepository } from '~/domain/repositories/event-repository'

/**
 * Hitung jumlah event per `EventStatusValue` (Aktif, Dibatalkan,
 * Selesai). Returned map selalu berisi ketiga key tersebut
 * (default 0 untuk yang tidak ada rows), supaya caller bisa
 * langsung render badge tanpa normalisasi tambahan.
 *
 * Mendukung optional `search` agar count tetap akurat saat user
 * sedang mengetik di search box (badge mencerminkan dataset yang
 * sama dengan tabel).
 *
 * Use case ini dipakai oleh tab badge di halaman Kelola Event
 * (sebelumnya badge salah karena menghitung dari rows halaman
 * ini saja, bukan total di database).
 */
export class CountEventsByStatus {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(search?: string): Promise<Record<string, number>> {
    const raw = await this.eventRepository.countByStatus(search)
    return {
      Aktif: typeof raw.Aktif === 'number' ? raw.Aktif : 0,
      Dibatalkan: typeof raw.Dibatalkan === 'number' ? raw.Dibatalkan : 0,
      Selesai: typeof raw.Selesai === 'number' ? raw.Selesai : 0,
    }
  }
}
