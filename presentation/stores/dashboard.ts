import { defineStore } from 'pinia'
import type { Event, EventFormData } from '~/domain/entities/event'
import type { PaginatedResult } from '~/types/pagination'
import type { EventStatusValue } from '~/types/common'
import { SupabaseEventRepository } from '~/infrastructure/repositories/supabase-event-repository'
import { GetEvents } from '~/application/use-cases/get-events'
import { GetEventById } from '~/application/use-cases/get-event-by-id'
import { CreateEvent } from '~/application/use-cases/create-event'
import { UpdateEvent } from '~/application/use-cases/update-event'
import { DeleteEvent } from '~/application/use-cases/delete-event'
import { UploadEventImage } from '~/application/use-cases/upload-event-image'
import { UpdateEventStatus } from '~/application/use-cases/update-event-status'

const EMPTY_RESULT: PaginatedResult<Event> = {
  data: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
}

interface DashboardState {
  events: Event[]
  pagination: PaginatedResult<Event>['meta']
  page: number
  limit: number
  search: string
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  selectedEvent: Event | null
}

function getEventRepository(): SupabaseEventRepository {
  return new SupabaseEventRepository()
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    events: [],
    pagination: { ...EMPTY_RESULT.meta },
    page: 1,
    limit: 10,
    search: '',
    // isLoading default TRUE agar render pertama menampilkan skeleton
    // sampai fetchEvents() pertama selesai (lihat helper.md: Loading State).
    isLoading: true,
    isSubmitting: false,
    error: null,
    selectedEvent: null,
  }),

  actions: {
    async fetchEvents(): Promise<void> {
      this.isLoading = true
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new GetEvents(repo)
        const result = await useCase.execute({
          page: this.page,
          limit: this.limit,
          search: this.search,
        })
        this.events = result.data
        this.pagination = result.meta
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memuat event.'
        this.error = message
      } finally {
        this.isLoading = false
      }
    },

    async fetchEventById(id: string): Promise<Event | null> {
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new GetEventById(repo)
        const event = await useCase.execute(id)
        this.selectedEvent = event
        return event
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memuat detail event.'
        this.error = message
        return null
      }
    },

    async createEvent(payload: EventFormData): Promise<{ success: boolean; error: string | null; event: Event | null }> {
      this.isSubmitting = true
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new CreateEvent(repo)
        const event = await useCase.execute(payload)
        // prepend ke list & reset ke page 1
        this.events = [event, ...this.events]
        this.page = 1
        return { success: true, error: null, event }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal membuat event.'
        this.error = message
        return { success: false, error: message, event: null }
      } finally {
        this.isSubmitting = false
      }
    },

    async updateEvent(id: string, payload: EventFormData): Promise<{ success: boolean; error: string | null; event: Event | null }> {
      this.isSubmitting = true
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new UpdateEvent(repo)
        const event = await useCase.execute({ id, ...payload })
        // Sinkronkan dengan list lokal
        this.events = this.events.map((e) => (e.id === id ? event : e))
        if (this.selectedEvent?.id === id) this.selectedEvent = event
        return { success: true, error: null, event }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memperbarui event.'
        this.error = message
        return { success: false, error: message, event: null }
      } finally {
        this.isSubmitting = false
      }
    },

    async deleteEvent(id: string): Promise<{ success: boolean; error: string | null }> {
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new DeleteEvent(repo)
        await useCase.execute(id)
        this.events = this.events.filter((e) => e.id !== id)
        if (this.selectedEvent?.id === id) this.selectedEvent = null
        return { success: true, error: null }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal menghapus event.'
        this.error = message
        return { success: false, error: message }
      }
    },

    async uploadImage(file: File): Promise<{ success: boolean; error: string | null; url: string | null }> {
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new UploadEventImage(repo)
        const url = await useCase.execute(file)
        return { success: true, error: null, url }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal mengupload gambar.'
        this.error = message
        return { success: false, error: message, url: null }
      }
    },

    async updateEventStatus(id: string, status: EventStatusValue): Promise<{ success: boolean; error: string | null; event: Event | null }> {
      this.isSubmitting = true
      this.error = null
      try {
        const repo = getEventRepository()
        const useCase = new UpdateEventStatus(repo)
        const event = await useCase.execute(id, status)
        // Sinkronkan dengan list lokal
        this.events = this.events.map((e) => (e.id === id ? event : e))
        if (this.selectedEvent?.id === id) this.selectedEvent = event
        return { success: true, error: null, event }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memperbarui status event.'
        this.error = message
        return { success: false, error: message, event: null }
      } finally {
        this.isSubmitting = false
      }
    },

    setPage(page: number): void {
      this.page = Math.max(1, page)
    },

    setSearch(search: string): void {
      this.search = search
      this.page = 1
    },
  },
})
