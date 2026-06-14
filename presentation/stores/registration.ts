import { defineStore } from 'pinia'
import type { EventUser } from '~/domain/entities/event-user'
import type { RegistrationStatus } from '~/domain/entities/registration'
import type {
  Registration,
  RegistrationWithUser,
} from '~/domain/entities/registration'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'
import { SupabaseUserRepository } from '~/infrastructure/repositories/supabase-user-repository'
import { FindUserByPhone } from '~/application/use-cases/find-user-by-phone'
import { BookEvent } from '~/application/use-cases/book-event'
import { GetEventRegistrations } from '~/application/use-cases/get-event-registrations'
import { MarkAttendance } from '~/application/use-cases/mark-attendance'

/**
 * State booking & registrasi (untuk publik + admin).
 *
 * - Publik (form di event detail): lookup user by phone (autofill), book event
 * - Admin (dashboard modal peserta): fetch list, toggle status kehadiran
 *
 * Data di-cache per eventId di `participantsByEvent` agar refresh
 * halaman tidak selalu hit DB (cukup re-fetch kalau cache kosong /
 * sudah di-invalidate lewat action).
 */
interface RegistrationState {
  /**
   * Map eventId → list peserta (include user ter-hydrate).
   * Dipakai untuk render list peserta di event detail & dashboard.
   */
  participantsByEvent: Record<string, RegistrationWithUser[]>

  /**
   * Map eventId → loading state (true saat sedang fetch).
   * Dipakai untuk skeleton per event (bukan global).
   */
  isLoadingByEvent: Record<string, boolean>

  /** Submit-state form booking publik */
  isSubmittingBooking: boolean

  /** Auto-suggest state (lookup no HP di form publik) */
  isLookingUpUser: boolean

  /** Error terakhir (untuk Alert / Toast di UI) */
  error: string | null
}

export const useRegistrationStore = defineStore('registration', {
  state: (): RegistrationState => ({
    participantsByEvent: {},
    isLoadingByEvent: {},
    isSubmittingBooking: false,
    isLookingUpUser: false,
    error: null,
  }),

  getters: {
    /**
     * Jumlah peserta terdaftar untuk 1 event (exclude yang 'Tidak Hadir'
     * supaya konsisten dengan konsep "slot taken").
     */
    getSlotsTakenByEvent(): (eventId: string) => number {
      return (eventId: string) => {
        const list = this.participantsByEvent[eventId] ?? []
        return list.filter((r) => r.status !== 'Tidak Hadir').length
      }
    },

    /**
     * Slot tersisa (untuk badge / Disabled state form booking).
     * Return null kalau quota event tidak tersedia di store event.
     */
    getSlotsRemainingByEvent(): (eventId: string, quota: number) => number {
      return (eventId: string, quota: number) => {
        return Math.max(0, quota - this.getSlotsTakenByEvent(eventId))
      }
    },
  },

  actions: {
    /**
     * Helper internal: set loading state per event.
     */
    _setLoading(eventId: string, loading: boolean): void {
      this.isLoadingByEvent[eventId] = loading
    },

    /**
     * Ambil list peserta untuk 1 event dari Supabase. Cache ke
     * `participantsByEvent[eventId]` agar re-render tidak trigger refetch.
     */
    async fetchParticipants(eventId: string): Promise<void> {
      if (!eventId) return
      this._setLoading(eventId, true)
      this.error = null
      try {
        const repo = new SupabaseRegistrationRepository()
        const useCase = new GetEventRegistrations(repo)
        const list = await useCase.execute(eventId)
        this.participantsByEvent[eventId] = list
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Gagal memuat daftar peserta.'
        this.error = message
        this.participantsByEvent[eventId] = []
      } finally {
        this._setLoading(eventId, false)
      }
    },

    /**
     * Lookup user by phone (untuk autofill nama di form booking publik).
     * Return null kalau no HP tidak valid atau user tidak ditemukan.
     * Dipakai di EventBookingForm (debounce 600ms / on blur).
     */
    async lookupUserByPhone(rawPhone: string): Promise<EventUser | null> {
      this.isLookingUpUser = true
      this.error = null
      try {
        const userRepo = new SupabaseUserRepository()
        const useCase = new FindUserByPhone(userRepo)
        return await useCase.execute(rawPhone)
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Gagal mencari user.'
        this.error = message
        return null
      } finally {
        this.isLookingUpUser = false
      }
    },

    /**
     * Submit booking publik. Melakukan:
     *   1. Normalisasi no HP
     *   2. Cari / buat user master
     *   3. Cek duplikat (userId, eventId)
     *   4. Insert registrasi
     *   5. Refresh list peserta di cache untuk event tersebut
     *
     * Return null kalau sukses, atau string error kalau gagal
     * (dipakai form untuk tampilkan Alert / inline error).
     */
    async registerForEvent(input: {
      noHp: string
      nama?: string
      eventId: string
    }): Promise<string | null> {
      this.isSubmittingBooking = true
      this.error = null
      try {
        const userRepo = new SupabaseUserRepository()
        const regRepo = new SupabaseRegistrationRepository()
        const useCase = new BookEvent(userRepo, regRepo)
        await useCase.execute(input)
        // Refresh cache peserta untuk event ini
        await this.fetchParticipants(input.eventId)
        return null
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Gagal melakukan booking. Silakan coba lagi.'
        this.error = message
        return message
      } finally {
        this.isSubmittingBooking = false
      }
    },

    /**
     * Toggle status kehadiran (dipakai admin di modal peserta dashboard).
     * Update baris di cache `participantsByEvent[eventId]` secara lokal
     * supaya UI langsung reaktif tanpa round-trip DB.
     */
    async markAttendance(
      eventId: string,
      registrationId: string,
      status: RegistrationStatus,
    ): Promise<string | null> {
      this.error = null
      try {
        const repo = new SupabaseRegistrationRepository()
        const useCase = new MarkAttendance(repo)
        const updated: Registration = await useCase.execute(
          registrationId,
          status,
        )
        const list = this.participantsByEvent[eventId]
        if (list) {
          this.participantsByEvent[eventId] = list.map((r) =>
            r.id === registrationId
              ? { ...r, status: updated.status, checkinAt: updated.checkinAt }
              : r,
          )
        }
        return null
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Gagal memperbarui status kehadiran.'
        this.error = message
        return message
      }
    },

    /**
     * Reset cache untuk 1 event (misalnya setelah event dihapus).
     */
    clearParticipants(eventId: string): void {
      delete this.participantsByEvent[eventId]
      delete this.isLoadingByEvent[eventId]
    },
  },
})
