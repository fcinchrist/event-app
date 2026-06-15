import type { Event } from '~/domain/entities/event'
import type { EventListParams, EventRepository } from '~/domain/repositories/event-repository'
import type { PaginatedResult } from '~/types/pagination'

export class GetEvents {
  constructor(private readonly eventRepository: EventRepository) {}

  execute(params: EventListParams): Promise<PaginatedResult<Event>> {
    const page = Math.max(1, params.page)
    // Cap dinaikkan ke 100 agar halaman utama (perPage=9) bisa memuat
    // sampai ~11 halaman event dalam satu kali fetch. Naikkan lagi
    // bila traffic/growth membutuhkan.
    const limit = Math.min(100, Math.max(1, params.limit))
    return this.eventRepository.getAll({ ...params, page, limit })
  }
}
