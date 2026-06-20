/**
 * SQL LIKE / ILIKE pattern utilities.
 *
 * Bug #7 fix: Pasang helper terpusat untuk escape karakter
 * wildcard `%` dan `_` sehingga input user tidak bisa
 * menyisipkan pattern injection ke query PostgREST `ilike`.
 *
 * Penting: Postgres `ILIKE` memperlakukan `%` sebagai "any sequence"
 * dan `_` sebagai "any single character". Jika user mengirim
 * `%` atau `_` di input search, mereka bisa mendapat hasil
 * yang tidak terduga (atau bahkan probing data sensitif).
 *
 * Cara kerja escape:
 * - Postgres menerima pola `\%` untuk mencocokkan literal `%`
 * - Default escape character adalah `\`
 * - Kita gunakan `\\` di JS string untuk menghasilkan `\` di SQL
 *
 * @example
 * escapeLikePattern('50%')     // → '50\\%'
 * escapeLikePattern('john_doe') // → 'john\\_doe'
 * escapeLikePattern('hello')   // → 'hello'
 *
 * Untuk dipakai dalam template ILIKE:
 * const pattern = `%${escapeLikePattern(term)}%`
 * query.or(`title.ilike.${pattern}`)
 */
export function escapeLikePattern(input: string): string {
  // Escape backslash dulu, baru escape % dan _.
  // Urutan penting: jika kita escape %/_ dulu, backslash yang
  // kita tambahkan akan ter-escape juga oleh langkah berikutnya.
  return input.replace(/[\\%_]/g, (match) => `\\${match}`)
}

/**
 * Build ILIKE pattern dengan wildcard % di kedua sisi.
 * Otomatis escape karakter spesial dari user input.
 *
 * @example
 * buildIlikePattern('test')        // → '%test%'
 * buildIlikePattern('50%')         // → '%50\\%%'
 * buildIlikePattern('a_b')         // → '%a\\_b%'
 * buildIlikePattern('  hello  ')   // → '%hello%' (trim dulu di caller)
 */
export function buildIlikePattern(input: string): string {
  const escaped = escapeLikePattern(input.trim())
  return `%${escaped}%`
}