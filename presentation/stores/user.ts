import { defineStore } from 'pinia'
import type { EventUser } from '~/domain/entities/event-user'
import type { RegistrationWithEvent } from '~/domain/entities/registration'
import type { PaginatedResult } from '~/types/pagination'
import type {
  UserListParams,
  UserRepository,
  UserStats,
} from '~/domain/repositories/user-repository'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'
import { SupabaseUserRepository } from '~/infrastructure/repositories/supabase-user-repository'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'
import { ListUsers } from '~/application/use-cases/list-users'
import { GetUserRegistrations } from '~/application/use-cases/get-user-registrations'

interface UserState {
  // Daftar user (master list)
  users: EventUser[]
  totalUsers: number
  isLoadingList: boolean
  listError: string | null

  // Detail user
  selectedUser: EventUser | null
  selectedUserStats: UserStats | null
  selectedUserRegistrations: RegistrationWithEvent[]
  isLoadingDetail: boolean
  detailError: string | null

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

/**
 * Store khusus halaman Master User (admin). Mengelola:
 * - List user + pagination + search
 * - Detail user (profile + stats + event yang pernah diikuti)
 *
 * Di-instansiasi per-store Pinia (tidak singleton global) sehingga
 * halaman detail tidak saling menabrak state.
 */
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

    clearDetail() {
      this.selectedUser = null
      this.selectedUserStats = null
      this.selectedUserRegistrations = []
      this.detailError = null
    },

    /**
     * Load 1 user lengkap dengan stats + list event. Dipakai oleh
     * halaman detail Master User.
     */
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
  },
})
