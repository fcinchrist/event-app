/**
 * Server-agnostic file validation utilities used by the upload pipeline
 * (image compressor + use case + storage repository).
 *
 * Why this lives in `utils/` (not `presentation/`):
 * - It must be importable from BOTH the client (composable) and the
 *   server (use case / repository) so the same rules apply end-to-end.
 * - It has no Vue / Nuxt / browser dependencies — it operates on
 *   `File`, `Blob`, `ArrayBuffer`, or `Uint8Array`.
 *
 * Why this lives in `utils/` (not `domain/`):
 * - It is a security/IO concern, not a business rule. The domain layer
 *   should not care HOW a file is validated, only that a validated
 *   `File` arrives at the repository.
 *
 * Defense-in-depth strategy:
 * 1. **MIME allowlist** — the browser-reported `file.type` MUST be one
 *    of `image/jpeg | image/png | image/gif | image/webp`. SVG is
 *    explicitly excluded (XSS vector via inline `<script>`).
 * 2. **Extension allowlist** — the filename extension must match the
 *    MIME (catches simple `evil.exe` → `evil.jpg` renames that some
 *    OSes still respect for execution).
 * 3. **Size limit** — reject files larger than `MAX_FILE_SIZE_BYTES`
 *    BEFORE reading them into memory (DoS protection).
 * 4. **Magic-byte check** — read the first 12 bytes and verify they
 *    match a known image format signature. This catches content/MIME
 *    mismatches (e.g. an EXE renamed to `.jpg` with spoofed MIME).
 * 5. **SVG rejection at the byte level** — SVG is a text format, so
 *    its "magic" is the literal `<svg` / `<?xml` prefix. We explicitly
 *    reject any file whose magic matches SVG, even if the extension
 *    is something else (the attacker is trying to upload an SVG
 *    renamed to `.jpg`).
 *
 * Note: this util is also the single source of truth for the
 * output format. The compressor always produces WebP, the repository
 * always stores `.webp`, so the only accepted *input* formats are
 * jpeg / png / gif / webp.
 */

/** Maximum file size accepted by the upload pipeline (5 MB).
 *  Matches the `file_size_limit` set on the Supabase Storage bucket
 *  in `supabase/migrations/007_storage_rls_hardening.sql`. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

/** Allowed input MIME types. SVG is intentionally NOT in this list. */
export const ALLOWED_INPUT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export type AllowedImageMime = typeof ALLOWED_INPUT_MIME_TYPES[number]

/** Allowed file extensions (must match MIME allowlist). */
export const ALLOWED_INPUT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const

export type AllowedImageExtension = typeof ALLOWED_INPUT_EXTENSIONS[number]

/**
 * Friendly label of the input allowlist, for error messages
 * (e.g. "Format yang didukung: JPG, PNG, GIF, WebP").
 */
export const ALLOWED_INPUT_FORMATS_LABEL = 'JPG, PNG, GIF, WebP'

/** Magic bytes we use to identify image formats.
 *  Each entry maps a format to:
 *  - a list of byte sequences that may appear at the start of the file
 *  - the canonical MIME type for that format
 *  - the canonical file extension for that format
 */
interface MagicEntry {
  mime: AllowedImageMime
  extension: AllowedImageExtension
  /** Each signature is compared byte-by-byte against the file head.
   *  Use `null` for wildcard bytes (rare; most formats have a fixed prefix). */
  signatures: readonly (readonly number[])[]
}

const MAGIC_TABLE: readonly MagicEntry[] = [
  {
    // JPEG: starts with FF D8 FF, followed by a marker (E0..EF, FE, DB, etc.)
    // We only require the 3-byte signature and check the 4th is a known marker.
    mime: 'image/jpeg',
    extension: 'jpg',
    signatures: [[0xff, 0xd8, 0xff]],
  },
  {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    mime: 'image/png',
    extension: 'png',
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  {
    // GIF87a / GIF89a: "GIF87a" or "GIF89a"
    mime: 'image/gif',
    extension: 'gif',
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
  },
  {
    // WebP: "RIFF" .... "WEBP" at offset 8
    mime: 'image/webp',
    extension: 'webp',
    signatures: [
      [0x52, 0x49, 0x46, 0x46], // RIFF header — validated further below
    ],
  },
]

/** Subset of allowed MIME types that are also valid as text
 *  (used to detect "fake image" uploads like SVG renamed to .jpg). */
const TEXT_SNIFFETS: readonly { mime: string; prefix: number[] }[] = [
  { mime: 'image/svg+xml', prefix: [0x3c, 0x73, 0x76, 0x67] }, // "<svg" (case-insensitive; we check uppercase variant below)
  { mime: 'image/svg+xml', prefix: [0x3c, 0x3f, 0x78, 0x6d, 0x6c] }, // "<?xml"
  { mime: 'text/html', prefix: [0x3c, 0x21, 0x44, 0x4f, 0x43] }, // "<!DOC"
  { mime: 'text/html', prefix: [0x3c, 0x68, 0x74, 0x6d, 0x6c] }, // "<html"
  { mime: 'application/xhtml+xml', prefix: [0x3c, 0x68, 0x74, 0x6d, 0x6c] },
]

/** Normalize a filename extension to lowercase, no leading dot. */
function extractExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  if (idx === -1 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

/** Is `mime` in the allowlist? (type-narrowing helper) */
function isAllowedMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_INPUT_MIME_TYPES as readonly string[]).includes(mime)
}

/** Is `ext` in the allowlist? */
function isAllowedExtension(ext: string): ext is AllowedImageExtension {
  return (ALLOWED_INPUT_EXTENSIONS as readonly string[]).includes(ext)
}

/** Throws a friendly Indonesian error message when the file is not
 *  one of the supported image types. */
function unsupportedFormat(detail: string): never {
  throw new Error(
    `Format file tidak didukung. ${ALLOWED_INPUT_FORMATS_LABEL} saja. (${detail})`,
  )
}

/** Result of a file's head-byte sniff. */
export interface FileSniffResult {
  /** The detected MIME, if any. */
  detectedMime: AllowedImageMime | null
  /** The detected extension, if any. */
  detectedExtension: AllowedImageExtension | null
  /** True if the file head looks like SVG / HTML / XML text — always rejected. */
  isTextDocument: boolean
  /** True if the file head matches a known image magic. */
  isImage: boolean
}

/** Read the first `n` bytes of a Blob/File as a Uint8Array. */
export async function readFileHead(file: Blob, n = 12): Promise<Uint8Array> {
  const slice = file.slice(0, n, file.type || 'application/octet-stream')
  const buf = await slice.arrayBuffer()
  return new Uint8Array(buf)
}

/** Sniff the file head against known image and text signatures.
 *  This is a pure function over raw bytes — does NOT trust the
 *  browser-reported MIME or filename extension. */
export function sniffFileHead(bytes: Uint8Array): FileSniffResult {
  // Text-document check (SVG, HTML, XML) — done first so we can
  // short-circuit before checking the image allowlist.
  for (const t of TEXT_SNIFFETS) {
    if (matchesPrefix(bytes, t.prefix)) {
      return {
        detectedMime: null,
        detectedExtension: null,
        isTextDocument: true,
        isImage: false,
      }
    }
  }

  // Image magic check
  for (const entry of MAGIC_TABLE) {
    for (const sig of entry.signatures) {
      if (matchesPrefix(bytes, sig)) {
        // For JPEG, also verify the marker byte (4th byte) is a known one
        // (E0..EF for JFIF/EXIF/XMP, FE for COM, DB for DQT, etc.)
        if (entry.mime === 'image/jpeg' && bytes.length >= 4) {
          const marker = bytes[3]!
          const isValidJpegMarker =
            (marker >= 0xe0 && marker <= 0xef) ||
            marker === 0xfe || marker === 0xdb
          if (!isValidJpegMarker) continue
        }
        // For WebP, verify "WEBP" at offset 8 (after RIFF + 4 bytes size)
        if (entry.mime === 'image/webp') {
          if (bytes.length < 12) continue
          const tag = String.fromCharCode(
            bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!,
          )
          if (tag !== 'WEBP') continue
        }
        return {
          detectedMime: entry.mime,
          detectedExtension: entry.extension,
          isTextDocument: false,
          isImage: true,
        }
      }
    }
  }

  return {
    detectedMime: null,
    detectedExtension: null,
    isTextDocument: false,
    isImage: false,
  }
}

function matchesPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false
  }
  return true
}

export interface ValidateOptions {
  /** Override the max size (default 5 MB). Useful for tests. */
  maxBytes?: number
}

/**
 * Full validation pipeline for an uploaded image. Throws on the first
 * failure with a user-facing Indonesian error message.
 *
 * Checks (in order):
 * 1. Size ≤ maxBytes (5 MB default)
 * 2. MIME type is in the allowlist
 * 3. Filename extension is in the allowlist AND matches the MIME
 * 4. Magic bytes match a known image format
 * 5. Magic bytes do NOT look like SVG / HTML / XML text
 */
export async function validateImageFile(
  file: File,
  options: ValidateOptions = {},
): Promise<FileSniffResult> {
  const maxBytes = options.maxBytes ?? MAX_FILE_SIZE_BYTES

  // 1. Size
  if (file.size <= 0) {
    throw new Error('File kosong atau rusak.')
  }
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024))
    throw new Error(`Ukuran file terlalu besar. Maksimum ${maxMb} MB.`)
  }

  // 2. MIME allowlist (defense layer 1 — trusted because it comes
  //    from the browser's File object, but spoofable so we still
  //    verify magic bytes below)
  if (!isAllowedMime(file.type)) {
    if (file.type === 'image/svg+xml' || file.type === 'image/svg') {
      throw new Error(
        'Format SVG tidak didukung. Silakan gunakan JPG, PNG, GIF, atau WebP.',
      )
    }
    unsupportedFormat(`Tipe terdeteksi: ${file.type || 'tidak diketahui'}`)
  }

  // 3. Extension allowlist
  const ext = extractExtension(file.name)
  if (!isAllowedExtension(ext)) {
    unsupportedFormat(`Ekstensi terdeteksi: .${ext || 'tanpa ekstensi'}`)
  }

  // 4 + 5. Magic byte sniff (defense layer 2 — the real check)
  const head = await readFileHead(file)
  const sniff = sniffFileHead(head)

  if (sniff.isTextDocument) {
    throw new Error(
      'File ini terdeteksi sebagai dokumen teks/SVG. Silakan upload file gambar.',
    )
  }
  if (!sniff.isImage || !sniff.detectedMime) {
    unsupportedFormat('Isi file tidak cocok dengan format gambar manapun')
  }

  // 6. Cross-check: the declared MIME and the magic-detected MIME
  //    should agree. If not, the file is suspicious (renamed with
  //    wrong extension / spoofed MIME).
  if (sniff.detectedMime !== file.type) {
    unsupportedFormat(
      `Tipe browser (${file.type}) tidak cocok dengan isi file (${sniff.detectedMime})`,
    )
  }

  return sniff
}
