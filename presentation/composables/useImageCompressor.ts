/**
 * Composable untuk mengompres gambar (JPEG/PNG/WebP) ke format WebP
 * dengan canvas HTML5, sebelum di-upload ke Supabase Storage.
 *
 * Tujuan: Supabase free-tier memiliki batas storage 1 GB.
 * Mengompres di sisi client membantu menekan penggunaan storage
 * dan bandwidth secara signifikan.
 *
 * Catatan: composable ini TIDAK mengandung business logic –
 * hanya utilitas UI/presentation. Dipakai dari komponen form.
 */

export interface CompressOptions {
  /** Kualitas WebP (0..1). Default 0.75 ≈ 75%. */
  quality?: number
  /** Lebar maksimum (px). Gambar akan di-resize proporsional. */
  maxWidth?: number
  /** Tinggi maksimum (px). Default = maxWidth untuk konsistensi rasio. */
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
      1, // jangan upscale gambar kecil
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
   * Mengembalikan File baru dengan extension .webp siap di-upload.
   */
  async function compressToWebP(file: File, options: CompressOptions = {}): Promise<File> {
    if (!import.meta.client) {
      throw new Error('Image compression hanya berjalan di sisi client.')
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('File yang dipilih bukan gambar.')
    }

    const opts: Required<CompressOptions> = { ...DEFAULT_OPTIONS, ...options }
    const dataUrl = await readFileAsDataUrl(file)
    const img = await loadImage(dataUrl)
    const blob = await drawAndExport(img, opts)

    const baseName = file.name.replace(/\.[^.]+$/, '')
    const compressedFile = new File(
      [blob],
      `${baseName}.webp`,
      { type: 'image/webp', lastModified: Date.now() },
    )

    return compressedFile
  }

  return { compressToWebP }
}
