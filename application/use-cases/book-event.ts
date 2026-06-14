import type { Registration } from '~/domain/entities/registration'
import type { RegistrationRepository } from '~/domain/repositories/registration-repository'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

export interface BookEventInput {
  noHp: string
  nama?: string
  eventId: string
}

/**
 * Orkestrasi alur booking event publik:
 *   1. Normalisasi no HP
 *   2. Cari user existing berdasarkan no HP
 *   3. Kalau belum ada → buat user baru (nama wajib dari input)
 *   4. Cek existing registration (userId, eventId)
 *   5. Kalau sudah ada → throw "Anda sudah terdaftar di event ini"
 *   6. Insert registrasi baru
 *
 * Use case ini mengasumsikan event quota & tanggal sudah divalidasi
 * di lapisan presentasi / komponen form (tampilkan pesan "penuh"
 * atau "sudah lewat" sebelum panggil).
 */
export class BookEvent {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly registrationRepository: RegistrationRepository,
  ) {}

  async execute(input: BookEventInput): Promise<Registration> {
    const noHp = normalizePhone(input.noHp)
    if (!noHp) {
      throw new Error('Nomor HP tidak valid.')
    }
    if (!input.eventId) {
      throw new Error('Event tidak valid.')
    }

    // 1. Cari atau buat user
    let user = await this.userRepository.findByPhone(noHp)
    if (!user) {
      if (!input.nama || input.nama.trim().length < 2) {
        throw new Error(
          'Nomor HP belum pernah terdaftar. Mohon isi nama Anda.',
        )
      }
      user = await this.userRepository.create({
        noHp,
        nama: input.nama.trim(),
      })
    }

    // 2. Cek duplikat registration
    const existing = await this.registrationRepository.findByUserAndEvent(
      user.id,
      input.eventId,
    )
    if (existing) {
      throw new Error('Nomor HP ini sudah terdaftar di event ini.')
    }

    // 3. Insert
    return this.registrationRepository.create({
      userId: user.id,
      eventId: input.eventId,
    })
  }
}
