import type { EventRepository } from '~/domain/repositories/event-repository'
import { validateImageFile } from '~/utils/file-validation'

/**
 * Use case khusus untuk upload poster event.
 *
 * Security pipeline (Bug #1 hardening):
 * - The client compresses the image via `useImageCompressor` (which
 *   produces a guaranteed `.webp` File). This use case adds a final
 *   server-side check so that even if the client is bypassed (e.g.
 *   via direct API call), the upload still fails closed.
 * - Validates MIME allowlist, size limit, extension, and magic bytes
 *   (rejects SVG / HTML / renamed executables).
 *
 * Note: validation happens in this use case (not the repository) so
 * the repository can stay focused on storage I/O and so the rule is
 * applied regardless of which UI flow calls it.
 */
export class UploadEventImage {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(file: File): Promise<string> {
    if (!file) {
      throw new Error('File gambar tidak ditemukan.')
    }
    // Defense-in-depth: validate again at the use-case boundary.
    // The client compressor already validated, but this guards
    // against direct repository calls and against future client
    // changes that might bypass the compressor.
    await validateImageFile(file)
    return this.eventRepository.uploadImage(file)
  }
}
