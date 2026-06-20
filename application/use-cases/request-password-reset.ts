import type { AuthRepository } from '~/domain/repositories/auth-repository'
import { createLogger } from '~/utils/logger'

const log = createLogger('use-case:request-password-reset')

/**
 * Window untuk constant-delay: gunakan range acak 600–1200 ms supaya
 * timing response tidak bocor apakah email terdaftar atau tidak.
 * (Bug #3 — Email Enumeration mitigation di layer use-case.)
 *
 * 600 ms = cukup untuk menutupi Supabase response time yang biasanya
 * ~150–400 ms, tapi tidak terlalu lambat untuk UX admin yang legitimate.
 */
const RESPONSE_DELAY_MIN_MS = 600
const RESPONSE_DELAY_MAX_MS = 1200

function pickConstantDelayMs(): number {
  // Math.random aman untuk non-cryptographic purposes (anti-timing-attack
  // best-effort, bukan security-critical).
  return Math.floor(
    RESPONSE_DELAY_MIN_MS
      + Math.random() * (RESPONSE_DELAY_MAX_MS - RESPONSE_DELAY_MIN_MS),
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface RequestPasswordResetResult {
  success: boolean
  error: string | null
}

export class RequestPasswordReset {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(email: string, redirectTo: string): Promise<RequestPasswordResetResult> {
    if (!email.trim()) {
      // Tetap jalankan delay supaya empty-email dan email-invalid tidak
      // bisa dibedakan dari response yang sah lewat timing.
      await sleep(pickConstantDelayMs())
      return { success: false, error: 'Email wajib diisi.' }
    }

    try {
      await this.authRepository.resetPasswordForEmail(email, redirectTo)
      // Selalu return success (lihat comment di
      // `SupabaseAuthRepository.resetPasswordForEmail`). UI menampilkan
      // pesan generik tanpa membedakan email terdaftar atau tidak.
      return { success: true, error: null }
    } catch (err: unknown) {
      // Repository sudah silent-swallow semua error enumeration vector,
      // tapi kalau sampai sini ada error tak terduga, kita tetap log
      // secara internal dan kembalikan success (jangan bocor ke UI).
      log.error(
        'Password reset request failed (unexpected — silently returning success to prevent enumeration)',
        err,
        { email, redirectTo },
      )
      return { success: true, error: null }
    } finally {
      // Constant delay di finally agar SELALU diterapkan, baik success
      // maupun empty-email path — supaya attacker tidak bisa pakai
      // timing untuk membedakan cabang mana yang dieksekusi.
      await sleep(pickConstantDelayMs())
    }
  }
}
