import { defineStore } from 'pinia'
import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type { RegistrationWithEvent } from '~/domain/entities/registration'
import type { PaginatedResult } from '~/types/pagination'
import type {
  CategoryAttendanceStat,
  UserListParams,
  UserRepository,
  UserStats,
} from '~/domain/repositories/user-repository'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'
import { SupabaseUserRepository } from '~/infrastructure/repositories/supabase-user-repository'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'
import { ListUsers } from '~/application/use-cases/list-users'
import { GetUserRegistrations } from '~/application/use-cases/get-user-registrations'
import { RegisterUser } from '~/application/use-cases/register-user'
import { UpdateUser } from '~/application/use-cases/update-user'
import { DeleteUser } from '~/application/use-cases/delete-user'
import { GetUserAttendanceByCategory } from '~/application/use-cases/get-user-attendance-by-category'
import { GetUserRegistrationYears } from '~/application/use-cases/get-user-registration-years'

interface UserState {
  // Master user list
  users: EventUser[]
  totalUsers: number
  isLoadingList: boolean
  listError: string | null

  // Selected user detail
  selectedUser: EventUser | null
  selectedUserStats: UserStats | null
  selectedUserRegistrations: RegistrationWithEvent[]
  isLoadingDetail: boolean
  detailError: string | null

  // Per-category attendance (detail page)
  attendanceByCategory: CategoryAttendanceStat[]
  attendanceYears: number[]
  /** null = lifetime (semua tahun) */
  selectedAttendanceYear: number | null
  isLoadingAttendance: boolean
  attendanceError: string | null

  // Mutations (add / update / delete)
  isSubmitting: boolean
  mutationError: string | null

  // Search & pagination
  search: string
  page: number
  perPage: number
}

const userRepository: UserRepository = new SupabaseUserRepository()
const registrationRepository: RegistrationRepository =
  new SupabaseRegistrationRepository()

const listUsersUseCase = new ListUsers(userRepository)
const getUserRegistrationsUseCase = new GetUserRegistrations(
  registrationRepository,
)
const registerUserUseCase = new RegisterUser(userRepository)
const updateUserUseCase = new UpdateUser(userRepository)
const deleteUserUseCase = new DeleteUser(userRepository)
const getUserAttendanceByCategoryUseCase = new GetUserAttendanceByCategory(
  userRepository,
)
const getUserRegistrationYearsUseCase = new GetUserRegistrationYears(
  userRepository,
)

/**
 * Standard return shape for `addUser` / `updateUser` / `deleteUser`.
 * Memudahkan caller di komponen Vue (modal) untuk menentukan
 * alur "close + toast" vs "tampilkan error".
 */
export interface UserMutationResult {
  success: boolean
  user: EventUser | null
  error: string | null
}

/** Pinia store for the admin Master User pages: list with pagination/search and per-user detail (profile + stats + joined events). */
export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    users: [],
    totalUsers: 0,
    isLoadingList: false,
    listError: null,

    selectedUser: null,
    selectedUserStats: null,
    selectedUserRegistrations: [],
    isLoadingDetail: false,
    detailError: null,

    attendanceByCategory: [],
    attendanceYears: [],
    selectedAttendanceYear: null,
    isLoadingAttendance: false,
    attendanceError: null,

    isSubmitting: false,
    mutationError: null,

    search: '',
    page: 1,
    perPage: 9,
  }),

  getters: {
    totalPages: (state) =>
      state.perPage > 0
        ? Math.max(1, Math.ceil(state.totalUsers / state.perPage))
        : 1,
  },

  actions: {
    setSearch(value: string) {
      this.search = value
      this.page = 1
    },

    setPage(page: number) {
      this.page = Math.max(1, page)
    },

    clearList() {
      this.users = []
      this.totalUsers = 0
      this.listError = null
    },

    async fetchUsers(): Promise<void> {
      this.isLoadingList = true
      this.listError = null
      try {
        const params: UserListParams = {
          page: this.page,
          limit: this.perPage,
          search: this.search.trim() || undefined,
        }
        const result: PaginatedResult<EventUser> =
          await listUsersUseCase.execute(params)
        this.users = result.data
        this.totalUsers = result.meta.total
      } catch (err) {
        this.listError =
          err instanceof Error
            ? err.message
            : 'Gagal memuat daftar user.'
        this.users = []
        this.totalUsers = 0
      } finally {
        this.isLoadingList = false
      }
    },

    /**
     * Tambah user baru dari dashboard admin. Setelah berhasil,
     * list di-refresh supaya row baru langsung muncul.
     */
    async addUser(input: EventUserFormData): Promise<UserMutationResult> {
      this.isSubmitting = true
      this.mutationError = null
      try {
        const user = await registerUserUseCase.execute(input)
        // Refresh list (kalau sedang di halaman pertama) supaya row
        // baru langsung muncul di table.
        await this.fetchUsers()
        return { success: true, user, error: null }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal menambahkan user.'
        this.mutationError = message
        return { success: false, user: null, error: message }
      } finally {
        this.isSubmitting = false
      }
    },

    /**
     * Update user existing dari dashboard admin. Setelah berhasil,
     * list di-refresh; kalau user sedang dibuka di detail page,
     * detail di-refresh juga.
     */
    async updateUser(
      id: string,
      input: EventUserFormData,
    ): Promise<UserMutationResult> {
      this.isSubmitting = true
      this.mutationError = null
      try {
        const user = await updateUserUseCase.execute(id, input)
        await this.fetchUsers()
        if (this.selectedUser && this.selectedUser.id === id) {
          this.selectedUser = user
        }
        return { success: true, user, error: null }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal memperbarui user.'
        this.mutationError = message
        return { success: false, user: null, error: message }
      } finally {
        this.isSubmitting = false
      }
    },

    /**
     * Hapus user. Setelah berhasil, list di-refresh dan, kalau user
     * yang dihapus sedang dibuka di detail page, state detail di-clear.
     */
    async deleteUser(id: string): Promise<UserMutationResult> {
      this.isSubmitting = true
      this.mutationError = null
      try {
        await deleteUserUseCase.execute(id)
        await this.fetchUsers()
        if (this.selectedUser && this.selectedUser.id === id) {
          this.clearDetail()
        }
        return { success: true, user: null, error: null }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal menghapus user.'
        this.mutationError = message
        return { success: false, user: null, error: message }
      } finally {
        this.isSubmitting = false
      }
    },

    clearDetail() {
      this.selectedUser = null
      this.selectedUserStats = null
      this.selectedUserRegistrations = []
      this.detailError = null
      this.attendanceByCategory = []
      this.attendanceYears = []
      this.selectedAttendanceYear = null
      this.attendanceError = null
    },

    /** Loads a single user with stats + their registered events. */
    async fetchUserDetail(userId: string): Promise<void> {
      this.isLoadingDetail = true
      this.detailError = null
      try {
        const [user, stats, registrations] = await Promise.all([
          userRepository.findById(userId),
          userRepository.getStats(userId),
          getUserRegistrationsUseCase.execute(userId),
        ])

        if (!user) {
          this.detailError = 'User tidak ditemukan.'
          this.selectedUser = null
          this.selectedUserStats = null
          this.selectedUserRegistrations = []
          return
        }

        this.selectedUser = user
        this.selectedUserStats = stats
        this.selectedUserRegistrations = registrations
      } catch (err) {
        this.detailError =
          err instanceof Error
            ? err.message
            : 'Gagal memuat detail user.'
        this.selectedUser = null
        this.selectedUserStats = null
        this.selectedUserRegistrations = []
      } finally {
        this.isLoadingDetail = false
      }
    },

    /**
     * Set year filter untuk section "Tingkat Kehadiran per Kategori".
     * `null` = seluruh tahun (lifetime).
     */
    setAttendanceYear(year: number | null) {
      this.selectedAttendanceYear = year
    },

    /**
     * Ambil daftar tahun yang pernah diikuti user (untuk pill filter).
     * Tidak auto-refresh setelahnya — biarkan caller yang memutuskan
     * kapan fetch stats berdasarkan tahun.
     */
    async fetchUserRegistrationYears(userId: string): Promise<void> {
      try {
        const years = await getUserRegistrationYearsUseCase.execute(userId)
        this.attendanceYears = years
        // Default ke tahun terbaru (atau null jika tidak ada data).
        if (years.length > 0 && this.selectedAttendanceYear === null) {
          this.selectedAttendanceYear = years[0] ?? null
        }
      } catch (err) {
        this.attendanceError =
          err instanceof Error
            ? err.message
            : 'Gagal memuat daftar tahun.'
      }
    },

    /**
     * Ambil statistik kehadiran per-kategori untuk user, di-filter
     * oleh `selectedAttendanceYear` (null = lifetime).
     */
    async fetchUserAttendanceByCategory(userId: string): Promise<void> {
      this.isLoadingAttendance = true
      this.attendanceError = null
      try {
        const stats = await getUserAttendanceByCategoryUseCase.execute(
          userId,
          this.selectedAttendanceYear,
        )
        this.attendanceByCategory = stats
      } catch (err) {
        this.attendanceError =
          err instanceof Error
            ? err.message
            : 'Gagal memuat statistik kehadiran.'
        this.attendanceByCategory = []
      } finally {
        this.isLoadingAttendance = false
      }
    },
  },
})
