import type { EventUser } from '~/domain/entities/event-user'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

/**
 * Cari user berdasarkan nomor HP.
 *
 * - Input noHp bebas format ('+62 812...', '0812-...', '0812...' dst).
 * - Output selalu ternormalisasi (digits only, awalan 0).
 * - Return null kalau input invalid ATAU user tidak ditemukan.
 *
 * Dipakai oleh form booking publik untuk autofill field nama.
 */
export class FindUserByPhone {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(rawPhone: string): Promise<EventUser | null> {
    const normalized = normalizePhone(rawPhone)
    if (!normalized) return null
    return this.userRepository.findByPhone(normalized)
  }
}
