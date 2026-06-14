import type { Event, EventFormData } from '~/domain/entities/event'
import type { EventListParams, EventRepository } from '~/domain/repositories/event-repository'
import type { EventStatusValue } from '~/types/common'
import type { PaginatedResult } from '~/types/pagination'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import { mapEventRow } from '~/infrastructure/mappers/event-mapper'

const EVENTS_BUCKET = 'event-images'
const MAX_BUCKET_LIMIT = 20

export class SupabaseEventRepository implements EventRepository {
  async getAll(params: EventListParams): Promise<PaginatedResult<Event>> {
    const supabase = useSupabaseClient()
    const page = Math.max(1, params.page)
    const limit = Math.min(MAX_BUCKET_LIMIT, Math.max(1, params.limit))
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .order('date', { ascending: true })
      .range(from, to)

    if (params.search && params.search.trim()) {
      const term = params.search.trim()
      query = query.or(`title.ilike.%${term}%,location.ilike.%${term}%`)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows: unknown[] = Array.isArray(data) ? data : []
    const events: Event[] = rows.map((row) => mapEventRow(row))

    const total = typeof count === 'number' ? count : events.length
    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      data: events,
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

  async getById(id: string): Promise<Event | null> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) return null
    return mapEventRow(data)
  }

  async create(payload: EventFormData): Promise<Event> {
    const supabase = useSupabaseClient()

    const dateIso = new Date(payload.date).toISOString()
    const quotaNumber = typeof payload.quota === 'string'
      ? parseInt(payload.quota, 10)
      : payload.quota

    const { data, error } = await supabase
      .from('events')
      .insert({
        title: payload.title.trim(),
        description: (payload.description ?? '').trim(),
        date: dateIso,
        location: payload.location.trim(),
        quota: quotaNumber,
        image: payload.image ?? '',
        status: 'Aktif',
      })
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return mapEventRow(data)
  }

  async delete(id: string): Promise<void> {
    const supabase = useSupabaseClient()
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }
  }

  async uploadImage(file: File): Promise<string> {
    const supabase = useSupabaseClient()

    // Bangun nama file unik: <timestamp>-<random>.<ext>
    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = `events/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(EVENTS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/webp',
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from(EVENTS_BUCKET)
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  async updateStatus(id: string, status: EventStatusValue): Promise<Event> {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return mapEventRow(data)
  }
}
