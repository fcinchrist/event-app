import type { Event, EventFormData } from '~/domain/entities/event'
import type { EventStatusValue } from '~/types/common'
import type { PaginatedResult } from '~/types/pagination'

export interface EventListParams {
  page: number
  limit: number
  search?: string
}

export interface EventRepository {
  getAll(params: EventListParams): Promise<PaginatedResult<Event>>
  getById(id: string): Promise<Event | null>
  create(payload: EventFormData): Promise<Event>
  update(id: string, payload: EventFormData): Promise<Event>
  delete(id: string): Promise<void>
  uploadImage(file: File): Promise<string>
  updateStatus(id: string, status: EventStatusValue): Promise<Event>
  /**
   * Hitung jumlah event per status untuk badge tab di dashboard.
   * Menggunakan agregasi server-side (group-by) sehingga hasilnya
   * mencerminkan TOTAL seluruh halaman, bukan hanya halaman
   * yang sedang ditampilkan di tabel (yang hanya berisi ≤ `limit`
   * baris).
   *
   * @param search  Optional: ikut filter pencarian yang sama dengan
   *                list, supaya badge tetap akurat saat user
   *                mengetik di search box.
   * @returns Map keyed by `EventStatusValue` → count. Status yang
   *          tidak ada di result map berarti 0 (caller normalisasi).
   */
  countByStatus(search?: string): Promise<Record<string, number>>
}
