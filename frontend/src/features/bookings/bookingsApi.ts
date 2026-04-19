import { apiClient } from '../../api/client'
import type { Booking } from './types'

export async function fetchBookings() {
  const response = await apiClient.get<Booking[]>('/bookings')
  return response.data
}
