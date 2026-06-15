/**
 * Normalize a phone number into the consistent format '08123456789':
 * - Strip every non-digit character (spaces, dashes, parentheses, '+')
 * - If it starts with '62' (Indonesia country code), rewrite it to '0'
 * - Validation: the resulting length must be 10–15 digits
 *
 * Returns `null` when the input is invalid (empty string or a result
 * whose length falls outside the allowed range).
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null

  // Strip every non-digit character
  let digits = input.replace(/\D/g, '')

  // Convert the '62' (country code) prefix to '0'
  if (digits.startsWith('62') && digits.length > 2) {
    digits = '0' + digits.slice(2)
  }

  // Validate the length
  if (digits.length < 10 || digits.length > 15) {
    return null
  }

  return digits
}
