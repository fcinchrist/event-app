import type { EventStatusValue } from '~/types/common'

export interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  quota: number
  image: string
  status: EventStatusValue
  // Optional reference to a master category. `null` means
  // "uncategorized". The actual category name is resolved at the
  // presentation layer via the category store; the domain only
  // carries the foreign key.
  categoryId: string | null
  createdAt: string
  updatedAt: string
}

export interface EventFormData {
  title: string
  date: string
  quota: number | string
  location: string
  image: string
  description: string
  // Use empty string in the form state to mean "no category" so the
  // Add/Edit modal can keep a single `<select>` with a placeholder
  // option. Convert `''` to `null` when building the payload.
  categoryId: string | null
}
