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
}
