import type { Registration } from '~/domain/entities/registration'
import type { EventRepository } from '~/domain/repositories/event-repository'
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
 *   2. Validasi event ada & tanggalnya belum lewat
 *   3. Cari user existing berdasarkan no HP
 *   4. Kalau belum ada → buat user baru (nama wajib dari input)
 *   5. Cek existing registration (userId, eventId)
 *   6. Kalau sudah ada → throw "Anda sudah terdaftar di event ini"
 *   7. Insert registrasi baru
 *
 * Validasi tanggal event dilakukan di sini (bukan hanya di form)
 * supaya pengecekan tetap authoritative walau UI di-bypass (mis.
 * request manual via DevTools / integrasi pihak ketiga).
 */
export class BookEvent {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly registrationRepository: RegistrationRepository,
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(input: BookEventInput, now: Date = new Date()): Promise<Registration> {
    const noHp = normalizePhone(input.noHp)
    if (!noHp) {
      throw new Error('Nomor HP tidak valid.')
    }
    if (!input.eventId) {
      throw new Error('Event tidak valid.')
    }

    // 1. Validasi event: harus ada, status Aktif, dan tanggal belum lewat.
    //    Bandingkan pada level "hari" (YYYY-MM-DD) supaya event yang
    //    berlangsung di hari ini masih bisa di-book sampai jam mulai.
    const event = await this.eventRepository.getById(input.eventId)
    if (!event) {
      throw new Error('Event tidak ditemukan.')
    }
    if (event.status === 'Dibatalkan') {
      throw new Error('Event ini sudah dibatalkan.')
    }
    if (event.status === 'Selesai') {
      throw new Error('Event ini sudah ditutup.')
    }
    const todayStr = now.toISOString().slice(0, 10)
    const eventDateStr = event.date.slice(0, 10)
    if (eventDateStr < todayStr) {
      throw new Error('Maaf, event ini sudah lewat dan tidak bisa di-booking lagi.')
    }

    // 2. Cari atau buat user
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

    // 3. Cek duplikat registration
    const existing = await this.registrationRepository.findByUserAndEvent(
      user.id,
      input.eventId,
    )
    if (existing) {
      throw new Error('Nomor HP ini sudah terdaftar di event ini.')
    }

    // 4. Insert
    return this.registrationRepository.create({
      userId: user.id,
      eventId: input.eventId,
    })
  }
}
