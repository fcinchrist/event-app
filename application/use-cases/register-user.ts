import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

export class RegisterUser {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Buat user baru. Input noHp akan dinormalisasi dulu.
   * Melempar Error kalau noHp tidak valid atau sudah dipakai.
   */
  async execute(input: EventUserFormData): Promise<EventUser> {
    const noHp = normalizePhone(input.noHp)
    if (!noHp) {
      throw new Error('Nomor HP tidak valid.')
    }
    if (!input.nama || input.nama.trim().length < 2) {
      throw new Error('Nama minimal 2 karakter.')
    }
    return this.userRepository.create({ noHp, nama: input.nama.trim() })
  }
}
