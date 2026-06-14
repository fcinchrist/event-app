import type { Event } from '~/domain/entities/event'
import type { EventListParams, EventRepository } from '~/domain/repositories/event-repository'
import type { PaginatedResult } from '~/types/pagination'

export class GetEvents {
  constructor(private readonly eventRepository: EventRepository) {}

  execute(params: EventListParams): Promise<PaginatedResult<Event>> {
    const page = Math.max(1, params.page)
    const limit = Math.min(20, Math.max(1, params.limit))
    return this.eventRepository.getAll({ ...params, page, limit })
  }
}
