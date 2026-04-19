import { apiClient } from '../../api/client'
import type { Room } from './types'

export async function fetchRooms() {
  const response = await apiClient.get<Room[]>('/rooms')
  return response.data
}
