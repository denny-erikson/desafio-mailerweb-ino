import { apiClient } from '../../api/client'
import type { CreateRoomPayload, Room, UpdateRoomPayload } from './types'

export async function fetchRooms() {
  const response = await apiClient.get<Room[]>('/rooms')
  return response.data
}

export async function createRoom(payload: CreateRoomPayload) {
  const response = await apiClient.post<Room>('/rooms', payload)
  return response.data
}

export async function updateRoom(roomId: number, payload: UpdateRoomPayload) {
  const response = await apiClient.put<Room>(`/rooms/${roomId}`, payload)
  return response.data
}
