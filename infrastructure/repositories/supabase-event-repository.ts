import type { Event, EventFormData } from '~/domain/entities/event'
import type { EventListParams, EventRepository } from '~/domain/repositories/event-repository'
import type { EventStatusValue } from '~/types/common'
import type { PaginatedResult } from '~/types/pagination'
import { useSupabaseClient } from '~/infrastructure/supabase/client'
import { mapEventRow } from '~/infrastructure/mappers/event-mapper'

const EVENTS_BUCKET = 'event-images'
// Cap for the server-side range query. Bumped from 20 to 100 so the
// public UI (perPage=9) has enough rows to back multi-page pagination
// in a single `fetchEvents()` call. Still capped to protect against
// very large requests.
const MAX_BUCKET_LIMIT = 100

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

  async update(id: string, payload: EventFormData): Promise<Event> {
    const supabase = useSupabaseClient()

    const dateIso = new Date(payload.date).toISOString()
    const quotaNumber = typeof payload.quota === 'string'
      ? parseInt(payload.quota, 10)
      : payload.quota
    const newImage: string = payload.image ?? ''

    // Fetch the previous image first so we can clean up storage when it's
    // replaced by a new upload.
    const { data: oldRow } = await supabase
      .from('events')
      .select('image')
      .eq('id', id)
      .maybeSingle()

    const oldImage: string = (oldRow && typeof oldRow === 'object' && 'image' in oldRow)
      ? String((oldRow as { image: unknown }).image ?? '')
      : ''

    const { data, error } = await supabase
      .from('events')
      .update({
        title: payload.title.trim(),
        description: (payload.description ?? '').trim(),
        date: dateIso,
        location: payload.location.trim(),
        quota: quotaNumber,
        image: newImage,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    // Delete the old photo from storage ONLY when:
    // - there is an old photo,
    // - it differs from the new one,
    // - and it points to our own Supabase Storage bucket.
    if (oldImage && oldImage !== newImage) {
      try {
        await this.deleteImage(oldImage)
      } catch (storageErr: unknown) {
        console.warn('[update-event] Failed to delete old image:', storageErr)
      }
    }

    return mapEventRow(data)
  }

  async delete(id: string): Promise<void> {
    const supabase = useSupabaseClient()

    // 1. Fetch the event row first to learn the image URL that needs
    //    to be removed from Storage.
    const { data: row, error: fetchError } = await supabase
      .from('events')
      .select('image')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    const imageUrl: string = (row && typeof row === 'object' && 'image' in row)
      ? String((row as { image: unknown }).image ?? '')
      : ''

    // 2. Delete the image file from Storage (if any and owned by our bucket).
    //    A failure here does NOT abort the row deletion, because the row's
    //    data integrity is more important than a possible storage orphan.
    if (imageUrl) {
      try {
        await this.deleteImage(imageUrl)
      } catch (storageErr: unknown) {
        // Log and continue with the row delete. Orphan photos can be cleaned
        // up manually from the Supabase Storage dashboard.
        console.warn('[delete-event] Failed to delete image, continuing with row delete:', storageErr)
      }
    }

    // 3. Delete the event row from the database.
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Removes a file from the `event-images` bucket given its public URL.
   *
   * - Empty / external (non-Supabase) URL → no-op (returns false).
   * - Successful deletion → returns true.
   *
   * Note: a Supabase Storage public URL has the shape:
   *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
   * The path passed to `remove()` is `<path>` (relative to the bucket).
   */
  async deleteImage(publicUrl: string): Promise<boolean> {
    if (!publicUrl) return false

    const supabase = useSupabaseClient()

    // Decode the URL first to handle special characters safely.
    let url: URL
    try {
      url = new URL(publicUrl)
    } catch {
      return false
    }

    // Find the "/storage/v1/object/public/<bucket>/" segment in the
    // pathname and grab the file path that follows it.
    const marker = '/storage/v1/object/public/'
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) {
      // Not a Supabase Storage URL (e.g. Unsplash). Leave it alone.
      return false
    }

    const after = url.pathname.slice(idx + marker.length)
    const slashIdx = after.indexOf('/')
    if (slashIdx === -1) return false

    const bucket = after.slice(0, slashIdx)
    const filePath = decodeURIComponent(after.slice(slashIdx + 1))

    if (bucket !== EVENTS_BUCKET || !filePath) return false

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      throw new Error(error.message)
    }
    return true
  }

  async uploadImage(file: File): Promise<string> {
    const supabase = useSupabaseClient()

    // Build a unique file name: <timestamp>-<random>.<ext>
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
