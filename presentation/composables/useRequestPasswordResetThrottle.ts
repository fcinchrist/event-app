/**
 * useRequestPasswordResetThrottle
 * --------------------------------
 * Cooldown sederhana untuk halaman "Lupa Password".
 *
 * Latar belakang (Bug #3 — Email Enumeration):
 * - `resetPasswordForEmail` di Supabase Auth bisa di-probe untuk
 *   enumerasi email admin: response berbeda untuk "email terdaftar"
 *   vs "tidak terdaftar".
 * - Kita sudah memitigasi ini di sisi use-case (generic response +
 *   constant delay). Tapi supaya attacker tidak bisa mem-bombard
 *   endpoint forgot-password sebagai DoS / signal-channel, kita
 *   tambah cooldown client-side.
 *
 * Strategi:
 * - Cooldown fixed 60 detik setelah submit terakhir (berhasil atau gagal).
 * - Track di `localStorage` supaya reload page tidak membuka jendela baru.
 * - State reaktif: `isCoolingDown`, `remainingMs` — UI disable button.
 *
 * Catatan:
 * - Ini HANYA untuk UX (admin tidak spam klik) dan pengurangan beban
 *   server. Attacker bisa bypass dengan Incognito / cleared storage,
 *   tapi Supabase server-side rate-limit (5/jam per email default)
 *   yang menjadi gate-of-truth.
 */
import { computed, onScopeDispose, ref, watch } from 'vue'

const STORAGE_KEY = 'auth.passwordResetCooldown.v1'
const COOLDOWN_MS = 60_000

function readStorage(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return parsed
  } catch {
    return 0
  }
}

function writeStorage(value: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Quota / private mode — abaikan.
  }
}

export function useRequestPasswordResetThrottle() {
  const cooldownUntil = ref<number>(readStorage())
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

  if (cooldownUntil.value > Date.now()) {
    startTicker()
  }

  onScopeDispose(stopTicker)

  const isCoolingDown = computed<boolean>(() => cooldownUntil.value > now.value)

  const remainingMs = computed<number>(() => {
    const diff = cooldownUntil.value - now.value
    return diff > 0 ? diff : 0
  })

  /** Trigger cooldown setelah submit (berhasil ATAU gagal). */
  function trigger(): void {
    cooldownUntil.value = Date.now() + COOLDOWN_MS
    writeStorage(cooldownUntil.value)
    startTicker()
  }

  function clear(): void {
    cooldownUntil.value = 0
    writeStorage(0)
    stopTicker()
  }

  watch(remainingMs, (ms) => {
    if (ms <= 0 && timerId !== null) {
      stopTicker()
    }
  })

  return {
    isCoolingDown,
    remainingMs,
    trigger,
    clear,
  }
}
