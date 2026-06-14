import type { Event } from '~/domain/entities/event'
import type { EventRepository } from '~/domain/repositories/event-repository'
import { EVENT_STATUS_VALUES, isEventStatusValue, type EventStatusValue } from '~/types/common'

export class UpdateEventStatus {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(id: string, status: EventStatusValue): Promise<Event> {
    if (!id) {
      throw new Error('ID event tidak valid.')
    }
    if (!isEventStatusValue(status)) {
      throw new Error(
        `Status event tidak valid. Gunakan salah satu: ${EVENT_STATUS_VALUES.join(', ')}.`
      )
    }
    return this.eventRepository.updateStatus(id, status)
  }
}
