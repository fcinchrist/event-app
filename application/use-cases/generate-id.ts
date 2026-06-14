/**
 * Generator ID custom untuk tabel yang tidak pakai UUID Supabase.
 * Format: 'PREFIX-YYYY-NNNNN' di mana:
 *   - PREFIX: 'USR' untuk event_users, 'REG' untuk event_registrations
 *   - YYYY: tahun 4 digit
 *   - NNNNN: 5 digit urut random (range 10000-99999)
 *
 * generateUniqueId(prefix) menerima callback `exists(id)` yang return
 * true kalau ID sudah dipakai. Generator akan retry sampai 10x
 * sebelum melempar Error. Untuk traffic rendah-menengah, probabilitas
 * collision dalam 1 tahun sangat kecil (~rendah pada 90k slot).
 */

const MAX_RETRIES = 10

function currentYear(): number {
  return new Date().getFullYear()
}

function randomFiveDigits(): string {
  return String(Math.floor(10000 + Math.random() * 90000))
}

export async function generateUniqueId(
  prefix: 'USR' | 'REG',
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
    `Gagal generate ID unik ${prefix}-${year}-xxxxx setelah ${MAX_RETRIES} percobaan.`,
  )
}
