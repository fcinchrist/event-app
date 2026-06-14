export interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  quota: number
  image: string
}

export interface EventFormData {
  title: string
  date: string
  quota: number | string
  location: string
  image: string
  description: string
}
