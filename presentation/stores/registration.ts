import { defineStore } from 'pinia'
import type { EventUser } from '~/domain/entities/event-user'
import type { RegistrationStatus } from '~/domain/entities/registration'
import type {
  Registration,
  RegistrationWithUser,
} from '~/domain/entities/registration'
import { SupabaseEventRepository } from '~/infrastructure/repositories/supabase-event-repository'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'
import { SupabaseUserRepository } from '~/infrastructure/repositories/supabase-user-repository'
import { FindUserByPhone } from '~/application/use-cases/find-user-by-phone'
import { BookEvent } from '~/application/use-cases/book-event'
import { GetEventRegistrations } from '~/application/use-cases/get-event-registrations'
import { GetEventRegistrationsCount } from '~/application/use-cases/get-event-registrations-count'
import { MarkAttendance } from '~/application/use-cases/mark-attendance'

/**
 * State booking & registrasi (untuk publik + admin).
 *
 * - Publik (form di event detail): lookup user by phone (autofill), book event
 * - Admin (dashboard modal peserta): fetch list, toggle status kehadiran
 *
 * Cache dipisah jadi 2 supaya:
 *   - `participantsByEvent`     → list peserta lengkap (untuk detail & dashboard)
 *   - `slotsTakenByEvent`       → jumlah ringan per event (untuk badge EventCard)
 *
 * Pemisahan ini penting karena halaman utama (/, EventCard) TIDAK butuh
 * data peserta — hanya angka — dan query `count(*)` jauh lebih ringan
 * daripada SELECT semua kolom + JOIN ke event_users.
 *
 * Semua aksi fetch aman terhadap error: kalau request gagal, cache
 * yang sudah ada (kalau ada) dipertahankan, dan `isCountLoadingByEvent`
 * di-reset ke false supaya UI tidak stuck di skeleton. Sebelumnya
 * `fetchParticipants` me-reset ke `[]` di catch, yang menyebabkan
 * counter "X/Y Terisi" tiba-tiba jadi 0 di setiap refresh.
 */
interface RegistrationState {
  /**
   * Map eventId → list peserta (include user ter-hydrate).
   * Dipakai untuk render list peserta di event detail & dashboard.
   */
  participantsByEvent: Record<string, RegistrationWithUser[]>

  /**
   * Map eventId → loading state (true saat sedang fetch list).
   * Dipakai untuk skeleton per event (bukan global).
   */
  isLoadingByEvent: Record<string, boolean>

  /**
   * Map eventId → jumlah peserta terdaftar (slot taken).
   * Dipakai untuk badge "X/Y Terisi" di EventCard (halaman utama).
   * Terpisah dari participantsByEvent supaya halaman utama tidak
   * butuh JOIN berat ke event_users.
   */
  slotsTakenByEvent: Record<string, number>

  /**
   * Map eventId → loading state untuk count (badge counter).
   * Dipakai EventCard untuk skeleton singkat saat refresh.
   */
  isCountLoadingByEvent: Record<string, boolean>

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
    slotsTakenByEvent: {},
    isCountLoadingByEvent: {},
    isSubmittingBooking: false,
    isLookingUpUser: false,
    error: null,
  }),

  getters: {
    /**
     * Jumlah peserta terdaftar untuk 1 event (exclude yang 'Tidak Hadir'
     * supaya konsisten dengan konsep "slot taken").
     *
     * Sumber preferensi: `slotsTakenByEvent` (cache count, ringan).
     * Fallback: derive dari `participantsByEvent` (untuk halaman detail
     * yang sudah punya list peserta di memori).
     * Return `null` jika belum ada data sama sekali — UI bisa render
     * skeleton / placeholder, BUKAN 0, supaya tidak misleading.
     */
    getSlotsTakenByEvent(): (eventId: string) => number {
      return (eventId: string) => {
        // Sumber preferensi: `slotsTakenByEvent` (cache count, ringan).
        // Fallback: derive dari `participantsByEvent` (untuk halaman detail
        // yang sudah punya list peserta di memori).
        if (eventId in this.slotsTakenByEvent) {
          return this.slotsTakenByEvent[eventId]
        }
        const list = this.participantsByEvent[eventId]
        if (list) {
          return list.filter((r) => r.status !== 'Tidak Hadir').length
        }
        // Belum ada data sama sekali — return 0 sebagai default supaya
        // UI konsisten. Untuk membedakan "belum load" vs "0 peserta",
        // pakai getter `isCountLoadingByEvent` di template (animasi
        // spinner / skeleton). Tidak return null karena itu akan
        // memaksa setiap konsumen menambahkan null-check & placeholder
        // yang mudah lupa dipasang.
        return 0
      }
    },

    /**
     * Slot tersisa (untuk badge / Disabled state form booking).
     * Return null kalau quota event atau count belum tersedia — UI
     * bisa tampilkan placeholder, bukan angka palsu.
     */
    getSlotsRemainingByEvent(): (eventId: string, quota: number) => number {
      return (eventId: string, quota: number) => {
        return Math.max(0, quota - this.getSlotsTakenByEvent(eventId))
      }
    },
  },

  actions: {
    /**
     * Helper internal: set loading state per event (untuk list peserta).
     */
    _setLoading(eventId: string, loading: boolean): void {
      this.isLoadingByEvent[eventId] = loading
    },

    /**
     * Helper internal: set loading state per event (untuk count ringan).
     */
    _setCountLoading(eventId: string, loading: boolean): void {
      this.isCountLoadingByEvent[eventId] = loading
    },

    /**
     * Ambil list peserta untuk 1 event dari Supabase. Cache ke
     * `participantsByEvent[eventId]` agar re-render tidak trigger refetch.
     *
     * Catatan: catch block TIDAK me-reset cache ke `[]` lagi. Kalau
     * ada data sebelumnya (mis. dari fetch lain yang berhasil), data
     * itu dipertahankan dan tidak diganti dengan []. Hanya `error`
     * yang di-set agar UI bisa menampilkan alert.
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
        // Jangan replace cache yang ada dengan []. Kalau ada entry
        // sebelumnya, biarkan. Kalau belum ada, seed dengan [] supaya
        // getter konsisten (tidak undefined).
        if (!(eventId in this.participantsByEvent)) {
          this.participantsByEvent[eventId] = []
        }
      } finally {
        this._setLoading(eventId, false)
      }
    },

    /**
     * Ambil jumlah peserta terdaftar untuk 1 event (slot taken).
     * Query ringan: SELECT count(*) FROM event_registrations WHERE event_id = ?
     * — tanpa JOIN ke event_users.
     *
     * Dipakai oleh halaman utama (EventCard) untuk badge "X/Y Terisi".
     * Tidak me-replace `participantsByEvent` (data full tetap di fetch
     * terpisah oleh halaman detail / dashboard).
     *
     * Aman terhadap error: kalau request gagal, cache count yang sudah
     * ada TIDAK dihapus, supaya counter tidak "tiba-tiba jadi 0" setiap
     * kali ada error jaringan / Supabase.
     */
    async fetchParticipantsCount(eventId: string): Promise<void> {
      if (!eventId) return
      this._setCountLoading(eventId, true)
      try {
        const repo = new SupabaseRegistrationRepository()
        const useCase = new GetEventRegistrationsCount(repo)
        const count = await useCase.execute(eventId)
        this.slotsTakenByEvent[eventId] = count
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Gagal memuat jumlah peserta.'
        this.error = message
        // Jangan replace cache yang ada. Hanya seed dengan 0 kalau belum
        // pernah ada entry (mis. pertama kali load & langsung gagal).
        if (!(eventId in this.slotsTakenByEvent)) {
          this.slotsTakenByEvent[eventId] = 0
        }
      } finally {
        this._setCountLoading(eventId, false)
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
     *   2. Validasi event (ada, status Aktif, tanggal belum lewat)
     *   3. Cari / buat user master
     *   4. Cek duplikat (userId, eventId)
     *   5. Insert registrasi
     *   6. Refresh list peserta + count untuk event tersebut
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
        const eventRepo = new SupabaseEventRepository()
        const useCase = new BookEvent(userRepo, regRepo, eventRepo)
        await useCase.execute(input)
        // Refresh cache peserta + count untuk event ini
        await Promise.all([
          this.fetchParticipants(input.eventId),
          this.fetchParticipantsCount(input.eventId),
        ])
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
     *
     * Setelah update, re-fetch count supaya counter EventCard ikut
     * akurat (kalau user di-toggle ke "Tidak Hadir", slot di-release).
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
        // Sinkronkan count cache (slot di-release kalau status = "Tidak Hadir").
        await this.fetchParticipantsCount(eventId)
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
      delete this.slotsTakenByEvent[eventId]
      delete this.isCountLoadingByEvent[eventId]
    },
  },
})
