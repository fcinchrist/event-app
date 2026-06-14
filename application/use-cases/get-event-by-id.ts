import type { Event } from '~/domain/entities/event'
import type { EventRepository } from '~/domain/repositories/event-repository'

export class GetEventById {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(id: string): Promise<Event | null> {
    if (!id) return null
    return this.eventRepository.getById(id)
  }
}
