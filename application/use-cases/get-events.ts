import type { Event } from '~/domain/entities/event'
import type { EventListParams, EventRepository } from '~/domain/repositories/event-repository'
import type { PaginatedResult } from '~/types/pagination'

export class GetEvents {
  constructor(private readonly eventRepository: EventRepository) {}

  execute(params: EventListParams): Promise<PaginatedResult<Event>> {
    const page = Math.max(1, params.page)
    // Cap raised to 100 so the home page (perPage=9) can back roughly
    // 11 pages of events in a single `fetchEvents()` call. Raise further
    // if traffic/growth demands it.
    const limit = Math.min(100, Math.max(1, params.limit))
    return this.eventRepository.getAll({ ...params, page, limit })
  }
}
