import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { fetchBookings } from '../features/bookings/bookingsApi'
import type { Booking } from '../features/bookings/types'
import { fetchRooms } from '../features/rooms/roomsApi'
import type { Room } from '../features/rooms/types'

function getBookingsErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.detail ??
      'Nao foi possivel carregar as reservas no momento.'
    )
  }

  return 'Nao foi possivel carregar as reservas no momento.'
}

function formatDateRange(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return `${formatter.format(new Date(startAt))} - ${formatter.format(new Date(endAt))}`
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    Promise.all([fetchBookings(), fetchRooms()])
      .then(([bookingsResponse, roomsResponse]) => {
        if (!isMounted) return
        setBookings(bookingsResponse)
        setRooms(roomsResponse)
        setError('')
      })
      .catch((requestError) => {
        if (!isMounted) return
        setError(getBookingsErrorMessage(requestError))
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const roomNameById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  )

  return (
    <section className="surface-card">
      <div className="section-header">
        <div>
          <div className="status-chip">Reservas</div>
          <h2 className="section-title">Agenda das reservas</h2>
          <p className="section-copy">
            Veja as reunioes cadastradas, seus horarios, participantes e o
            status atual de cada reserva.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="state-card" aria-live="polite">
          <strong>Carregando reservas...</strong>
          <p>Estamos consultando as reservas e cruzando com as salas.</p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="feedback feedback--error" role="alert">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && bookings.length === 0 ? (
        <div className="state-card">
          <strong>Nenhuma reserva cadastrada</strong>
          <p>
            Quando as reservas forem criadas, elas vao aparecer aqui com sala,
            horario e participantes.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && bookings.length > 0 ? (
        <div className="bookings-list">
          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <div className="booking-card__header">
                <div>
                  <div className="booking-status-row">
                    <span
                      className={
                        booking.status === 'CANCELED'
                          ? 'booking-status booking-status--canceled'
                          : 'booking-status booking-status--active'
                      }
                    >
                      {booking.status === 'CANCELED' ? 'Cancelada' : 'Ativa'}
                    </span>
                    <span className="booking-meta">Reserva #{booking.id}</span>
                  </div>
                  <h3>{booking.title}</h3>
                  <p>
                    {roomNameById.get(booking.room_id) ??
                      `Sala #${booking.room_id}`}
                  </p>
                </div>
                <div className="booking-schedule">
                  {formatDateRange(booking.start_at, booking.end_at)}
                </div>
              </div>

              <dl className="booking-details">
                <div>
                  <dt>Participantes</dt>
                  <dd>{booking.participants.length}</dd>
                </div>
                <div>
                  <dt>Criado por</dt>
                  <dd>Usuario #{booking.created_by_user_id}</dd>
                </div>
                <div>
                  <dt>Ultima atualizacao</dt>
                  <dd>{new Date(booking.updated_at).toLocaleString('pt-BR')}</dd>
                </div>
              </dl>

              <div className="booking-participants">
                {booking.participants.map((participant) => (
                  <span className="participant-pill" key={participant.id}>
                    {participant.full_name ?? participant.email}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
