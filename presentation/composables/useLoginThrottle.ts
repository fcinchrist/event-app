/**
 * useLoginThrottle
 * ----------------
 * Client-side rate limiter untuk halaman admin login.
 *
 * Latar belakang :
 * - Supabase sudah ada rate-limit di sisi server (per-IP & per-account),
 *   tapi feedback-nya kasar (cuma 429 setelah limit) dan attacker yang
 *   pandai akan menggunakan credential stuffing dengan delay besar.
 * - Tanpa UI feedback, admin legitimate yang salah ketik password bisa
 *   terus mencoba tanpa sadar sudah dekat limit server.
 *
 * Strategi (defense-in-depth, client-only — tanpa Edge Function):
 * - Track failed attempts per "identifier" (email) di `localStorage`.
 * - Setelah N gagal berturut-turut, kunci sementara dengan exponential
 *   backoff (3 → 30 dtk, 5 → 5 mnt, 8 → 30 mnt).
 * - Sukses login atau ganti identifier → reset counter.
 * - State reaktif: `isLocked`, `remainingMs`, `attempts` — UI disable
 *   button & tampilkan countdown selama locked.
 *
 * Catatan keamanan:
 * - Ini BUKAN pengganti server-side rate limit (Supabase Auth tetap
 *   gate-of-truth), hanya layer tambahan untuk menghalangi casual
 *   brute-force dan memberi UX feedback ke admin.
 * - Attacker yang punya akses ke localStorage bisa menghapus state ini,
 *   tapi tetap akan terbentur server-side limit setelah ~30 attempts.
 */
import { computed, onScopeDispose, ref, watch } from 'vue'

const STORAGE_KEY = 'auth.loginThrottle.v1'

interface ThrottleRecord {
  /** Email yang sedang dilock. Bisa null kalau belum ada attempt. */
  email: string | null
  /** Jumlah gagal berturut-turut untuk email ini. */
  failedCount: number
  /** Unix-ms kapan lockout berakhir (0 = tidak locked). */
  lockedUntil: number
  /** Unix-ms kapan counter gagal pertama di-set, untuk reset setelah idle lama. */
  firstFailureAt: number
}

interface LockWindow {
  /** Minimal gagal untuk trigger lockout pertama. */
  threshold: number
  /** Durasi lock dalam ms. */
  durationMs: number
}

const LOCK_WINDOWS: readonly LockWindow[] = [
  // failedCount >= 3 → 30 detik
  { threshold: 3, durationMs: 30_000 },
  // failedCount >= 5 → 5 menit
  { threshold: 5, durationMs: 5 * 60_000 },
  // failedCount >= 8 → 30 menit
  { threshold: 8, durationMs: 30 * 60_000 },
] as const

/** Idle window: kalau gagal pertama > 30 menit lalu, reset counter. */
const IDLE_RESET_MS = 30 * 60_000

function emptyRecord(): ThrottleRecord {
  return { email: null, failedCount: 0, lockedUntil: 0, firstFailureAt: 0 }
}

function readStorage(): ThrottleRecord {
  if (typeof window === 'undefined') return emptyRecord()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyRecord()
    const parsed = JSON.parse(raw) as Partial<ThrottleRecord>
    // Sanity-check shape — kalau schema berubah, reset.
    if (
      typeof parsed !== 'object'
      || parsed === null
      || typeof (parsed as ThrottleRecord).failedCount !== 'number'
    ) {
      return emptyRecord()
    }
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      failedCount: Math.max(0, Math.floor(parsed.failedCount ?? 0)),
      lockedUntil: Math.max(0, Math.floor(parsed.lockedUntil ?? 0)),
      firstFailureAt: Math.max(0, Math.floor(parsed.firstFailureAt ?? 0)),
    }
  } catch {
    return emptyRecord()
  }
}

function writeStorage(record: ThrottleRecord): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Quota exceeded / private mode — abaikan, lockout tetap berjalan
    // in-memory sampai page reload.
  }
}

function computeLockDurationMs(failedCount: number): number {
  // Pilih window dengan threshold terbesar yang masih <= failedCount.
  let duration = 0
  for (const w of LOCK_WINDOWS) {
    if (failedCount >= w.threshold) {
      duration = w.durationMs
    }
  }
  return duration
}

export function useLoginThrottle() {
  // Hydrate dari localStorage supaya refresh page tidak menghilangkan lockout.
  const initial = readStorage()
  const record = ref<ThrottleRecord>(initial)

  /** Tick setiap detik agar `remainingMs` reaktif. */
  const now = ref<number>(typeof window === 'undefined' ? 0 : Date.now())
  let timerId: ReturnType<typeof setInterval> | null = null

  function startTicker(): void {
    if (typeof window === 'undefined') return
    if (timerId !== null) return
    timerId = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  function stopTicker(): void {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  // Auto-start ticker kalau saat hydrate ternyata sedang locked.
  if (initial.lockedUntil > Date.now()) {
    startTicker()
  }

  // Bersihin ticker kalau composable di-unmount (misal navigasi SPA).
  onScopeDispose(stopTicker)

  /** Apakah saat ini terkunci (untuk email yang tersimpan). */
  const isLocked = computed<boolean>(() => {
    if (record.value.lockedUntil <= 0) return false
    if (record.value.lockedUntil > now.value) return true
    // Lockout sudah lewat — reset state locked, tapi counter gagal
    // kita biarkan supaya backoff berikutnya tetap naik.
    return false
  })

  /** Sisa waktu lockout dalam ms. 0 kalau tidak locked. */
  const remainingMs = computed<number>(() => {
    if (record.value.lockedUntil <= 0) return 0
    const diff = record.value.lockedUntil - now.value
    return diff > 0 ? diff : 0
  })

  /** Counter gagal berturut-turut untuk email saat ini. */
  const attempts = computed<number>(() => record.value.failedCount)

  /** Sisa percobaan sebelum lock berikutnya (untuk UX hint). */
  const remainingAttempts = computed<number>(() => {
    // Cari threshold lock berikutnya yang > failedCount saat ini.
    const next = LOCK_WINDOWS.find(w => w.threshold > record.value.failedCount)
    if (!next) return 0
    return next.threshold - record.value.failedCount
  })

  /**
   * Cek apakah boleh attempt login untuk email tertentu.
   * Return `null` kalau boleh, atau string pesan error (lengkap dengan
   * sisa detik) kalau masih locked.
   */
  function check(email: string): string | null {
    if (record.value.email !== email) {
      // Identifier berbeda → reset state (sebelum lockout orang lain).
      record.value = emptyRecord()
      writeStorage(record.value)
      return null
    }
    if (record.value.lockedUntil > now.value) {
      const seconds = Math.ceil((record.value.lockedUntil - now.value) / 1000)
      return `Terlalu banyak percobaan gagal. Coba lagi dalam ${seconds} detik.`
    }
    return null
  }

  /** Catat satu kegagalan login. */
  function recordFailure(email: string): void {
    const nowMs = Date.now()
    // Kalau ganti email, mulai counter baru.
    if (record.value.email !== email) {
      record.value = emptyRecord()
    }
    // Idle reset: kalau gagal pertama sudah lama sekali, mulai ulang.
    if (
      record.value.firstFailureAt > 0
      && nowMs - record.value.firstFailureAt > IDLE_RESET_MS
    ) {
      record.value.failedCount = 0
      record.value.lockedUntil = 0
    }
    record.value.email = email
    record.value.failedCount += 1
    if (record.value.firstFailureAt === 0) {
      record.value.firstFailureAt = nowMs
    }
    const duration = computeLockDurationMs(record.value.failedCount)
    if (duration > 0) {
      record.value.lockedUntil = nowMs + duration
      startTicker()
    }
    writeStorage(record.value)
  }

  /** Reset counter (dipanggil saat login sukses atau admin ganti identifier). */
  function reset(): void {
    record.value = emptyRecord()
    writeStorage(record.value)
    stopTicker()
  }

  // Auto-stop ticker kalau lockout habis.
  watch(remainingMs, (ms) => {
    if (ms <= 0 && timerId !== null) {
      stopTicker()
    }
  })

  return {
    isLocked,
    remainingMs,
    remainingAttempts,
    attempts,
    check,
    recordFailure,
    reset,
  }
}
