/**
 * Generator for custom string IDs used by tables that don't rely on
 * the Supabase default UUID. Format: `PREFIX-YYYY-NNNNN` where:
 *   - PREFIX: short tag identifying the table
 *     (`USR` for `event_users`, `REG` for `event_registrations`,
 *      `CAT` for `event_categories`)
 *   - YYYY:  4-digit year
 *   - NNNNN: 5 random digits (range 10000-99999)
 *
 * `generateUniqueId(prefix, exists)` accepts a callback that returns
 * `true` when the candidate ID is already taken. The generator
 * retries up to 10 times before throwing. For low-to-medium traffic,
 * the collision probability within a single year is negligible
 * (~90k slots per prefix).
 */

const MAX_RETRIES = 10

function currentYear(): number {
  return new Date().getFullYear()
}

function randomFiveDigits(): string {
  return String(Math.floor(10000 + Math.random() * 90000))
}

export type IdPrefix = 'USR' | 'REG' | 'CAT'

export async function generateUniqueId(
  prefix: IdPrefix,
  exists: (id: string) => Promise<boolean>,
): Promise<string> {
  const year = currentYear()
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const candidate = `${prefix}-${year}-${randomFiveDigits()}`
    // eslint-disable-next-line no-await-in-loop
    const taken = await exists(candidate)
    if (!taken) return candidate
  }
  throw new Error(
    `Failed to generate a unique ID ${prefix}-${year}-xxxxx after ${MAX_RETRIES} attempts.`,
  )
}
