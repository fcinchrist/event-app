import type { EventUser, EventUserFormData } from '~/domain/entities/event-user'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

export class RegisterUser {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Buat user baru. Input noHp akan dinormalisasi dulu.
   *
   * Default: `userStatus = 'active'` dan `memberType = 'internal'`
   * untuk seluruh alur pendaftaran publik — sesuai DEFAULT di
   * migration 004. Caller boleh override dengan mengirim input
   * yang sudah lengkap (mis. admin membuat user baru dari dashboard).
   *
   * Melempar Error kalau noHp tidak valid, nama kosong, atau noHp
   * sudah dipakai user lain.
   */
  async execute(input: EventUserFormData): Promise<EventUser> {
    const noHp = normalizePhone(input.noHp)
    if (!noHp) {
      throw new Error('Nomor HP tidak valid.')
    }
    const nama = input.nama?.trim() ?? ''
    if (nama.length < 2) {
      throw new Error('Nama minimal 2 karakter.')
    }
    return this.userRepository.create({
      noHp,
      nama,
      // Fall back to safe defaults. Memastikan baris baru selalu punya
      // status aktif + tipe internal, sehingga konsistensi dengan
      // DEFAULT migration 004 terjaga walau caller tidak mengirim
      // field ini (mis. form booking publik).
      userStatus: input.userStatus ?? 'active',
      memberType: input.memberType ?? 'internal',
    })
  }
}
