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
}
