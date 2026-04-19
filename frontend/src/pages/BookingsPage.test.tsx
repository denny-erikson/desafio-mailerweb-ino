import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingsPage } from './BookingsPage'
import { renderWithRouter } from '../test/renderWithRouter'
import * as bookingsApi from '../features/bookings/bookingsApi'
import * as roomsApi from '../features/rooms/roomsApi'

describe('BookingsPage', () => {
  it('carrega reservas e exibe o nome da sala', async () => {
    vi.spyOn(bookingsApi, 'fetchBookings').mockResolvedValue([
      {
        id: 10,
        title: 'Daily de produto',
        room_id: 1,
        created_by_user_id: 7,
        start_at: '2026-05-10T13:00:00Z',
        end_at: '2026-05-10T14:00:00Z',
        status: 'ACTIVE',
        canceled_at: null,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
        participants: [
          {
            id: 1,
            email: 'alice@example.com',
            full_name: 'Alice',
            created_at: '2026-05-01T10:00:00Z',
          },
        ],
      },
    ])
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([
      {
        id: 1,
        name: 'Sala Atlas',
        capacity: 8,
        created_at: '2026-01-01T12:00:00Z',
        updated_at: '2026-01-01T12:00:00Z',
      },
    ])

    renderWithRouter(<BookingsPage />, { route: '/bookings' })

    await screen.findByText('Daily de produto')

    expect(screen.getByText('Sala Atlas')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Ativa')).toBeInTheDocument()
  })
})
