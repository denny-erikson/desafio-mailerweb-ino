import { Route, Routes, useLocation } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BookingFormPage } from './BookingFormPage'
import { renderWithRouter } from '../test/renderWithRouter'
import * as bookingsApi from '../features/bookings/bookingsApi'
import * as roomsApi from '../features/rooms/roomsApi'

function SuccessProbe() {
  const location = useLocation()
  const successMessage =
    (location.state as { successMessage?: string } | null)?.successMessage ?? ''

  return <div>{successMessage || 'Sem mensagem'}</div>
}

function formatLocalInput(date: Date) {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

describe('BookingFormPage', () => {
  beforeEach(() => {
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([
      {
        id: 1,
        name: 'Sala Atlas',
        capacity: 8,
        created_at: '2026-01-01T12:00:00Z',
        updated_at: '2026-01-01T12:00:00Z',
      },
    ])
  })

  it('cria uma reserva com dados válidos', async () => {
    const createBookingSpy = vi
      .spyOn(bookingsApi, 'createBooking')
      .mockResolvedValue({
        id: 1,
        title: 'Planejamento semanal',
        room_id: 1,
        created_by_user_id: 1,
        start_at: '2026-05-10T13:00:00.000Z',
        end_at: '2026-05-10T14:00:00.000Z',
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
      })

    const user = userEvent.setup()
    const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
    startAt.setSeconds(0, 0)
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

    renderWithRouter(
      <Routes>
        <Route path="/bookings/new" element={<BookingFormPage />} />
        <Route path="/bookings" element={<SuccessProbe />} />
      </Routes>,
      { route: '/bookings/new' },
    )

    await screen.findByText('Crie uma nova reserva')

    await user.type(
      screen.getByLabelText(/título/i),
      'Planejamento semanal',
    )
    await user.selectOptions(screen.getByLabelText(/^sala$/i), '1')
    await user.type(screen.getByLabelText(/início/i), formatLocalInput(startAt))
    await user.type(screen.getByLabelText(/fim/i), formatLocalInput(endAt))
    await user.type(screen.getByLabelText(/^e-mail$/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^nome$/i), 'Alice')
    await user.click(screen.getByRole('button', { name: /criar reserva/i }))

    await screen.findByText('Reserva criada com sucesso.')

    expect(createBookingSpy).toHaveBeenCalledWith({
      title: 'Planejamento semanal',
      room_id: 1,
      start_at: new Date(formatLocalInput(startAt)).toISOString(),
      end_at: new Date(formatLocalInput(endAt)).toISOString(),
      participants: [
        {
          email: 'alice@example.com',
          full_name: 'Alice',
        },
      ],
    })
  })

  it('bloqueia reserva com horário no passado', async () => {
    const createBookingSpy = vi.spyOn(bookingsApi, 'createBooking')
    const user = userEvent.setup()
    const startAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
    startAt.setSeconds(0, 0)
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

    renderWithRouter(
      <Routes>
        <Route path="/bookings/new" element={<BookingFormPage />} />
        <Route path="/bookings" element={<SuccessProbe />} />
      </Routes>,
      { route: '/bookings/new' },
    )

    await screen.findByText('Crie uma nova reserva')

    await user.type(screen.getByLabelText(/título/i), 'Reserva passada')
    await user.selectOptions(screen.getByLabelText(/^sala$/i), '1')
    await user.type(screen.getByLabelText(/início/i), formatLocalInput(startAt))
    await user.type(screen.getByLabelText(/fim/i), formatLocalInput(endAt))
    await user.type(screen.getByLabelText(/^e-mail$/i), 'past@example.com')
    await user.click(screen.getByRole('button', { name: /criar reserva/i }))

    expect(createBookingSpy).not.toHaveBeenCalled()
  })

  it('exibe o erro específico de conflito de horário', async () => {
    vi.spyOn(bookingsApi, 'createBooking').mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          detail: 'Booking time conflicts with an existing booking',
        },
      },
    })

    const user = userEvent.setup()
    const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
    startAt.setSeconds(0, 0)
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

    renderWithRouter(
      <Routes>
        <Route path="/bookings/new" element={<BookingFormPage />} />
        <Route path="/bookings" element={<SuccessProbe />} />
      </Routes>,
      { route: '/bookings/new' },
    )

    await screen.findByText('Crie uma nova reserva')

    await user.type(screen.getByLabelText(/título/i), 'Reserva conflitante')
    await user.selectOptions(screen.getByLabelText(/^sala$/i), '1')
    await user.type(screen.getByLabelText(/início/i), formatLocalInput(startAt))
    await user.type(screen.getByLabelText(/fim/i), formatLocalInput(endAt))
    await user.type(screen.getByLabelText(/^e-mail$/i), 'conflict@example.com')
    await user.click(screen.getByRole('button', { name: /criar reserva/i }))

    await screen.findByText(
      'Já existe uma reserva ativa nessa sala para o intervalo informado.',
    )
  })
})
