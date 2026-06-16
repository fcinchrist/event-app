import { computed, onBeforeUnmount, watch } from 'vue'
import type { LocationQueryRaw } from 'vue-router'

/**
 * Composable untuk sinkronisasi filter dengan query string URL.
 *
 * Best-practice flow:
 *   1. State filter (search/status/period/page) tetap di Pinia store
 *      atau ref lokal — single source of truth untuk UI.
 *   2. Saat mount, baca query → terapkan ke state (init from URL).
 *   3. Setiap perubahan state → tulis ke URL via `router.replace`
 *      untuk filter, atau `router.push` untuk pagination (sehingga
 *      back-button bisa navigate antar halaman).
 *   4. Watch route.query → kalau URL berubah dari luar (back/forward
 *      button, deep link), sinkronkan balik ke state.
 *
 * Konvensi parameter URL:
 *   - `q`            → string pencarian
 *   - `status`       → `Aktif` | `Dibatalkan` | `Selesai` | `all`
 *   - `page`         → integer halaman (default 1, hilang dari URL kalau 1)
 *   - `period`       → `all` | `day` | `year` (default `all`, hilang dari URL)
 *   - `date`         → YYYY-MM-DD (hanya relevan saat `period=day`)
 *   - `year`         → integer tahun (hanya relevan saat `period=year`)
 */

export type PeriodQueryMode = 'all' | 'day' | 'year'

export interface PeriodQueryValue {
  mode: PeriodQueryMode
  date: string
  year: number
}

export interface UrlSyncOptions {
  /** Gunakan `push` (tambah history entry) atau `replace` (default). */
  history?: 'replace' | 'push'
}

/**
 * Bangun objek query minimal: hanya field yang non-default supaya
 * URL tetap pendek dan enak di-share. Default value:
 *   - q: ''
 *   - status: 'all'
 *   - page: 1
 *   - period: 'all'  → tidak ditulis
 *   - date: ''        → hanya ditulis kalau period=day
 *   - year: <current> → hanya ditulis kalau period=year
 */
export function buildEventListQuery(input: {
  q: string
  status: string
  page: number
  period: PeriodQueryValue
}): LocationQueryRaw {
  const q: LocationQueryRaw = {}
  if (input.q.trim()) q.q = input.q.trim()
  if (input.status !== 'all') q.status = input.status
  if (input.page > 1) q.page = String(input.page)
  if (input.period.mode === 'day' && input.period.date) {
    q.period = 'day'
    q.date = input.period.date
  } else if (input.period.mode === 'year') {
    q.period = 'year'
    q.year = String(input.period.year)
  }
  return q
}

/**
 * Bangun query untuk summary dashboard (cuma period).
 */
export function buildSummaryQuery(period: PeriodQueryValue): LocationQueryRaw {
  const q: LocationQueryRaw = {}
  if (period.mode === 'day' && period.date) {
    q.period = 'day'
    q.date = period.date
  } else if (period.mode === 'year') {
    q.period = 'year'
    q.year = String(period.year)
  }
  return q
}

/**
 * Parse query string ke PeriodQueryValue. Return null kalau query
 * kosong / tidak valid — caller boleh pakai default.
 */
export function parsePeriodQuery(query: Record<string, unknown>): PeriodQueryValue | null {
  const raw = typeof query.period === 'string' ? query.period.toLowerCase() : ''
  if (raw === 'day') {
    const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
      ? query.date
      : ''
    if (!date) return null
    return { mode: 'day', date, year: new Date().getFullYear() }
  }
  if (raw === 'year') {
    const yRaw = typeof query.year === 'string' ? Number(query.year) : NaN
    if (!Number.isInteger(yRaw) || yRaw < 1970 || yRaw > 2999) return null
    return { mode: 'year', date: '', year: yRaw }
  }
  if (raw === 'all') return { mode: 'all', date: '', year: new Date().getFullYear() }
  return null
}

/**
 * Helper untuk push/replace URL dengan query yang sudah dibersihkan.
 * Dipakai internal oleh composable di bawah.
 */
function navigate(
  router: ReturnType<typeof useRouter>,
  query: LocationQueryRaw,
  options: UrlSyncOptions,
): void {
  void router[options.history === 'push' ? 'push' : 'replace']({ query })
}

/**
 * Sinkronkan sebuah ref (state filter) ke query key tertentu di URL.
 * Auto-parse dari URL saat inisialisasi, dan auto-sync perubahan ke
 * URL. Juga watch perubahan dari luar (back/forward button).
 *
 * @param key        Nama query parameter (mis. 'q', 'status', 'page')
 * @param source     Ref<string|number> yang menyimpan nilai state
 * @param serialize  Optional: bagaimana mengubah state ke string URL
 * @param parse      Optional: bagaimana mengubah string URL ke state
 * @param options    `history: 'push' | 'replace'`
 */
export function useQueryParamSync<T extends string | number>(
  key: string,
  source: Ref<T>,
  options: UrlSyncOptions & {
    serialize?: (v: T) => string | null
    parse?: (raw: string) => T | null
  } = {},
): void {
  const router = useRouter()
  const route = useRoute()

  const serialize = options.serialize ?? ((v: T): string | null => String(v))
  const parse = options.parse ?? ((raw: string): T | null => raw as unknown as T)

  // 1. Inisialisasi dari URL (jika ada dan valid).
  const fromUrl = route.query[key]
  if (typeof fromUrl === 'string' && fromUrl.length > 0) {
    const parsed = parse(fromUrl)
    if (parsed !== null && parsed !== source.value) {
      source.value = parsed
    }
  }

  // 2. Watch perubahan state → tulis ke URL.
  const stopWrite = watch(
    source,
    (next) => {
      const current = route.query[key]
      const serialized = serialize(next)
      // Hindari navigasi kalau nilai URL sudah sama (mencegah loop
      // dan navigasi sia-sia).
      if (serialized === null) {
        if (current === undefined) return
        const next: LocationQueryRaw = { ...route.query }
        delete next[key]
        navigate(router, next, options)
        return
      }
      if (current === serialized) return
      navigate(router, { ...route.query, [key]: serialized }, options)
    },
  )

  // 3. Watch perubahan dari luar (back/forward, deep link) → sinkron
  //    balik ke state. Skip iterasi pertama karena sudah di-handle
  //    oleh init di atas.
  const stopRead = watch(
    () => route.query[key],
    (raw) => {
      if (typeof raw !== 'string' || raw.length === 0) {
        // URL tidak punya key ini → kembalikan ke default implisit.
        // Caller bertanggung jawab set default (biasanya lewat
        // computed + setter). Di sini kita tidak memaksa reset agar
        // tidak menimpa default di setiap halaman.
        return
      }
      const parsed = parse(raw)
      if (parsed !== null && parsed !== source.value) {
        source.value = parsed
      }
    },
  )

  onBeforeUnmount(() => {
    stopWrite()
    stopRead()
  })
}

/**
 * Versi khusus untuk `period` (objek gabungan 3-field: mode/date/year).
 * Mengelola 3 query key sekaligus: `period`, `date`, `year`.
 */
export function usePeriodQuerySync(
  source: Ref<PeriodQueryValue>,
  options: UrlSyncOptions = {},
): void {
  const router = useRouter()
  const route = useRoute()

  // 1. Init dari URL.
  const fromUrl = parsePeriodQuery(route.query as Record<string, unknown>)
  if (fromUrl !== null) {
    // Hanya timpa kalau ada perbedaan supaya tidak me-reset value
    // yang sengaja di-set di script awal.
    const sameMode = fromUrl.mode === source.value.mode
    const sameDate = fromUrl.date === source.value.date
    const sameYear = fromUrl.year === source.value.year
    if (!(sameMode && sameDate && sameYear)) {
      source.value = fromUrl
    }
  }

  // 2. Watch perubahan state → tulis ke URL.
  const stopWrite = watch(
    source,
    (next) => {
      const target = buildSummaryQuery(next)
      const current = route.query
      // Bandingkan supaya tidak navigasi kalau sama.
      const same =
        current.period === target.period &&
        current.date === target.date &&
        current.year === target.year
      if (same) return
      navigate(router, target, options)
    },
  )

  // 3. Watch perubahan dari URL (back/forward).
  const stopRead = watch(
    () => route.query,
    (q) => {
      const parsed = parsePeriodQuery(q as Record<string, unknown>)
      if (parsed === null) return
      const sameMode = parsed.mode === source.value.mode
      const sameDate = parsed.date === source.value.date
      const sameYear = parsed.year === source.value.year
      if (!(sameMode && sameDate && sameYear)) {
        source.value = parsed
      }
    },
  )

  onBeforeUnmount(() => {
    stopWrite()
    stopRead()
  })
}
