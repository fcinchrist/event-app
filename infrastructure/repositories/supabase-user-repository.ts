import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type {
  CategoryAttendanceStat,
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

/**
 * Shape minimal baris `event_registrations` yang kita butuhkan untuk
 * agregasi per-kategori. Join ke `events` untuk tanggal & category_id,
 * lalu join ke `event_categories` untuk nama kategori.
 *
 * Field minimal agar payload Supabase sekecil mungkin — menarik hanya
 * kolom yang dipakai (PostgREST projection).
 */
interface RawRegistrationWithCategoryRow {
  status: string
  event: {
    date: string
    category_id: string | null
    category:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
  } | null
}

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

    // Default yang aman: kalau caller (use case) tidak mengirim
    // `user_status` / `member_type`, repository tetap menulis
    // nilai eksplisit sehingga baris tidak terjatuh ke DEFAULT DB.
    //
    // Kenapa tidak pakai DEFAULT DB? Karena DEFAULT 'internal' di
    // migration 004 hanya untuk back-fill baris lama. Untuk baris
    // baru, aplikasi harus mengirim 'active' + 'external' (alur
    // publik) — lihat [`RegisterUser`](application/use-cases/register-user.ts).
    const { data, error } = await supabase
      .from('event_users')
      .insert({
        id,
        no_hp: input.noHp,
        nama: input.nama,
        user_status: input.userStatus ?? 'active',
        member_type: input.memberType ?? 'external',
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

  async update(id: string, input: EventUserFormData): Promise<EventUser> {
    const supabase = useSupabaseClient()

    // Untuk UPDATE: hanya timpa kolom yang memang dikirim caller.
    // Gunakan pendekatan "spread if defined" agar admin bisa
    // mengubah satu field tanpa menimpa yang lain. Tapi agar
    // konsisten dengan alur create, kita isi default hanya saat
    // caller memang berniat men-set field ini.
    const updatePayload: Record<string, unknown> = {
      no_hp: input.noHp,
      nama: input.nama,
    }
    if (input.userStatus !== undefined) {
      updatePayload.user_status = input.userStatus
    }
    if (input.memberType !== undefined) {
      updatePayload.member_type = input.memberType
    }

    const { data, error } = await supabase
      .from('event_users')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      // 23505 = unique_violation (no_hp already used by another row)
      if (error.code === '23505') {
        throw new Error('Nomor HP ini sudah dipakai user lain.')
      }
      // PGRST116 = no row matches the filter (.single() expects exactly one).
      if (error.code === 'PGRST116') {
        throw new Error('User tidak ditemukan.')
      }
      throw new Error(error.message)
    }
    return tryMapUserRow(data) as EventUser
  }

  async delete(id: string): Promise<void> {
    const supabase = useSupabaseClient()

    // Use `eq` + `select('id')` to detect "not found" case explicitly
    // (a delete without `.select()` is fire-and-forget and we can't
    // distinguish "deleted 1 row" from "row didn't exist").
    const { data, error } = await supabase
      .from('event_users')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      throw new Error(error.message)
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('User tidak ditemukan.')
    }
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

  /**
   * Hitung statistik kehadiran user per kategori event.
   *
   * Strategi:
   * 1. Tarik SEMUA registrasi user + event (date, category_id) +
   *    category (name). Pagination/limit tidak dipasang karena
   *    di-master user masing-masing user realistic-nya hanya punya
   *    puluhan event, dan supabase-user-repository dipakai oleh
   *    admin (server-class query).
   * 2. Filter berdasarkan tahun `event.date` di app-layer.
   * 3. Aggregate di app-layer: group by (categoryId, categoryName),
   *    hitung totalRegistered, totalAttended (status='Hadir'),
   *    dan attendanceRate (pembulatan).
   *
   * Event tanpa kategori dikelompokkan ke (null, 'Tanpa Kategori').
   */
  async getStatsByCategory(
    userId: string,
    year: number | null,
  ): Promise<CategoryAttendanceStat[]> {
    const supabase = useSupabaseClient()

    const { data, error } = await supabase
      .from('event_registrations')
      .select(
        'status, event:events(date, category_id, category:event_categories(id, name))',
      )
      .eq('user_id', userId)

    if (error) {
      throw new Error(error.message)
    }

    const rows = (Array.isArray(data) ? data : []) as unknown as RawRegistrationWithCategoryRow[]

    // Aggregation map: key = `${categoryId}__${categoryName}` untuk
    // mengelompokkan baris event yang null category dengan kategori
    // bernama "Tanpa Kategori" (id null).
    const groups = new Map<
      string,
      {
        categoryId: string | null
        categoryName: string
        totalRegistered: number
        totalAttended: number
      }
    >()

    for (const row of rows) {
      if (!row.event) continue
      const eventDate = new Date(row.event.date)
      if (Number.isNaN(eventDate.getTime())) continue
      if (year !== null && eventDate.getFullYear() !== year) continue

      // `event.category` bisa null, atau array (relasi PostgREST 1-N),
      // atau object tunggal. Hanya ada satu kategori per event
      // (category_id di events adalah single FK) — jadi kalau array,
      // ambil elemen pertama.
      let categoryId: string | null = row.event.category_id ?? null
      let categoryName: string = 'Tanpa Kategori'
      const cat = row.event.category
      if (cat !== null && cat !== undefined) {
        if (Array.isArray(cat) && cat.length > 0) {
          categoryId = cat[0]?.id ?? categoryId
          categoryName = cat[0]?.name ?? categoryName
        } else if (!Array.isArray(cat)) {
          categoryId = cat.id ?? categoryId
          categoryName = cat.name ?? categoryName
        }
      }

      const key = `${categoryId ?? '__none__'}__${categoryName}`
      const existing = groups.get(key) ?? {
        categoryId,
        categoryName,
        totalRegistered: 0,
        totalAttended: 0,
      }
      existing.totalRegistered += 1
      if (row.status === 'Hadir') {
        existing.totalAttended += 1
      }
      groups.set(key, existing)
    }

    const result: CategoryAttendanceStat[] = Array.from(groups.values()).map(
      (g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        totalRegistered: g.totalRegistered,
        totalAttended: g.totalAttended,
        attendanceRate:
          g.totalRegistered > 0
            ? Math.round((g.totalAttended / g.totalRegistered) * 100)
            : 0,
      }),
    )

    // Sort: kategori dengan event paling banyak di atas, ties broken
    // alphabetically by name (Indonesia-friendly).
    result.sort((a, b) => {
      if (a.totalRegistered !== b.totalRegistered) {
        return b.totalRegistered - a.totalRegistered
      }
      return a.categoryName.localeCompare(b.categoryName, 'id-ID')
    })

    return result
  }

  /**
   * Ambil daftar tahun unik dari `event.date` untuk event yang
   * pernah diikuti user, diurutkan descending (terbaru dulu).
   *
   * Pakai RPC-free: select raw, parse di app-layer. Untuk beberapa
   * ratus baris ini jauh lebih cepat & sederhana daripada membangun
   * view/SQL function.
   */
  async getRegistrationYears(userId: string): Promise<number[]> {
    const supabase = useSupabaseClient()

    const { data, error } = await supabase
      .from('event_registrations')
      .select('event:events(date)')
      .eq('user_id', userId)

    if (error) {
      throw new Error(error.message)
    }

    const rows = (Array.isArray(data) ? data : []) as unknown as Array<{
      event: { date: string } | null
    }>

    const years = new Set<number>()
    for (const row of rows) {
      if (!row.event) continue
      const d = new Date(row.event.date)
      if (Number.isNaN(d.getTime())) continue
      years.add(d.getFullYear())
    }

    return Array.from(years).sort((a, b) => b - a)
  }
}
