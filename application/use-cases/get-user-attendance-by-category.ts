import type { UserRepository, CategoryAttendanceStat } from '~/domain/repositories/user-repository'

export class GetUserAttendanceByCategory {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Statistik kehadiran seorang user, dikelompokkan per kategori event.
   *
   * - `year` = null → seluruh tahun (lifetime)
   * - `year` = number → filter event yang tanggalnya di tahun tersebut
   *
   * Tahun dihitung dari `event.date` (bukan `registered_at`) karena
   * event adalah timeline utamanya: "kehadiran tahun 2025" berarti
   * "event yang berlangsung di tahun 2025".
   */
  async execute(
    userId: string,
    year: number | null,
  ): Promise<CategoryAttendanceStat[]> {
    if (!userId) {
      throw new Error('ID user tidak valid.')
    }
    return this.userRepository.getStatsByCategory(userId, year)
  }
}
