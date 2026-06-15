import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type {
  UserListParams,
  UserRepository,
  UserStats,
} from '~/domain/repositories/user-repository'
import type { PaginatedResult } from '~/types/pagination'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import { tryMapUserRow, mapUserRow } from '~/infrastructure/mappers/user-mapper'
import { generateUniqueId } from '~/application/use-cases/generate-id'

// Same cap as the event list to keep queries consistent and protect
// Supabase from registration spikes.
const MAX_USER_LIMIT = 100

export class SupabaseUserRepository implements UserRepository {
  async findByPhone(noHp: string): Promise<EventUser | null> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('event_users')
      .select('*')
      .eq('no_hp', noHp)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }
    return tryMapUserRow(data)
  }

  async findById(id: string): Promise<EventUser | null> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('event_users')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }
    return tryMapUserRow(data)
  }

  async create(input: EventUserFormData): Promise<EventUser> {
    const supabase = useSupabaseClient()

    // Generate 'USR-YYYY-NNNNN' with retry until unique.
    const id = await generateUniqueId('USR', async (candidate) => {
      const { data } = await supabase
        .from('event_users')
        .select('id')
        .eq('id', candidate)
        .maybeSingle()
      return data !== null
    })

    const { data, error } = await supabase
      .from('event_users')
      .insert({
        id,
        no_hp: input.noHp,
        nama: input.nama,
      })
      .select('*')
      .single()

    if (error) {
      // 23505 = unique_violation (duplicate no_hp)
      if (error.code === '23505') {
        throw new Error('Nomor HP ini sudah terdaftar di sistem.')
      }
      throw new Error(error.message)
    }
    return tryMapUserRow(data) as EventUser
  }

  async getStats(id: string): Promise<UserStats> {
    const supabase = useSupabaseClient()

    // totalRegistered counts every row regardless of status so the
    // "how many events has this user ever joined" number stays accurate.
    const { count: totalRegistered, error: err1 } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)

    if (err1) {
      throw new Error(err1.message)
    }

    const { count: totalAttended, error: err2 } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('status', 'Hadir')

    if (err2) {
      throw new Error(err2.message)
    }

    return {
      totalRegistered: totalRegistered ?? 0,
      totalAttended: totalAttended ?? 0,
    }
  }

  /**
   * Lists users with server-side pagination + search.
   * - `order('created_at', { ascending: false })` puts newest users first.
   * - Search uses ILIKE on `nama` OR `no_hp`.
   * - `count: 'exact'` is required for accurate pagination meta.
   */
  async listUsers(params: UserListParams): Promise<PaginatedResult<EventUser>> {
    const supabase = useSupabaseClient()
    const page = Math.max(1, params.page)
    const limit = Math.min(MAX_USER_LIMIT, Math.max(1, params.limit))
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('event_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.search && params.search.trim()) {
      const term = params.search.trim()
      query = query.or(`nama.ilike.%${term}%,no_hp.ilike.%${term}%`)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows: unknown[] = Array.isArray(data) ? data : []
    const users: EventUser[] = rows.map((row) => mapUserRow(row))

    const total = typeof count === 'number' ? count : users.length
    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  }
}
