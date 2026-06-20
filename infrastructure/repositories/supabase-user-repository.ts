import type {
  EventUser,
  EventUserFormData,
  EventUserPublicSummary,
} from '~/domain/entities/event-user'
import type {
  CategoryAttendanceStat,
  UserListParams,
  UserRepository,
  UserStats,
} from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'
import { buildIlikePattern } from '~/utils/sql-like'
import type { PaginatedResult } from '~/types/pagination'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import { generateUniqueId } from '~/application/use-cases/generate-id'
import { mapUserRow } from '~/infrastructure/mappers/user-mapper'

export class SupabaseUserRepository implements UserRepository {
  /**
   * Public-safe phone lookup. Returns only `{ id, nama }` via the
   * SECURITY DEFINER RPC from migration 006 — no PII leaks.
   * Used by the public booking form for name autofill.
   */
  async findByPhonePublic(
    noHp: string,
  ): Promise<EventUserPublicSummary | null> {
    const { data, error } = await this.client.rpc(
      'lookup_event_user_by_phone',
      { p_no_hp: noHp },
    )
    if (error) throw error
    if (!data || data.length === 0) return null
    return { id: data[0].id, nama: data[0].nama }
  }

  /**
   * Full lookup used by the booking pipeline (BookEvent). Routed
   * through a SECURITY DEFINER RPC because direct SELECT on
   * `event_users` is now restricted to authenticated admin.
   */
  async findByPhone(noHp: string): Promise<EventUser | null> {
    const { data, error } = await this.client.rpc(
      'find_event_user_by_phone_for_booking',
      { p_no_hp: noHp },
    )
    if (error) throw error
    if (!data || data.length === 0) return null
    return mapUserRow(data[0])
  }

  async findById(id: string): Promise<EventUser | null> {
    const { data, error } = await this.client
      .from('event_users')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? mapUserRow(data) : null
  }

  async create(input: EventUserFormData): Promise<EventUser> {
    const id = await generateUniqueId('USR', async (candidate) => {
      // Use SECURITY DEFINER RPC because anon SELECT on event_users
      // is blocked by RLS (migration 006).
      const { data, error } = await this.client.rpc('id_exists', {
        p_table: 'event_users',
        p_candidate: candidate,
      })
      if (error) throw error
      return data === true
    })

    const phoneNormalized = normalizePhone(input.noHp) ?? input.noHp
    const row = {
      id,
      no_hp: phoneNormalized,
      nama: input.nama,
      user_status: input.userStatus ?? 'active',
      member_type: input.memberType ?? 'internal',
    }

    const { error } = await this.client
      .from('event_users')
      .insert(row)
    if (error) throw error
    // Build the domain object locally — we cannot `.select('*')` after
    // insert because anon has no SELECT grant on this table.
    return mapUserRow({
      id: row.id,
      no_hp: row.no_hp,
      nama: row.nama,
      user_status: row.user_status,
      member_type: row.member_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  async update(id: string, input: EventUserFormData): Promise<EventUser> {
    const phoneNormalized = normalizePhone(input.noHp) ?? input.noHp
    const row: Record<string, unknown> = {
      no_hp: phoneNormalized,
      nama: input.nama,
    }
    if (input.userStatus !== undefined) row.user_status = input.userStatus
    if (input.memberType !== undefined) row.member_type = input.memberType

    const { error } = await this.client
      .from('event_users')
      .update(row)
      .eq('id', id)
    if (error) throw error
    return mapUserRow({
      id,
      no_hp: row.no_hp as string,
      nama: row.nama as string,
      user_status: (row.user_status as string | undefined) ?? 'active',
      member_type: (row.member_type as string | undefined) ?? 'internal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('event_users')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  async getStats(id: string): Promise<UserStats> {
    const { data, error } = await this.client
      .from('event_registrations')
      .select('status')
      .eq('user_id', id)
    if (error) throw error

    let attended = 0
    for (const r of data ?? []) {
      if (r.status === 'Hadir') attended++
    }
    return {
      totalRegistered: (data ?? []).length,
      totalAttended: attended,
    }
  }

  async listUsers(
    params: UserListParams,
  ): Promise<PaginatedResult<EventUser>> {
    const { page = 1, limit = 10, search } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = this.client
      .from('event_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      // Escape SQL LIKE wildcards so user-supplied `%` / `_` are treated
      // as literal characters.
      const escaped = buildIlikePattern(search).slice(1, -1)
      query = query.or(
        `nama.ilike.%${escaped}%,no_hp.ilike.%${escaped}%`,
      )
    }

    const { data, count, error } = await query
    if (error) throw error

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    return {
      data: (data ?? []).map((r) => mapUserRow(r)),
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

  async getStatsByCategory(
    userId: string,
    year: number | null,
  ): Promise<CategoryAttendanceStat[]> {
    let query = this.client
      .from('event_registrations')
      .select(
        'status, events:event_id (date, event_categories:category_id (id, name))',
      )
      .eq('user_id', userId)

    const { data, error } = await query
    if (error) throw error

    type Row = {
      status: string
      events: {
        date: string
        event_categories: { id: string; name: string } | null
      } | null
    }

    const filtered = ((data ?? []) as unknown as Row[]).filter((r) => {
      if (!year) return true
      if (!r.events?.date) return false
      return new Date(r.events.date).getFullYear() === year
    })

    const groups = new Map<
      string,
      { id: string; name: string; total: number; attended: number }
    >()

    for (const r of filtered) {
      const cat = r.events?.event_categories
      const key = cat?.id ?? '__none__'
      const g = groups.get(key) ?? {
        id: cat?.id ?? 'Tanpa Kategori',
        name: cat?.name ?? 'Tanpa Kategori',
        total: 0,
        attended: 0,
      }
      g.total++
      if (r.status === 'Hadir') g.attended++
      groups.set(key, g)
    }

    const result: CategoryAttendanceStat[] = Array.from(
      groups.values(),
    ).map((g) => ({
      categoryId: g.id === 'Tanpa Kategori' ? null : g.id,
      categoryName: g.name,
      totalRegistered: g.total,
      totalAttended: g.attended,
      attendanceRate:
        g.total === 0 ? 0 : Math.round((g.attended / g.total) * 100),
    }))
    result.sort((a, b) => b.totalRegistered - a.totalRegistered)
    return result
  }

  async getRegistrationYears(userId: string): Promise<number[]> {
    const { data, error } = await this.client
      .from('event_registrations')
      .select('events:event_id (date)')
      .eq('user_id', userId)
    if (error) throw error

    type Row = { events: { date: string } | null }
    const years = new Set<number>()
    for (const r of (data ?? []) as unknown as Row[]) {
      if (!r.events?.date) continue
      const yr = new Date(r.events.date).getFullYear()
      if (!Number.isNaN(yr)) years.add(yr)
    }
    return Array.from(years).sort((a, b) => b - a)
  }

  private get client() {
    return useSupabaseClient()
  }
}
