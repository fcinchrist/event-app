import type { UserRepository } from '~/domain/repositories/user-repository'

export class DeleteUser {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Hapus user berdasarkan ID. Relasi `event_registrations` ter-cascade
   * (lihat migration 002: `on delete cascade`), jadi use case ini
   * juga otomatis menghapus semua data kehadiran user tersebut.
   *
   * Melempar Error jika id tidak ditemukan / tidak valid.
   */
  async execute(id: string): Promise<void> {
    if (!id) {
      throw new Error('ID user tidak valid.')
    }
    await this.userRepository.delete(id)
  }
}
