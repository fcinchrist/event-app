import type {
  Registration,
  RegistrationInput,
  RegistrationStatus,
  RegistrationWithEvent,
  RegistrationWithUser,
} from '~/domain/entities/registration'
import type {
  AttendancePeriod,
  AttendanceSummary,
  RegistrationListParams,
  RegistrationRepository,
  RegistrationWithUserAndEvent,
} from '~/domain/repositories/registration-repository'
import type { EventUser } from '~/domain/entities/event-user'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import {
  mapRegistrationRow,
  tryMapRegistrationWithEventRow,
  tryMapRegistrationWithUserRow,
} from '~/infrastructure/mappers/registration-mapper'
import { mapEventRow, type EventRow } from '~/infrastructure/mappers/event-mapper'
import { mapUserRow } from '~/infrastructure/mappers/user-mapper'
import { generateUniqueId } from '~/application/use-cases/generate-id'

/** Cap for the "events followed by a user" panel. 100 historical events per user is well beyond what the master user view ever needs. */
const MAX_REGISTRATIONS_PER_USER = 100

/**
 * Cap for the per-user attendance aggregation. The dashboard needs
 * to show as many active members as possible; 1000 users is more than
 * enough for the typical komunitas use case while still keeping the
 * payload reasonable.
 */
const MAX_ATTENDANCE_USERS = 1000

export class SupabaseRegistrationRepository implements RegistrationRepository {
  async getAll(
    params?: RegistrationListParams,
  ): Promise<RegistrationWithUser[]> {
    const supabase = useSupabaseClient()
    let query = supabase
      .from('event_registrations')
      .select('*, user:event_users(*)')
      .order('registered_at', { ascending: false })

    if (params?.eventId) {
      query = query.eq('event_id', params.eventId)
    }
    if (params?.userId) {
      query = query.eq('user_id', params.userId)
    }
    if (params?.status) {
      query = query.eq('status', params.status)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows: unknown[] = Array.isArray(data) ? data : []
    // `tryMapRegistrationWithUserRow` may legitimately return null for
    // orphaned/invalid rows. Strip them so the caller never sees a
    // half-broken list and the home page counter never silently drops to 0.
    return rows
      .map((r) => tryMapRegistrationWithUserRow(r))
      .filter((r): r is RegistrationWithUser => r !== null)
  }

  async getById(id: string): Promise<Registration | null> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }
    if (!data) return null

    return mapRegistrationRow(data)
  }

  async findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Registration | null> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }
    if (!data) return null

    return mapRegistrationRow(data)
  }

  async create(input: RegistrationInput): Promise<Registration> {
    const supabase = useSupabaseClient()

    const id = await generateUniqueId('REG', async (candidate: string) => {
      const { data } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('id', candidate)
        .maybeSingle()
      return data !== null
    })

    const { data, error } = await supabase
      .from('event_registrations')
      .insert({
        id,
        user_id: input.userId,
        event_id: input.eventId,
        status: 'Terdaftar',
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Anda sudah terdaftar di event ini.')
      }
      throw new Error(error.message)
    }

    return mapRegistrationRow(data)
  }

  async updateStatus(
    id: string,
    status: RegistrationStatus,
  ): Promise<Registration> {
    const supabase = useSupabaseClient()

    const patch: Record<string, unknown> = { status }
    if (status === 'Hadir') {
      patch.checkin_at = new Date().toISOString()
    } else if (status === 'Terdaftar') {
      patch.checkin_at = null
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return mapRegistrationRow(data)
  }

  async delete(id: string): Promise<void> {
    const supabase = useSupabaseClient()
    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }
  }

  async countByEvent(eventId: string): Promise<number> {
    const supabase = useSupabaseClient()
    const { count, error } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)

    if (error) {
      throw new Error(error.message)
    }
    return count ?? 0
  }

  async listByUserWithEvent(
    userId: string,
  ): Promise<RegistrationWithEvent[]> {
    const supabase = useSupabaseClient()

    // PostgREST cannot order embedded relations, so we sort manually
    // by `event.date` desc with `registered_at` as tie-breaker.
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*, event:events(*)')
      .eq('user_id', userId)
      .limit(MAX_REGISTRATIONS_PER_USER)

    if (error) {
      throw new Error(error.message)
    }

    const rows: unknown[] = Array.isArray(data) ? data : []
    const mapped = rows
      .map((r) => tryMapRegistrationWithEventRow(r))
      .filter((r): r is RegistrationWithEvent => r !== null)

    mapped.sort((a, b) => {
      const dateA = new Date(a.event.date).getTime()
      const dateB = new Date(b.event.date).getTime()
      if (dateA !== dateB) return dateB - dateA
      return (
        new Date(b.registeredAt).getTime() -
        new Date(a.registeredAt).getTime()
      )
    })

    return mapped
  }

  async getAttendanceByUser(
    period: AttendancePeriod,
  ): Promise<AttendanceSummary[]> {
    const supabase = useSupabaseClient()

    // Approach: SELECT join event_registrations -> events + user
    // then aggregate in JS. We do this client-side (not via RPC) so the
    // implementation does not depend on a custom Postgres function being
    // deployed. The result set is bounded by MAX_ATTENDANCE_USERS rows
    // of registrations, which is well under Supabase's default 1000 row
    // limit. For most komunitas use cases this is more than enough.
    let query = supabase
      .from('event_registrations')
      .select('user_id, status, event:events(date), user:event_users(*)')
      .limit(MAX_ATTENDANCE_USERS * 5) // bound the raw rows; aggregate collapses to 1 row per user

    if (period.kind === 'day' && period.date) {
      // Filter by `event.date` (timestamptz). PostgREST range filter
      // on a nested relation isn't supported in a single query, so we
      // pull a wider window and filter in JS below.
    }

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    type Row = {
      user_id: string
      status: RegistrationStatus
      event: { date: string } | null
      user: EventUser | { id: string; no_hp: string; nama: string } | null
    }
    const rows: unknown[] = Array.isArray(data) ? data : []
    const safeRows: Row[] = rows
      .map((r): Row | null => {
        if (r === null || typeof r !== 'object') return null
        const v = r as Record<string, unknown>
        if (typeof v.user_id !== 'string') return null
        if (typeof v.status !== 'string') return null
        const event = v.event
        if (event === null || typeof event !== 'object') return null
        const ev = event as Record<string, unknown>
        if (typeof ev.date !== 'string') return null
        const user = v.user
        if (user === null || typeof user !== 'object') return null
        return {
          user_id: v.user_id,
          status: v.status as RegistrationStatus,
          event: { date: ev.date },
          user: user as Row['user'],
        }
      })
      .filter((r): r is Row => r !== null)

    // Filter by period on the event.date (slice YYYY-MM-DD prefix).
    const filtered = safeRows.filter((r): r is Row & { event: { date: string } } => {
      if (r.event === null) return false
      const eventDate = r.event.date.slice(0, 10)
      if (period.kind === 'all') return true
      if (period.kind === 'day') return eventDate === period.date
      // year
      return eventDate.startsWith(`${period.year}-`)
    })

    // Aggregate per user: count Hadir + total registrations.
    interface Acc {
      user: EventUser | null
      totalHadir: number
      totalRegistrasi: number
    }
    const acc = new Map<string, Acc>()
    for (const r of filtered) {
      const existing = acc.get(r.user_id) ?? {
        user: null,
        totalHadir: 0,
        totalRegistrasi: 0,
      }
      existing.totalRegistrasi += 1
      if (r.status === 'Hadir') existing.totalHadir += 1
      // Hydrate user from the row (only once is enough).
      if (existing.user === null && r.user) {
        try {
          existing.user = mapUserRow(r.user)
        } catch {
          // Skip rows with malformed user — they won't be returned.
        }
      }
      acc.set(r.user_id, existing)
    }

    const summaries: AttendanceSummary[] = []
    for (const v of acc.values()) {
      if (v.user === null) continue
      summaries.push({
        user: v.user,
        totalHadir: v.totalHadir,
        totalRegistrasi: v.totalRegistrasi,
      })
    }

    // Default sort: totalHadir DESC, then nama ASC for stable display.
    summaries.sort((a, b) => {
      if (b.totalHadir !== a.totalHadir) return b.totalHadir - a.totalHadir
      return a.user.nama.localeCompare(b.user.nama, 'id')
    })

    return summaries.slice(0, MAX_ATTENDANCE_USERS)
  }

  async listWithEventByPeriod(
    period: AttendancePeriod,
  ): Promise<RegistrationWithUserAndEvent[]> {
    const supabase = useSupabaseClient()

    // Cap rows so we don't accidentally pull a huge payload for the
    // "all" case. 5000 should be more than enough for the komunitas
    // use case; can be tuned later.
    const HARD_LIMIT = 5000

    let query = supabase
      .from('event_registrations')
      .select('*, user:event_users(*), event:events(*)')
      .order('registered_at', { ascending: false })
      .limit(HARD_LIMIT)

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    const rows: unknown[] = Array.isArray(data) ? data : []
    const mapped = rows
      .map((r): RegistrationWithUserAndEvent | null => {
        if (r === null || typeof r !== 'object') return null
        const v = r as Record<string, unknown>
        // Strip rows that don't have a hydrated user or event.
        if (!v.user) return null
        if (!v.event) return null
        try {
          const base = mapRegistrationRow(r)
          return {
            ...base,
            user: mapUserRow(v.user),
            event: mapEventRow(v.event),
          }
        } catch {
          return null
        }
      })
      .filter((r): r is RegistrationWithUserAndEvent => r !== null)

    // Apply period filter on the event.date (slice YYYY-MM-DD prefix).
    const eventDateKey = (iso: string): string => iso.slice(0, 10)
    return mapped.filter((r) => {
      const d = eventDateKey(r.event.date)
      if (period.kind === 'all') return true
      if (period.kind === 'day') return d === period.date
      return d.startsWith(`${period.year}-`)
    })
  }
}
