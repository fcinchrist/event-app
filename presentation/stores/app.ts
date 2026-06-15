import { defineStore } from 'pinia'
import type { Event } from '~/domain/entities/event'
import type { Booking, BookingFormData } from '~/domain/entities/booking'
import type { FilterPeriode, AppRole, EventStatus, BookingStatus } from '~/types/common'
import type { AuthUser } from '~/domain/repositories/auth-repository'
import { SupabaseAuthRepository } from '~/infrastructure/repositories/supabase-auth-repository'
import { SupabaseEventRepository } from '~/infrastructure/repositories/supabase-event-repository'
import { GetEvents } from '~/application/use-cases/get-events'
import { LoginUser } from '~/application/use-cases/login-user'
import { LogoutUser } from '~/application/use-cases/logout-user'
import { RequestPasswordReset } from '~/application/use-cases/request-password-reset'
import { UpdatePassword } from '~/application/use-cases/update-password'

interface AppState {
  role: AppRole
  authUser: AuthUser | null
  selectedEvent: Event | null
  filterPeriode: FilterPeriode
  filterTanggal: string
  // Optional category filter. `null` = no category filter applied
  // (show events regardless of category, including those with no
  // category). This is set by the public homepage's category pill row.
  filterCategoryId: string | null
  page: number
  perPage: number
  events: Event[]
  bookings: Booking[]
  bookingForm: BookingFormData
  attendanceFormBookingId: string
  showAddEventModal: boolean
  newEventForm: {
    title: string
    date: string
    quota: number
    location: string
    image: string
    description: string
  }
  isLoading: boolean
  error: string | null
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    role: 'member',
    authUser: null,
    selectedEvent: null,
    filterPeriode: 'all',
    filterTanggal: '',
    filterCategoryId: null,
    // Current page on the public UI. Pagination is server-side: see
    // `fetchEvents` → `repo.range()`, so each next/prev click triggers
    // a fresh request.
    page: 1,
    // Per-page size of the public UI. Server-side paginated.
    perPage: 9,
    events: [],
    // Bookings start empty: there is no `event_registrations` table in
    // Supabase yet. When that table is added, swap `fetchBookings()` for
    // the real implementation (same pattern as events).
    bookings: [],
    bookingForm: { name: '', wa: '' },
    attendanceFormBookingId: '',
    showAddEventModal: false,
    newEventForm: {
      title: '',
      date: '',
      quota: 50,
      location: '',
      image: '',
      description: '',
    },
    isLoading: true,
    error: null,
  }),

  getters: {
    isAdminLoggedIn(): boolean {
      return this.authUser !== null && this.role === 'admin'
    },

    filteredEvents(): Event[] {
      const todayStr = new Date().toISOString().slice(0, 10)
      return this.events.filter((e: Event) => {
        const eventStr = e.date.slice(0, 10)

        // Category filter (independent of the date/period filter).
        // `null` means "no category filter" → pass every event.
        if (this.filterCategoryId !== null && e.categoryId !== this.filterCategoryId) {
          return false
        }

        if (this.filterPeriode === 'custom' && this.filterTanggal) {
          return eventStr === this.filterTanggal
        }
        if (this.filterPeriode === 'aktif') {
          return new Date(eventStr) > new Date(todayStr)
        }
        if (this.filterPeriode === 'hari-h') {
          return todayStr === eventStr
        }
        if (this.filterPeriode === 'lampau') {
          return new Date(eventStr) < new Date(todayStr) && todayStr !== eventStr
        }
        return true
      })
    },

    paginatedEvents(): Event[] {
      const start = (this.page - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredEvents.slice(start, end)
    },

    totalPage(): number {
      return Math.ceil(this.filteredEvents.length / this.perPage) || 1
    },

    bookingsForSelectedEvent(): Booking[] {
      if (!this.selectedEvent) return []
      return this.bookings.filter((b: Booking) => b.eventId === this.selectedEvent!.id)
    },
  },

  actions: {
    /**
     * Ambil daftar event dari Supabase (bukan dari hardcode / localStorage).
     * Dipanggil saat layout mount, dan dipakai juga oleh halaman utama (`/`).
     */
    async fetchEvents(): Promise<void> {
      this.isLoading = true
      this.error = null
      try {
        const repo = new SupabaseEventRepository()
        const useCase = new GetEvents(repo)
        // Fetch a large window from Supabase (server-side range) so the
        // public UI's 9-per-page pagination can reach many events. The
        // period filter (All / Upcoming / Today / Past / custom date) is
        // applied client-side (see the `filteredEvents` getter) for
        // instant UX without a round-trip. The backend currently only
        // supports `search`. Note: the use case cap is 20 — raise it
        // when the event list grows.
        const result = await useCase.execute({ page: 1, limit: 100 })
        this.events = result.data
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memuat event.'
        this.error = message
      } finally {
        this.isLoading = false
      }
    },

    setSelectedEventById(eventId: string): void {
      const event = this.events.find((e: Event) => e.id === eventId) || null
      this.selectedEvent = event
      this.bookingForm = { name: '', wa: '' }
      this.attendanceFormBookingId = ''
    },

    clearSelectedEvent(): void {
      this.selectedEvent = null
      this.bookingForm = { name: '', wa: '' }
      this.attendanceFormBookingId = ''
    },

    getEventStatusBadge(eventDateStr: string): EventStatus {
      const todayStr = new Date().toISOString().slice(0, 10)
      const eventStr = eventDateStr.slice(0, 10)
      if (todayStr === eventStr) return 'Hari H Kegiatan'
      if (new Date(eventStr) > new Date(todayStr)) return 'Akan Datang'
      return 'Selesai / Lampau'
    },

    isHariH(eventDateStr: string): boolean {
      const todayStr = new Date().toISOString().slice(0, 10)
      const eventStr = eventDateStr.slice(0, 10)
      return todayStr === eventStr
    },

    getSlotsTaken(eventId: string): number {
      return this.bookings.filter((b: Booking) => b.eventId === eventId).length
    },

    maskPhoneNumber(wa: string): string {
      if (!wa) return ''
      return wa.slice(0, 4) + '****' + wa.slice(-2)
    },

    /**
     * Booking belum didukung karena tabel `event_registrations` belum ada
     * di Supabase. Method ini sengaja mengembalikan pesan error agar UI
     * form tidak diam-diam menyimpan ke localStorage.
     */
    submitBooking(): string | null {
      if (!this.bookingForm.name || !this.bookingForm.wa) {
        return 'Harap masukkan Nama Lengkap & Nomor WhatsApp aktif Anda.'
      }
      return 'Fitur booking online belum tersedia. Silakan hubungi panitia untuk reservasi manual.'
    },

    /**
     * Sama dengan submitBooking: absensi online belum didukung karena
     * tidak ada tabel attendance di Supabase.
     */
    submitAttendanceCheck(): string | null {
      return 'Absensi online belum tersedia. Panitia akan melakukan check-in di lokasi acara.'
    },

    openAddEventModal(): void {
      this.newEventForm = {
        title: '',
        date: '',
        quota: 50,
        location: '',
        image: '',
        description: '',
      }
      this.showAddEventModal = true
    },

    /**
     * Tidak menulis ke localStorage lagi — untuk membuat event baru,
     * admin harus login dan tambah lewat dashboard (`/dashboard/events`).
     * Method ini hanya dipakai oleh UI lama yang akan di-deprecate.
     */
    submitNewEvent(): string | null {
      return 'Silakan login sebagai admin dan tambah event dari halaman Dashboard / Kelola Event.'
    },

    deleteEvent(_eventId: string): void {
      // Delegated to the dashboard store, which talks to Supabase.
    },

    cancelBooking(_bookingId: string): void {
      // No-op: bookings aren't persisted in the DB yet.
    },

    setFilter(periode: FilterPeriode): void {
      this.filterPeriode = periode
      this.filterTanggal = ''
      this.page = 1
    },

    setDateFilter(date: string): void {
      this.filterTanggal = date
      this.filterPeriode = 'custom'
      this.page = 1
    },

    clearDateFilter(): void {
      this.filterTanggal = ''
      this.filterPeriode = 'all'
      this.page = 1
    },

    /**
     * Set (or clear) the public homepage's category filter.
     * `null` resets the filter. Resets the page cursor so the user
     * lands on the first page of the new result set.
     */
    setCategoryFilter(categoryId: string | null): void {
      this.filterCategoryId = categoryId
      this.page = 1
    },

    setRole(role: AppRole): void {
      this.role = role
      if (role === 'member') {
        this.showAddEventModal = false
      }
    },

    async initAuth(): Promise<void> {
      try {
        const repo = new SupabaseAuthRepository()
        const user = await repo.getCurrentUser()
        if (user) {
          this.authUser = user
          this.role = 'admin'
        } else {
          this.authUser = null
          this.role = 'member'
        }
      } catch {
        this.authUser = null
        this.role = 'member'
      }
    },

    async loginAdmin(email: string, password: string): Promise<string | null> {
      try {
        const repo = new SupabaseAuthRepository()
        const loginUseCase = new LoginUser(repo)
        const result = await loginUseCase.execute(email, password)
        if (result.success && result.user) {
          this.authUser = result.user
          this.role = 'admin'
          return null
        }
        return result.error ?? 'Login gagal.'
      } catch {
        return 'Gagal terhubung ke server. Periksa koneksi Anda.'
      }
    },

    async adminLogout(): Promise<void> {
      try {
        const repo = new SupabaseAuthRepository()
        const logoutUseCase = new LogoutUser(repo)
        await logoutUseCase.execute()
      } catch {
        // proceed with local logout even if server call fails
      }
      this.authUser = null
      this.role = 'member'
      this.showAddEventModal = false
    },

    async requestPasswordReset(email: string): Promise<string | null> {
      try {
        const repo = new SupabaseAuthRepository()
        const useCase = new RequestPasswordReset(repo)
        const redirectTo = `${window.location.origin}/admin/reset-password`
        const result = await useCase.execute(email, redirectTo)
        if (result.success) return null
        return result.error ?? 'Gagal mengirim email reset.'
      } catch {
        return 'Gagal terhubung ke server.'
      }
    },

    async updatePassword(newPassword: string, confirmPassword: string): Promise<string | null> {
      try {
        const repo = new SupabaseAuthRepository()
        const useCase = new UpdatePassword(repo)
        const result = await useCase.execute(newPassword, confirmPassword)
        if (result.success) return null
        return result.error ?? 'Gagal memperbarui password.'
      } catch {
        return 'Gagal terhubung ke server.'
      }
    },

    formatDate(isoString: string): string {
      if (!isoString) return ''
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
      return new Date(isoString).toLocaleDateString('id-ID', options)
    },
  },
})
