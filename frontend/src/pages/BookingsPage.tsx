import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link, useLocation } from 'react-router-dom'
import { cancelBooking, fetchBookings } from '../features/bookings/bookingsApi'
import type { Booking } from '../features/bookings/types'
import { fetchRooms } from '../features/rooms/roomsApi'
import type { Room } from '../features/rooms/types'

function getBookingsErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.detail ??
      'Não foi possível carregar as reservas no momento.'
    )
  }

  return 'Não foi possível carregar as reservas no momento.'
}

function getCancelBookingErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.detail ??
      'Não foi possível cancelar a reserva no momento.'
    )
  }

  return 'Não foi possível cancelar a reserva no momento.'
}

function formatDateRange(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return `${formatter.format(new Date(startAt))} - ${formatter.format(new Date(endAt))}`
}

export function BookingsPage() {
  const location = useLocation()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cancelingBookingId, setCancelingBookingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
  const routeSuccessMessage =
    (location.state as { successMessage?: string } | null)?.successMessage ?? ''

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
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const roomNameById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  )

  async function handleCancelBooking(bookingId: number) {
    const shouldCancel = window.confirm(
      'Tem certeza de que deseja cancelar esta reserva?',
    )

    if (!shouldCancel) {
      return
    }

    setError('')
    setActionFeedback('')
    setCancelingBookingId(bookingId)

    try {
      const canceledBooking = await cancelBooking(bookingId)
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? canceledBooking : booking,
        ),
      )
      setActionFeedback('Reserva cancelada com sucesso.')
    } catch (cancelError) {
      setError(getCancelBookingErrorMessage(cancelError))
    } finally {
      setCancelingBookingId(null)
    }
  }

  return (
    <section className="rounded-panel border border-app-border bg-white/90 p-4 shadow-soft md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
            Reservas
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-app-strong">
            Agenda das reservas
          </h2>
          <p className="text-sm leading-6 text-app-text">
            Consulte a agenda, revise participantes e atualize reservas com
            clareza.
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-app-strong px-4 text-sm font-medium text-white transition hover:bg-black"
          to="/bookings/new"
        >
          Nova reserva
        </Link>
      </div>

      {actionFeedback || routeSuccessMessage ? (
        <div
          className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {actionFeedback || routeSuccessMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div
          className="mt-4 rounded-2xl border border-app-border bg-app-muted/80 p-4"
          aria-live="polite"
        >
          <strong className="block text-sm font-medium text-app-strong">
            Carregando reservas...
          </strong>
          <p className="mt-1 text-sm text-app-text">
            Estamos consultando as reservas e cruzando com as salas.
          </p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && bookings.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-app-border bg-app-muted/80 p-4">
          <strong className="block text-sm font-medium text-app-strong">
            Nenhuma reserva cadastrada
          </strong>
          <p className="mt-1 text-sm text-app-text">
            Quando as reservas forem criadas, elas aparecerão aqui com sala,
            horário e participantes.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && bookings.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {bookings.map((booking) => (
            <article
              className="rounded-2xl border border-app-border bg-app-surface p-4"
              key={booking.id}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        booking.status === 'CANCELED'
                          ? 'inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700'
                          : 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
                      }
                    >
                      {booking.status === 'CANCELED' ? 'Cancelada' : 'Ativa'}
                    </span>
                    <span className="inline-flex rounded-full bg-app-muted px-2.5 py-1 text-xs font-medium text-app-text">
                      Reserva #{booking.id}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-app-strong">
                      {booking.title}
                    </h3>
                    <p className="mt-1 text-sm text-app-text">
                      {roomNameById.get(booking.room_id) ??
                        `Sala #${booking.room_id}`}
                    </p>
                  </div>
                </div>

                <div className="text-sm font-medium text-app-strong">
                  {formatDateRange(booking.start_at, booking.end_at)}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-app-border bg-white px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-app-soft">
                    Participantes
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-app-strong">
                    {booking.participants.length}
                  </dd>
                </div>
                <div className="rounded-2xl border border-app-border bg-white px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-app-soft">
                    Criado por
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-app-strong">
                    Usuário #{booking.created_by_user_id}
                  </dd>
                </div>
                <div className="rounded-2xl border border-app-border bg-white px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-app-soft">
                    Última atualização
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-app-strong">
                    {new Date(booking.updated_at).toLocaleString('pt-BR')}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {booking.participants.map((participant) => (
                  <span
                    className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-app-strong ring-1 ring-app-border"
                    key={participant.id}
                  >
                    {participant.full_name ?? participant.email}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-app-border px-4 text-sm font-medium text-app-strong transition hover:bg-app-muted"
                  to={`/bookings/${booking.id}/edit`}
                >
                  Editar reserva
                </Link>
                {booking.status === 'ACTIVE' ? (
                  <button
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-65"
                    type="button"
                    onClick={() => handleCancelBooking(booking.id)}
                    disabled={cancelingBookingId === booking.id}
                  >
                    {cancelingBookingId === booking.id
                      ? 'Cancelando...'
                      : 'Cancelar reserva'}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
