import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createBooking,
  fetchBookingById,
  updateBooking,
} from '../features/bookings/bookingsApi'
import type {
  BookingParticipantInput,
  BookingPayload,
} from '../features/bookings/types'
import { fetchRooms } from '../features/rooms/roomsApi'
import type { Room } from '../features/rooms/types'

type ParticipantFormItem = {
  email: string
  full_name: string
}

const emptyParticipant = (): ParticipantFormItem => ({
  email: '',
  full_name: '',
})

function getCurrentLocalDateTimeInputValue() {
  const now = new Date()
  now.setSeconds(0, 0)
  const offset = now.getTimezoneOffset()
  const localDate = new Date(now.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function toLocalDateTimeInputValue(isoDateTime: string) {
  const date = new Date(isoDateTime)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString()
}

function translateBookingApiDetail(detail: string) {
  const translations: Record<string, string> = {
    'Booking time conflicts with an existing booking':
      'Já existe uma reserva ativa nessa sala para o intervalo informado.',
    'Canceled bookings cannot be edited':
      'Reservas canceladas não podem ser editadas.',
    'Room not found': 'A sala selecionada não foi encontrada.',
    'Booking not found': 'A reserva informada não foi encontrada.',
    'start_at cannot be in the past':
      'Escolha um horário de início a partir do momento atual.',
    'start_at must be before end_at':
      'O horário de início deve ser anterior ao horário de fim.',
    'Booking duration must be at least 15 minutes':
      'A reserva deve ter pelo menos 15 minutos de duração.',
    'Booking duration must be at most 8 hours':
      'A reserva deve ter no máximo 8 horas de duração.',
  }

  return translations[detail] ?? detail
}

function getBookingFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === 'string' && detail.trim()) {
      return translateBookingApiDetail(detail)
    }

    return 'Não foi possível salvar a reserva no momento.'
  }

  return 'Não foi possível salvar a reserva no momento.'
}

export function BookingFormPage() {
  const navigate = useNavigate()
  const params = useParams()
  const bookingId = params.bookingId ? Number(params.bookingId) : null
  const isEditing = bookingId !== null && Number.isFinite(bookingId)

  const [rooms, setRooms] = useState<Room[]>([])
  const [title, setTitle] = useState('')
  const [roomId, setRoomId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [participants, setParticipants] = useState<ParticipantFormItem[]>([
    emptyParticipant(),
  ])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const minDateTimeValue = useMemo(() => getCurrentLocalDateTimeInputValue(), [])

  useEffect(() => {
    let isMounted = true

    async function loadFormData() {
      try {
        const roomsResponse = await fetchRooms()
        if (!isMounted) return

        setRooms(roomsResponse)

        if (!isEditing) {
          if (roomsResponse[0]) {
            setRoomId(String(roomsResponse[0].id))
          }
          return
        }

        const bookingResponse = await fetchBookingById(bookingId)
        if (!isMounted) return

        setTitle(bookingResponse.title)
        setRoomId(String(bookingResponse.room_id))
        setStartAt(toLocalDateTimeInputValue(bookingResponse.start_at))
        setEndAt(toLocalDateTimeInputValue(bookingResponse.end_at))
        setParticipants(
          bookingResponse.participants.map((participant) => ({
            email: participant.email,
            full_name: participant.full_name ?? '',
          })),
        )
      } catch (requestError) {
        if (!isMounted) return
        setError(getBookingFormErrorMessage(requestError))
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadFormData()

    return () => {
      isMounted = false
    }
  }, [bookingId, isEditing])

  function updateParticipant(
    index: number,
    field: keyof ParticipantFormItem,
    value: string,
  ) {
    setParticipants((current) =>
      current.map((participant, itemIndex) =>
        itemIndex === index
          ? { ...participant, [field]: value }
          : participant,
      ),
    )
  }

  function addParticipant() {
    setParticipants((current) => [...current, emptyParticipant()])
  }

  function removeParticipant(index: number) {
    setParticipants((current) => {
      if (current.length === 1) return current
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const now = new Date()
      const parsedStartAt = new Date(startAt)
      const parsedEndAt = new Date(endAt)

      if (
        Number.isNaN(parsedStartAt.getTime()) ||
        Number.isNaN(parsedEndAt.getTime())
      ) {
        throw new Error('Preencha corretamente os horários de início e fim.')
      }

      if (parsedStartAt < now) {
        throw new Error(
          'Escolha um horário de início a partir do momento atual.',
        )
      }

      const payload: BookingPayload = {
        title: title.trim(),
        room_id: Number(roomId),
        start_at: toIsoDateTime(startAt),
        end_at: toIsoDateTime(endAt),
        participants: participants.map<BookingParticipantInput>((participant) => ({
          email: participant.email.trim(),
          full_name: participant.full_name.trim() || null,
        })),
      }

      if (isEditing) {
        await updateBooking(bookingId, payload)
      } else {
        await createBooking(payload)
      }

      navigate('/bookings', {
        replace: true,
        state: {
          successMessage: isEditing
            ? 'Reserva atualizada com sucesso.'
            : 'Reserva criada com sucesso.',
        },
      })
    } catch (submitError) {
      setError(getBookingFormErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-panel border border-app-border bg-white/90 p-4 shadow-soft md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
            {isEditing ? 'Editar' : 'Nova reserva'}
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-app-strong">
            {isEditing ? 'Atualize a reserva' : 'Crie uma nova reserva'}
          </h2>
          <p className="text-sm leading-6 text-app-text">
            Escolha a sala, defina o horário e adicione os participantes.
          </p>
        </div>

        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-app-border px-4 text-sm font-medium text-app-strong transition hover:bg-app-muted"
          to="/bookings"
        >
          Voltar
        </Link>
      </div>

      {isLoading ? (
        <div
          className="mt-4 rounded-2xl border border-app-border bg-app-muted/80 p-4"
          aria-live="polite"
        >
          <strong className="block text-sm font-medium text-app-strong">
            Carregando formulário...
          </strong>
          <p className="mt-1 text-sm text-app-text">
            Estamos preparando os dados da reserva e a lista de salas.
          </p>
        </div>
      ) : null}

      {!isLoading ? (
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-app-strong">Título</span>
            <input
              className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
              type="text"
              placeholder="Ex.: Planejamento semanal"
              value={title}
              onChange={event => setTitle(event.target.value)}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-app-strong">Sala</span>
              <select
                className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
                value={roomId}
                onChange={event => setRoomId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione uma sala
                </option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.capacity} lugares)
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-app-strong">
                Início
              </span>
              <input
                className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
                type="datetime-local"
                value={startAt}
                min={minDateTimeValue}
                onChange={event => setStartAt(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-app-strong">Fim</span>
              <input
                className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
                type="datetime-local"
                value={endAt}
                min={minDateTimeValue}
                onChange={event => setEndAt(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="rounded-2xl border border-app-border bg-app-muted/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-app-strong">
                  Participantes
                </h3>
                <p className="mt-1 text-sm text-app-text">
                  Adicione pelo menos um participante com e-mail válido.
                </p>
              </div>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-app-border px-4 text-sm font-medium text-app-strong transition hover:bg-white"
                type="button"
                onClick={addParticipant}
              >
                Adicionar participante
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {participants.map((participant, index) => (
                <div
                  className="grid gap-3 rounded-2xl border border-app-border bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  key={index}
                >
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-app-strong">
                      E-mail
                    </span>
                    <input
                      className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
                      type="email"
                      placeholder="pessoa@empresa.com"
                      value={participant.email}
                      onChange={event =>
                        updateParticipant(index, 'email', event.target.value)
                      }
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-app-strong">
                      Nome
                    </span>
                    <input
                      className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
                      type="text"
                      placeholder="Opcional"
                      value={participant.full_name}
                      onChange={event =>
                        updateParticipant(
                          index,
                          'full_name',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <button
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-65 md:self-end"
                    type="button"
                    onClick={() => removeParticipant(index)}
                    disabled={participants.length === 1}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-app-border px-4 text-sm font-medium text-app-strong transition hover:bg-app-muted"
              to="/bookings"
            >
              Cancelar
            </Link>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-app-strong px-4 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-65"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar alterações'
                  : 'Criar reserva'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
