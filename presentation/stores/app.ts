import { defineStore } from 'pinia'
import type { Event, EventFormData } from '~/domain/entities/event'
import type { Booking, BookingFormData } from '~/domain/entities/booking'
import type { FilterPeriode, AppRole, EventStatus, BookingStatus } from '~/types/common'
import type { AuthUser } from '~/domain/repositories/auth-repository'
import { SupabaseAuthRepository } from '~/infrastructure/repositories/supabase-auth-repository'
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
  page: number
  perPage: number
  events: Event[]
  bookings: Booking[]
  bookingForm: BookingFormData
  attendanceFormBookingId: string
  showAddEventModal: boolean
  newEventForm: EventFormData
  isLoading: boolean
}

const EVENTS_STORAGE_KEY = 'komasync_events_v2'
const BOOKINGS_STORAGE_KEY = 'komasync_bookings_v2'

function getDefaultEvents(): Event[] {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  return [
    {
      id: 'EVT-101',
      title: 'Kopi Darat Komunitas Dev Terbesar 2026',
      description: 'Kumpul santai bulanan membahas arah tren industri, networking antar developer, serta sharing project internal.',
      date: `${today}T19:00`,
      location: 'Jakarta Creative Hub, Thamrin',
      quota: 50,
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600',
      status: 'Aktif',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'EVT-102',
      title: 'Workshop UI/UX Funnel Architecture',
      description: 'Akselerasikan konversi produk digitalmu lewat rancangan visual flow terstruktur dan prototype yang lolos usability testing.',
      date: '2026-07-10T13:00',
      location: 'Greenhouse Co-working Space, Jaksel',
      quota: 15,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=600',
      status: 'Aktif',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'EVT-103',
      title: 'Seminar Cloud Serverless Deployment',
      description: 'Eksplorasi mendalam terkait pemanfaatan arsitektur serverless multi-region untuk memangkas budget operasional infrastruktur cloud korporasi.',
      date: '2026-05-01T10:00',
      location: 'Online via Zoom Meeting',
      quota: 100,
      image: 'https://images.unsplash.com/photo-1591453089816-0fbb971b454c?auto=format&fit=crop&q=80&w=600',
      status: 'Aktif',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function getDefaultBookings(): Booking[] {
  return [
    { id: 'BKG-77123', eventId: 'EVT-101', name: 'Rian Dimas', wa: '08123445566', status: 'Belum Hadir' },
    { id: 'BKG-77124', eventId: 'EVT-101', name: 'Siti Amelia', wa: '08571234567', status: 'Hadir' },
    { id: 'BKG-99211', eventId: 'EVT-102', name: 'Budi Santoso', wa: '08991122334', status: 'Belum Hadir' },
    { id: 'BKG-99212', eventId: 'EVT-102', name: 'Gisella Anastasia', wa: '08215566778', status: 'Belum Hadir' },
    { id: 'BKG-99213', eventId: 'EVT-102', name: 'Arif Rahman', wa: '08138899001', status: 'Belum Hadir' },
  ]
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    role: 'member',
    authUser: null,
    selectedEvent: null,
    filterPeriode: 'all',
    filterTanggal: '',
    page: 1,
    perPage: 6,
    events: [],
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
  }),

  getters: {
    isAdminLoggedIn(): boolean {
      return this.authUser !== null && this.role === 'admin'
    },

    filteredEvents(): Event[] {
      const todayStr = new Date().toISOString().slice(0, 10)
      return this.events.filter((e: Event) => {
        const eventStr = e.date.slice(0, 10)

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
    init(): void {
      this.isLoading = true
      if (import.meta.client) {
        if (!localStorage.getItem(EVENTS_STORAGE_KEY)) {
          localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(getDefaultEvents()))
        }
        if (!localStorage.getItem(BOOKINGS_STORAGE_KEY)) {
          localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(getDefaultBookings()))
        }
        // Simulate loading delay for skeleton demo
        setTimeout(() => {
          this.events = JSON.parse(localStorage.getItem(EVENTS_STORAGE_KEY) || '[]')
          this.bookings = JSON.parse(localStorage.getItem(BOOKINGS_STORAGE_KEY) || '[]')
          this.isLoading = false
        }, 800)
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
      return wa.slice(0, 4) + '****' + wa.slice(-3)
    },

    submitBooking(): string | null {
      if (!this.bookingForm.name || !this.bookingForm.wa) {
        return 'Harap masukkan Nama Lengkap & Nomor WhatsApp aktif Anda.'
      }
      if (!this.selectedEvent) return 'Event tidak ditemukan.'

      if (this.getSlotsTaken(this.selectedEvent.id) >= this.selectedEvent.quota) {
        return 'Maaf, pendaftaran gagal karena kuota event ini sudah penuh.'
      }

      const alreadyRegistered = this.bookings.some(
        (b: Booking) => b.eventId === this.selectedEvent!.id && b.wa.trim() === this.bookingForm.wa.trim()
      )
      if (alreadyRegistered) {
        return 'Nomor WhatsApp ini sudah terdaftar dalam manifes event ini.'
      }

      const newId = 'BKG-' + Math.floor(10000 + Math.random() * 90000)
      const newBooking: Booking = {
        id: newId,
        eventId: this.selectedEvent.id,
        name: this.bookingForm.name,
        wa: this.bookingForm.wa,
        status: 'Belum Hadir',
      }

      this.bookings.push(newBooking)
      if (import.meta.client) {
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(this.bookings))
      }

      this.bookingForm = { name: '', wa: '' }
      return null
    },

    submitAttendanceCheck(): string | null {
      if (!this.attendanceFormBookingId) {
        return 'Silakan pilih nama Anda pada list dropdown terlebih dahulu.'
      }

      const target = this.bookings.find((b: Booking) => b.id === this.attendanceFormBookingId)
      if (target) {
        target.status = 'Hadir'
        if (import.meta.client) {
          localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(this.bookings))
        }
        const name = target.name
        this.attendanceFormBookingId = ''
        return `success:${name}`
      }
      return 'Booking tidak ditemukan.'
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

    submitNewEvent(): string | null {
      const { title, date, location, quota } = this.newEventForm
      if (!title || !date || !location || !quota) {
        return 'Mohon lengkapi kolom Judul, Tanggal, Kuota, dan Lokasi Event.'
      }

      const generatedId = 'EVT-' + Math.floor(200 + Math.random() * 800)
      const fallbackImage = this.newEventForm.image.trim() || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=600'

      const now = new Date().toISOString()
      const newEvent: Event = {
        id: generatedId,
        title,
        description: (this.newEventForm.description as string).trim() || 'Mari bergabung dalam keceriaan agenda rutin bersama keluarga besar Friendship Community.',
        date,
        location,
        quota: parseInt(String(quota)),
        image: fallbackImage,
        status: 'Aktif',
        createdAt: now,
        updatedAt: now,
      }

      this.events.unshift(newEvent)
      if (import.meta.client) {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(this.events))
      }

      this.showAddEventModal = false
      this.page = 1
      return null
    },

    deleteEvent(eventId: string): void {
      this.events = this.events.filter((e: Event) => e.id !== eventId)
      this.bookings = this.bookings.filter((b: Booking) => b.eventId !== eventId)
      if (import.meta.client) {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(this.events))
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(this.bookings))
      }
      if (this.selectedEvent && this.selectedEvent.id === eventId) {
        this.clearSelectedEvent()
      }
    },

    cancelBooking(bookingId: string): void {
      this.bookings = this.bookings.filter((b: Booking) => b.id !== bookingId)
      if (import.meta.client) {
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(this.bookings))
      }
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
