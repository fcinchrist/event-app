import type {
  Registration,
  RegistrationInput,
  RegistrationStatus,
  RegistrationWithEvent,
  RegistrationWithUser,
} from '~/domain/entities/registration'
import type {
  RegistrationListParams,
  RegistrationRepository,
} from '~/domain/repositories/registration-repository'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import {
  mapRegistrationRow,
  tryMapRegistrationWithEventRow,
  tryMapRegistrationWithUserRow,
} from '~/infrastructure/mappers/registration-mapper'
import { generateUniqueId } from '~/application/use-cases/generate-id'

/** Cap for the "events followed by a user" panel. 100 historical events per user is well beyond what the master user view ever needs. */
const MAX_REGISTRATIONS_PER_USER = 100

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
}
