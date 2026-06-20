/**
 * Indonesian phone number regex (matches migration 006 RLS):
 * - Starts with '08' (Indonesian mobile prefix)
 * - Followed by 8 to 12 digits (total length 10-14)
 *
 * Examples:
 *   '0812345678'    → match (10 digits, valid — minimal length)
 *   '08123456789'   → match (11 digits, valid)
 *   '081234567890'  → match (12 digits, valid)
 *   '62812345678'   → no match (starts with 62, will be stripped first)
 *   '0212345678'    → no match (landline, starts with 02)
 *   '081234567'     → no match (too short, < 10 digits)
 */
export const PHONE_NUMBER_PATTERN = /^08[0-9]{8,12}$/

/**
 * Error message yang konsisten untuk semua validation failure.
 * Disimpan sebagai konstanta agar form bisa menampilkan pesan yang sama.
 */
export const PHONE_VALIDATION_ERROR =
  'Nomor HP harus format Indonesia yang valid (contoh: 081234567890, 10-14 digit).'

/**
 * Normalize a phone number into the consistent format '08123456789':
 * - Strip every non-digit character (spaces, dashes, parentheses, '+')
 * - If it starts with '62' (Indonesia country code), rewrite it to '0'
 *
 * @returns Normalized digit-only string, or null if input is empty.
 *          Use `validatePhoneFormat()` after this if you need full validation.
 *
 * @example
 * normalizePhone('+62 812-3456-7890') // → '081234567890'
 * normalizePhone('0812 3456 789')    // → '0812345678'
 * normalizePhone('')                 // → null
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null

  // Strip every non-digit character
  let digits = input.replace(/\D/g, '')

  // Convert the '62' (country code) prefix to '0'
  if (digits.startsWith('62') && digits.length > 2) {
    digits = '0' + digits.slice(2)
  }

  return digits
}

/**
 * Validate that a phone number matches the Indonesian mobile format.
 *
 * string, then Postgres RLS rejects the insert with a generic
 * "new row violates row-level security policy" error. With this check,
 * we throw a clear Indonesian error message BEFORE the database
 * round-trip.
 *
 * @returns The normalized phone on success, or null on failure.
 *          Returning the string (instead of boolean) gives TypeScript
 *          automatic type-narrowing after `if (!noHp) throw`.
 *
 * @example
 * validatePhoneFormat('081234567890') // → '081234567890'
 * validatePhoneFormat('0212345678')   // → null (landline)
 * validatePhoneFormat('123')          // → null (too short)
 * validatePhoneFormat(null)           // → null
 */
export function validatePhoneFormat(normalized: string | null): string | null {
  if (!normalized) return null
  return PHONE_NUMBER_PATTERN.test(normalized) ? normalized : null
}

/**
 * Convenience: normalize + validate in one call.
 *
 * @example
 * tryNormalizePhone('+62 812-3456-7890') // → '081234567890'
 * tryNormalizePhone('0212345678')        // → null (landline)
 * tryNormalizePhone('')                  // → null
 */
export function tryNormalizePhone(input: string): string | null {
  return validatePhoneFormat(normalizePhone(input))
}
