import type { EventRepository } from '~/domain/repositories/event-repository'

/**
 * Use case khusus untuk upload poster event.
 * File input diasumsikan sudah di-compress ke WebP oleh caller
 * (lihat composable `useImageCompressor`) sebelum sampai sini.
 */
export class UploadEventImage {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(file: File): Promise<string> {
    if (!file) {
      throw new Error('File gambar tidak ditemukan.')
    }
    return this.eventRepository.uploadImage(file)
  }
}
