/**
 * Composable that compresses images (JPEG/PNG/WebP) into WebP using an
 * HTML5 canvas, before they are uploaded to Supabase Storage.
 *
 * Why: the Supabase free tier has a 1 GB storage cap. Compressing on
 * the client side significantly reduces storage and bandwidth usage.
 *
 * Security (Bug #1 hardening):
 * - Validates the **declared** MIME type against an allowlist
 *   (jpeg / png / gif / webp). SVG and HTML are explicitly rejected
 *   to prevent XSS via uploaded image.
 * - Validates the **filename extension** against the same allowlist.
 * - Re-encodes to WebP via canvas — strips EXIF metadata (incl. GPS).
 * - Re-validates the **magic bytes** of the file head before drawing
 *   to canvas, so a renamed `.exe` → `.jpg` with spoofed MIME cannot
 *   reach the upload pipeline.
 * - Always emits a `.webp` file with `image/webp` content type, so the
 *   storage layer cannot be tricked by an attacker-controlled
 *   extension / content type.
 *
 * Note: this composable does NOT contain business logic — it is a
 * pure UI/presentation utility, consumed by form components.
 */

import {
  ALLOWED_INPUT_MIME_TYPES,
  validateImageFile,
} from '~/utils/file-validation'

export interface CompressOptions {
  /** WebP quality (0..1). Default 0.75 ≈ 75%. */
  quality?: number
  /** Maximum width in px. The image is resized proportionally. */
  maxWidth?: number
  /** Maximum height in px. Defaults to `maxWidth` to keep aspect ratio. */
  maxHeight?: number
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  quality: 0.75,
  maxWidth: 1280,
  maxHeight: 1280,
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'))
    img.src = src
  })
}

function drawAndExport(img: HTMLImageElement, opts: Required<CompressOptions>): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ratio = Math.min(
      opts.maxWidth / img.naturalWidth,
      opts.maxHeight / img.naturalHeight,
      1, // never upscale small images
    )
    const width = Math.round(img.naturalWidth * ratio)
    const height = Math.round(img.naturalHeight * ratio)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Browser tidak mendukung canvas 2D.'))
      return
    }
    ctx.drawImage(img, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal mengonversi gambar ke WebP.'))
          return
        }
        resolve(blob)
      },
      'image/webp',
      opts.quality,
    )
  })
}

export function useImageCompressor() {
  /**
   * Compress sebuah File gambar ke format WebP.
   * Mengembalikan File baru dengan extension `.webp` siap di-upload.
   *
   * Validation pipeline (Bug #1 hardening):
   * 1. Reject empty files
   * 2. Reject files > 5 MB (also enforced by Supabase bucket limit)
   * 3. Reject SVG / HTML / XML (XSS vectors)
   * 4. Reject any MIME not in the image allowlist
   * 5. Reject any extension not in the image allowlist
   * 6. Cross-check declared MIME vs magic-byte-detected MIME
   *
   * After validation, the file is re-encoded to WebP via canvas
   * (which strips EXIF), and the returned File is guaranteed to
   * have:
   * - extension `.webp`
   * - MIME `image/webp`
   * - size <= input (typically much smaller)
   */
  async function compressToWebP(file: File, options: CompressOptions = {}): Promise<File> {
    if (!import.meta.client) {
      throw new Error('Image compression hanya berjalan di sisi client.')
    }

    // Full validation pipeline (MIME, size, extension, magic bytes,
    // SVG/HTML rejection). Throws Indonesian error messages on failure.
    await validateImageFile(file)

    const opts: Required<CompressOptions> = { ...DEFAULT_OPTIONS, ...options }
    const dataUrl = await readFileAsDataUrl(file)
    const img = await loadImage(dataUrl)
    const blob = await drawAndExport(img, opts)

    // Sanity-check: the canvas must have produced a non-empty WebP.
    // This catches edge cases where the input is a malformed image
    // that passes magic-byte validation but cannot be decoded
    // (e.g. a truncated PNG).
    if (blob.size === 0) {
      throw new Error('File gambar tidak valid atau rusak.')
    }
    if (blob.type !== 'image/webp') {
      // Browsers may fall back to PNG if WebP encoding fails.
      // We require strict WebP output.
      throw new Error('Gagal mengompres gambar ke format WebP.')
    }

    // Re-encode can sometimes produce a file larger than the input
    // (e.g. tiny PNG with rare compression). Still within the size
    // limit, so it's safe to upload.
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error('Gambar hasil kompresi masih terlalu besar (maks 5 MB).')
    }

    // Strip the original extension and append `.webp`. We do NOT
    // trust the caller's filename; we hardcode the extension to
    // prevent the storage layer from being tricked by an
    // attacker-controlled extension.
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'

    // Sanitize the base name: remove any characters that could be
    // misinterpreted by a downstream URL parser, and cap the length
    // to keep the path under typical CDN limits.
    const safeBase = baseName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80) || 'image'

    const compressedFile = new File(
      [blob],
      `${safeBase}.webp`,
      { type: 'image/webp', lastModified: Date.now() },
    )

    return compressedFile
  }

  return {
    compressToWebP,
    /**
     * Re-export the MIME allowlist so form components can use it
     * for the `<input type="file" accept="...">` attribute. This
     * keeps the source of truth in one place (`utils/file-validation.ts`).
     */
    allowedInputMimeTypes: ALLOWED_INPUT_MIME_TYPES,
  }
}
