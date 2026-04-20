import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './features/auth/AuthContext'
import * as authApi from './features/auth/authApi'
import * as bookingsApi from './features/bookings/bookingsApi'
import * as roomsApi from './features/rooms/roomsApi'

describe('App integration flow', () => {
  it('faz login, acessa salas protegidas e cria uma sala', async () => {
    vi.spyOn(authApi, 'loginRequest').mockResolvedValue({
      access_token: 'integration-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: 1,
        email: 'admin@example.com',
        full_name: 'Admin User',
        is_active: true,
      },
    })
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([])
    vi.spyOn(bookingsApi, 'fetchBookings').mockResolvedValue([])
    const createRoomSpy = vi.spyOn(roomsApi, 'createRoom').mockResolvedValue({
      id: 22,
      name: 'Sala Boreal',
      capacity: 14,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@example.com')
    await user.type(screen.getByLabelText(/senha/i), '123456')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await screen.findByRole('heading', { name: 'Visão geral' })

    await user.click(screen.getByRole('link', { name: /^salas$/i }))

    await screen.findByText('Nenhuma sala cadastrada')

    await user.type(screen.getByLabelText(/nome da sala/i), 'Sala Boreal')
    await user.clear(screen.getByLabelText(/capacidade/i))
    await user.type(screen.getByLabelText(/capacidade/i), '14')
    await user.click(screen.getByRole('button', { name: /criar sala/i }))

    await screen.findByText('Sala criada com sucesso.')

    expect(createRoomSpy).toHaveBeenCalledWith({
      name: 'Sala Boreal',
      capacity: 14,
    })
    expect(screen.getByText('Sala Boreal')).toBeInTheDocument()
    expect(
      localStorage.getItem('meeting-room-booking.access-token'),
    ).toBe('integration-token')
  })
})
