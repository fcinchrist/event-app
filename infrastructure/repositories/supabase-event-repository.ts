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

  async update(id: string, payload: EventFormData): Promise<Event> {
    const supabase = useSupabaseClient()

    const dateIso = new Date(payload.date).toISOString()
    const quotaNumber = typeof payload.quota === 'string'
      ? parseInt(payload.quota, 10)
      : payload.quota
    const newImage: string = payload.image ?? ''

    // Ambil gambar lama dulu agar jika diganti kita bisa bersihkan storage.
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

    // Hapus foto lama dari storage HANYA jika:
    // - ada foto lama,
    // - berbeda dari foto baru,
    // - dan merupakan URL Supabase Storage kita.
    if (oldImage && oldImage !== newImage) {
      try {
        await this.deleteImage(oldImage)
      } catch (storageErr: unknown) {
        console.warn('[update-event] Gagal menghapus foto lama:', storageErr)
      }
    }

    return mapEventRow(data)
  }

  async delete(id: string): Promise<void> {
    const supabase = useSupabaseClient()

    // 1. Ambil row event terlebih dahulu untuk mengetahui URL gambar
    //    yang harus dihapus dari Storage.
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

    // 2. Hapus file gambar dari Storage (kalau ada & milik bucket kita).
    //    Kegagalan di sini TIDAK membatalkan penghapusan row, karena
    //   比起 storage orphan, integritas data row lebih diprioritaskan.
    if (imageUrl) {
      try {
        await this.deleteImage(imageUrl)
      } catch (storageErr: unknown) {
        // Log saja, lanjut hapus row. Foto orphan bisa dibersihkan manual
        // lewat dashboard Supabase Storage.
        console.warn('[delete-event] Gagal menghapus foto, lanjut hapus row:', storageErr)
      }
    }

    // 3. Hapus row event dari database.
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Menghapus sebuah file di bucket `event-images` berdasarkan public URL.
   *
   * - URL kosong / URL external (bukan Supabase) → no-op (return false).
   * - Berhasil → return true.
   *
   * Catatan: URL public Supabase Storage berbentuk:
   *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
   * Path yang dipakai untuk `remove()` adalah `<path>` (relatif terhadap bucket).
   */
  async deleteImage(publicUrl: string): Promise<boolean> {
    if (!publicUrl) return false

    const supabase = useSupabaseClient()

    // Decode dulu untuk handle URL yang mengandung karakter khusus.
    let url: URL
    try {
      url = new URL(publicUrl)
    } catch {
      return false
    }

    // Cari segment "/storage/v1/object/public/<bucket>/" di pathname
    // dan ambil path setelahnya.
    const marker = '/storage/v1/object/public/'
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) {
      // Bukan URL Supabase Storage (mis. Unsplash). Jangan dihapus.
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
