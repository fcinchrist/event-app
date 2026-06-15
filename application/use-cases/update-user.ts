import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

export class UpdateUser {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Update data master user (dipakai dari dashboard admin).
   *
   * - noHp akan dinormalisasi sebelum dikirim ke repository.
   * - userStatus & memberType di-pass-through apa adanya (sudah tervalidasi
   *   di UI melalui dropdown dengan opsi terbatas).
   *
   * Melempar Error jika id tidak ditemukan, noHp tidak valid, atau noHp
   * sudah dipakai user lain (unique_violation).
   */
  async execute(id: string, input: EventUserFormData): Promise<EventUser> {
    if (!id) {
      throw new Error('ID user tidak valid.')
    }
    const noHp = normalizePhone(input.noHp)
    if (!noHp) {
      throw new Error('Nomor HP tidak valid.')
    }
    const nama = input.nama?.trim() ?? ''
    if (nama.length < 2) {
      throw new Error('Nama minimal 2 karakter.')
    }
    return this.userRepository.update(id, {
      noHp,
      nama,
      userStatus: input.userStatus,
      memberType: input.memberType,
    })
  }
}
