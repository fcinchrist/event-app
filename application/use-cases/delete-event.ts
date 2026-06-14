import type { EventRepository } from '~/domain/repositories/event-repository'

export class DeleteEvent {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(id: string): Promise<void> {
    if (!id) {
      throw new Error('ID event tidak valid.')
    }
    await this.eventRepository.delete(id)
  }
}
