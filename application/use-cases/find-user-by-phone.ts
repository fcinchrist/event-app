import type { EventUserPublicSummary } from '~/domain/entities/event-user'
import type { UserRepository } from '~/domain/repositories/user-repository'
import { normalizePhone } from '~/application/use-cases/normalize-phone'

/**
 * Public-safe phone lookup. Returns only `{ id, nama }` — never the phone
 * number, address, or other PII. Safe to call from the booking form.
 */
export class FindUserByPhone {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(rawPhone: string): Promise<EventUserPublicSummary | null> {
    const normalized = normalizePhone(rawPhone)
    if (!normalized) return null
    return this.userRepository.findByPhonePublic(normalized)
  }
}
