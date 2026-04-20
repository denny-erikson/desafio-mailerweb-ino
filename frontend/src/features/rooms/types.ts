export type Room = {
  id: number
  name: string
  capacity: number
  created_at: string
  updated_at: string
}

export type CreateRoomPayload = {
  name: string
  capacity: number
}

export type UpdateRoomPayload = CreateRoomPayload
