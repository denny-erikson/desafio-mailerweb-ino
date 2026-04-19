export type BookingParticipant = {
  id: number
  email: string
  full_name: string | null
  created_at: string
}

export type Booking = {
  id: number
  title: string
  room_id: number
  created_by_user_id: number
  start_at: string
  end_at: string
  status: 'ACTIVE' | 'CANCELED'
  canceled_at: string | null
  created_at: string
  updated_at: string
  participants: BookingParticipant[]
}
