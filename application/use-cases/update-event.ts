import type { Event, EventFormData } from '~/domain/entities/event'
import type { EventRepository } from '~/domain/repositories/event-repository'

export interface UpdateEventInput {
  id: string
  title: string
  date: string
  quota: number | string
  location: string
  image: string
  description: string
}

export class UpdateEvent {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(input: UpdateEventInput): Promise<Event> {
    if (!input.id) {
      throw new Error('ID event tidak valid.')
    }
    if (!input.title.trim()) {
      throw new Error('Judul event wajib diisi.')
    }
    if (!input.date) {
      throw new Error('Tanggal & waktu event wajib diisi.')
    }
    if (!input.location.trim()) {
      throw new Error('Lokasi kegiatan wajib diisi.')
    }
    const quotaNumber = typeof input.quota === 'string'
      ? parseInt(input.quota, 10)
      : input.quota
    if (!Number.isFinite(quotaNumber) || quotaNumber <= 0) {
      throw new Error('Kuota peserta harus berupa angka lebih dari 0.')
    }

    const payload: EventFormData = {
      title: input.title.trim(),
      date: input.date,
      location: input.location.trim(),
      quota: quotaNumber,
      image: input.image ?? '',
      description: (input.description ?? '').trim(),
    }

    return this.eventRepository.update(input.id, payload)
  }
}
