import type { BookingStatus } from '~/types/common'

export interface Booking {
  id: string
  eventId: string
  name: string
  wa: string
  status: BookingStatus
}

export interface BookingFormData {
  name: string
  wa: string
}
