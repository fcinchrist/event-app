import { defineStore } from 'pinia'
import type { Event, EventFormData } from '~/domain/entities/event'
import type { PaginatedResult } from '~/types/pagination'
import type { EventStatusValue } from '~/types/common'
import type {
  AttendancePeriod,
  AttendanceSummary,
  RegistrationWithUserAndEvent,
} from '~/domain/repositories/registration-repository'
import { SupabaseEventRepository } from '~/infrastructure/repositories/supabase-event-repository'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'
import { GetEvents } from '~/application/use-cases/get-events'
import { GetEventById } from '~/application/use-cases/get-event-by-id'
import { CreateEvent } from '~/application/use-cases/create-event'
import { UpdateEvent } from '~/application/use-cases/update-event'
import { DeleteEvent } from '~/application/use-cases/delete-event'
import { UploadEventImage } from '~/application/use-cases/upload-event-image'
import { UpdateEventStatus } from '~/application/use-cases/update-event-status'
import { GetAttendanceByPeriod } from '~/application/use-cases/get-attendance-by-period'
import { GetRegistrationsByPeriod } from '~/application/use-cases/get-registrations-by-period'
import { createLogger } from '~/utils/logger'

const log = createLogger('dashboard-store')

const EMPTY_RESULT: PaginatedResult<Event> = {
  data: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
}

/**
 * Tipe filter periode untuk KPI & attendance list di dashboard.
 *
 * - `mode: 'all'`   → tidak ada filter tanggal (semua waktu)
 * - `mode: 'day'`   → `date` harus berformat YYYY-MM-DD (1 hari spesifik)
 * - `mode: 'year'`  → `year` integer 4 digit (1 tahun)
 *
 * `mode` default adalah 'all' supaya halaman ringkasan yang baru
 * dibuka langsung menampilkan data agregat tanpa input manual.
 */
export type DashboardPeriodMode = 'all' | 'day' | 'year'

export interface DashboardPeriodFilter {
  mode: DashboardPeriodMode
  date: string
  year: number
}

function emptyPeriodFilter(): DashboardPeriodFilter {
  return { mode: 'all', date: '', year: new Date().getFullYear() }
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
  /**
   * Filter periode global di dashboard. Mempengaruhi:
   *   - section "Counting Kehadiran All Anggota" (aggregasi)
   *   - KPI (total event aktif, total reservasi, dll)
   *   - donut chart (hadir vs tidak hadir)
   *   - occupancy list (event + slot di periode tersebut)
   *   - recent activity (check-in di periode tersebut)
   */
  period: DashboardPeriodFilter
  /** Loading state khusus untuk attendance aggregation */
  isAttendanceLoading: boolean
  /** Ringkasan kehadiran per anggota (sudah di-sort by totalHadir desc) */
  attendanceSummaries: AttendanceSummary[]
  /**
   * List registrasi (dengan user & event ter-hydrate) pada periode
   * aktif. Dipakai oleh KPI / donut / occupancy / recent activity.
   */
  periodRegistrations: RegistrationWithUserAndEvent[]
  /** Event list (master, tidak tergantung periode) */
  isRegistrationsLoading: boolean
  /** Subset event yang sesuai dengan periode aktif (untuk occupancy). */
  periodEvents: Event[]
}

function getEventRepository(): SupabaseEventRepository {
  return new SupabaseEventRepository()
}

function getRegistrationRepository(): SupabaseRegistrationRepository {
  return new SupabaseRegistrationRepository()
}

function toAttendancePeriod(p: DashboardPeriodFilter): AttendancePeriod {
  if (p.mode === 'day' && p.date) return { kind: 'day', date: p.date }
  if (p.mode === 'year') return { kind: 'year', year: p.year }
  return { kind: 'all' }
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    events: [],
    pagination: { ...EMPTY_RESULT.meta },
    page: 1,
    limit: 10,
    search: '',
    // `isLoading` defaults to TRUE so the first render shows a
    // skeleton until the first `fetchEvents()` completes (see
    // helper.md: "Loading State (Skeleton-only)").
    isLoading: true,
    isSubmitting: false,
    error: null,
    selectedEvent: null,
    period: emptyPeriodFilter(),
    isAttendanceLoading: false,
    attendanceSummaries: [],
    periodRegistrations: [],
    isRegistrationsLoading: false,
    periodEvents: [],
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
        log.error('Store action failed', err, { action: 'fetchEvents' })
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
        log.error('Store action failed', err, { action: 'fetchEventById' })
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
        // prepend to the list and reset to page 1
        this.events = [event, ...this.events]
        this.page = 1
        return { success: true, error: null, event }
      } catch (err: unknown) {
        log.error('Store action failed', err, { action: 'createEvent' })
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
        // Sync the local list with the returned updated event.
        this.events = this.events.map((e) => (e.id === id ? event : e))
        if (this.selectedEvent?.id === id) this.selectedEvent = event
        return { success: true, error: null, event }
      } catch (err: unknown) {
        log.error('Store action failed', err, { action: 'updateEvent' })
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
        log.error('Store action failed', err, { action: 'deleteEvent' })
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
        log.error('Store action failed', err, { action: 'uploadImage' })
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
        // Sync the local list with the returned updated event.
        this.events = this.events.map((e) => (e.id === id ? event : e))
        if (this.selectedEvent?.id === id) this.selectedEvent = event
        return { success: true, error: null, event }
      } catch (err: unknown) {
        log.error('Store action failed', err, { action: 'updateEventStatus' })
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

    /**
     * Set mode filter periode. Jika mode='day', `date` harus diisi
     * (format YYYY-MM-DD). Jika mode='year', `year` harus 4 digit.
     * Setelah set, otomatis refetch data summary (registrasi + attendance).
     */
    async setPeriod(input: { mode: DashboardPeriodMode; date?: string; year?: number }): Promise<void> {
      if (input.mode === 'day') {
        const d = (input.date ?? '').trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          this.error = 'Format tanggal tidak valid (YYYY-MM-DD).'
          return
        }
        this.period = { mode: 'day', date: d, year: this.period.year }
      } else if (input.mode === 'year') {
        const y = input.year ?? this.period.year
        if (!Number.isInteger(y) || y < 1970 || y > 2999) {
          this.error = 'Tahun tidak valid.'
          return
        }
        this.period = { mode: 'year', date: '', year: y }
      } else {
        this.period = { mode: 'all', date: '', year: this.period.year }
      }
      // Refetch both: registrations (untuk KPI/donut/occupancy/recent)
      // dan attendance summary (untuk section "Counting Kehadiran All
      // Anggota"). Parallel supaya lebih cepat.
      await Promise.all([
        this.fetchRegistrationsByPeriod(),
        this.fetchAttendance(),
      ])
    },

    /**
     * Fetch ringkasan kehadiran per anggota, di-filter dengan `period`.
     * Cache disimpan ke `attendanceSummaries` (sudah di-sort by
     * `totalHadir` desc oleh repository).
     */
    async fetchAttendance(): Promise<void> {
      this.isAttendanceLoading = true
      this.error = null
      try {
        const repo = getRegistrationRepository()
        const useCase = new GetAttendanceByPeriod(repo)
        const list = await useCase.execute(toAttendancePeriod(this.period))
        this.attendanceSummaries = list
      } catch (err: unknown) {
        log.error('Store action failed', err, { action: 'fetchAttendance' })
        const message = err instanceof Error ? err.message : 'Gagal memuat data kehadiran.'
        this.error = message
        // Keep previous data on error to avoid empty flash.
      } finally {
        this.isAttendanceLoading = false
      }
    },

    /**
     * Fetch registrasi (dengan user & event) yang difilter dengan
     * `period`. Juga derive `periodEvents` (unique event yang muncul
     * di registrations) untuk dipakai oleh occupancy list.
     *
     * Dipakai oleh summary dashboard untuk:
     *   - KPI (totalEvents, totalReservations, presentCount, dll)
     *   - donut chart
     *   - recent activity
     *   - occupancy list (event di periode tersebut)
     */
    async fetchRegistrationsByPeriod(): Promise<void> {
      this.isRegistrationsLoading = true
      this.error = null
      try {
        const repo = getRegistrationRepository()
        const useCase = new GetRegistrationsByPeriod(repo)
        const list = await useCase.execute(toAttendancePeriod(this.period))
        this.periodRegistrations = list

        // Derive unique events for occupancy. Sort by date ASC supaya
        // tampilan okupansi stabil.
        const eventMap = new Map<string, Event>()
        for (const r of list) {
          if (!eventMap.has(r.event.id)) {
            eventMap.set(r.event.id, r.event)
          }
        }
        const events = Array.from(eventMap.values())
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        this.periodEvents = events
      } catch (err: unknown) {
        log.error('Store action failed', err, { action: 'fetchRegistrationsByPeriod' })
        const message = err instanceof Error ? err.message : 'Gagal memuat data registrasi.'
        this.error = message
        // Keep previous data on error to avoid empty flash.
      } finally {
        this.isRegistrationsLoading = false
      }
    },
  },
})
