/**
 * Normalisasi nomor HP ke format konsisten '08123456789':
 * - Buang semua non-digit (spasi, dash, parentheses, '+')
 * - Kalau mulai dengan '62' (kode negara Indonesia), ganti ke '0'
 * - Validasi: panjang hasil harus 10-15 digit
 *
 * Return null kalau input tidak valid (bukan string kosong, atau
 * panjang hasil di luar range).
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null

  // Buang semua non-digit
  let digits = input.replace(/\D/g, '')

  // Konversi prefix '62' (kode negara) ke '0'
  if (digits.startsWith('62') && digits.length > 2) {
    digits = '0' + digits.slice(2)
  }

  // Validasi panjang
  if (digits.length < 10 || digits.length > 15) {
    return null
  }

  return digits
}
