/**
 * Centralized logger untuk seluruh project.
 *
 * Tujuan:
 * - Standarkan format log (timestamp + module + level + message)
 * - Centralize "noisy" console.warn/error yang tersebar di mana-mana
 * - Siap di-integrasikan dengan Sentry / Datadog / Logtail (tinggal
 *   tambahkan transport di `dispatch()`)
 * - Beri cara统一 untuk dev (verbose) vs prod (silent / transport-only)
 *
 * Usage:
 * ```ts
 * import { createLogger } from '~/utils/logger'
 * const log = createLogger('supabase-event-repo')
 * log.warn('Failed to delete old image', err)
 * log.error('User create failed', err)
 * ```
 *
 * Design notes:
 * - Tidak pakai library eksternal (pino/winston) — supaya bundle tetap
 *   kecil dan zero-config. Kalau nanti perlu, ganti `dispatch()` saja.
 * - Di production, hanya `error` level yang di-print ke console
 *   (sesuai konvensi 12-factor app + Vercel/Netlify log drain).
 * - `error()` automatically men-extract `stack` dari Error instance
 *   supaya debugging lebih mudah.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  /** Optional structured data — akan di-stringify untuk console, dan
   *  dikirim ke transport (Sentry breadcrumbs, dll) apa adanya. */
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  context?: LogContext
  /** Error stack (kalau `err` adalah Error instance). */
  stack?: string
}

/** Konfigurasi global. Bisa di-override dari `nuxt.config.ts` runtimeConfig
 *  kalau perlu. Untuk sekarang kita hard-code, tapi exported supaya
 *  gampang di-test. */
const config = {
  /** Minimum level yang di-print ke console. */
  minLevel: (import.meta.dev ? 'debug' : 'error') as LogLevel,
  /** Kalau `true`, error akan di-throw setelah di-log.
   *  Set ke `false` di production. */
  throwOnError: false,
  /** Prefix untuk semua log message. Berguna untuk filter di Vercel logs. */
  appPrefix: 'event-web',
} as const

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.minLevel]
}

function formatMessage(entry: LogEntry): string {
  const ctx = entry.context && Object.keys(entry.context).length > 0
    ? ` ${JSON.stringify(entry.context)}`
    : ''
  return `[${config.appPrefix}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}${ctx}`
}

/**
 * Transport hook — titik integrasi dengan external log service.
 * Tambahkan Sentry.captureException di sini kalau pakai Sentry.
 */
function dispatch(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return

  const formatted = formatMessage(entry)

  switch (entry.level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(formatted)
      break
    case 'info':
      // eslint-disable-next-line no-console
      console.info(formatted)
      break
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(formatted)
      break
    case 'error':
      // eslint-disable-next-line no-console
      console.error(formatted, entry.stack ?? '')
      // TODO: Sentry.captureException(entry) — uncomment kalau Sentry wired
      break
  }
}

function buildEntry(
  level: LogLevel,
  module: string,
  message: string,
  errOrContext?: unknown,
  extraContext?: LogContext,
): LogEntry {
  const baseContext: LogContext = {}
  let stack: string | undefined

  if (errOrContext instanceof Error) {
    stack = errOrContext.stack
    baseContext.errorName = errOrContext.name
  } else if (typeof errOrContext === 'object' && errOrContext !== null) {
    Object.assign(baseContext, errOrContext as LogContext)
  } else if (errOrContext !== undefined) {
    baseContext.value = errOrContext
  }

  if (extraContext) {
    Object.assign(baseContext, extraContext)
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  }
  if (Object.keys(baseContext).length > 0) {
    entry.context = baseContext
  }
  if (stack) entry.stack = stack
  return entry
}

export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, errOrContext?: unknown, extraContext?: LogContext): void
  error(message: string, errOrContext?: unknown, extraContext?: LogContext): void
  /** Buat child logger dengan module prefix tambahan. */
  child(subModule: string): Logger
}

/**
 * Buat logger instance untuk module tertentu.
 * @param module nama module/komponen (untuk filter log)
 */
export function createLogger(module: string): Logger {
  const log = (
    level: LogLevel,
    message: string,
    errOrContext?: unknown,
    extraContext?: LogContext,
  ): void => {
    const entry = buildEntry(level, module, message, errOrContext, extraContext)
    dispatch(entry)
    if (level === 'error' && config.throwOnError && errOrContext instanceof Error) {
      throw errOrContext
    }
  }

  return {
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, errOrContext, extraContext) => log('warn', message, errOrContext, extraContext),
    error: (message, errOrContext, extraContext) => log('error', message, errOrContext, extraContext),
    child: (subModule: string) => createLogger(`${module}:${subModule}`),
  }
}

/**
 * Helper untuk extract error message yang aman — fallback ke string
 * representation kalau `err` bukan Error instance.
 */
export function getErrorMessage(err: unknown, fallback = 'Terjadi kesalahan.'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return fallback
}
