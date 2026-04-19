import { useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
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
      'Não é permitido criar ou editar reservas com horário de início no passado.',
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

  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.id) === roomId) ?? null,
    [roomId, rooms],
  )

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

      if (Number.isNaN(parsedStartAt.getTime()) || Number.isNaN(parsedEndAt.getTime())) {
        throw new Error('Preencha corretamente os horários de início e fim.')
      }

      if (parsedStartAt < now) {
        throw new Error(
          'Não é permitido criar ou editar reservas com horário de início no passado.',
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
    <section className="surface-card">
      <div className="section-header">
        <div>
          <div className="status-chip">{isEditing ? 'Editar' : 'Nova reserva'}</div>
          <h2 className="section-title">
            {isEditing ? 'Atualize a reserva' : 'Crie uma nova reserva'}
          </h2>
          <p className="section-copy">
            Escolha a sala, defina a janela de horário e adicione os
            participantes da reunião.
          </p>
        </div>
        <Link className="ghost-button" to="/bookings">
          Voltar
        </Link>
      </div>

      {isLoading ? (
        <div className="state-card" aria-live="polite">
          <strong>Carregando formulário...</strong>
          <p>Estamos preparando os dados da reserva e a lista de salas.</p>
        </div>
      ) : null}

      {!isLoading ? (
        <form className="booking-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Título</span>
            <input
              type="text"
              placeholder="Ex.: Planejamento semanal"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Sala</span>
              <select
                className="field-select"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione uma sala
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.capacity} lugares)
                  </option>
                ))}
              </select>
            </label>

            <div className="form-hint-card">
              <span className="form-hint-label">Sala escolhida</span>
              <strong>{selectedRoom?.name ?? 'Nenhuma sala selecionada'}</strong>
              <small>
                {selectedRoom
                  ? `${selectedRoom.capacity} lugares disponíveis`
                  : 'Selecione uma sala para continuar.'}
              </small>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Início</span>
              <input
                type="datetime-local"
                value={startAt}
                min={minDateTimeValue}
                onChange={(event) => setStartAt(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Fim</span>
              <input
                type="datetime-local"
                value={endAt}
                min={minDateTimeValue}
                onChange={(event) => setEndAt(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="participants-section">
            <div className="participants-header">
              <div>
                <h3>Participantes</h3>
                <p>Adicione pelo menos um participante com e-mail válido.</p>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={addParticipant}
              >
                Adicionar participante
              </button>
            </div>

            <div className="participants-list">
              {participants.map((participant, index) => (
                <div className="participant-row" key={index}>
                  <label className="field">
                    <span>E-mail</span>
                    <input
                      type="email"
                      placeholder="pessoa@empresa.com"
                      value={participant.email}
                      onChange={(event) =>
                        updateParticipant(index, 'email', event.target.value)
                      }
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Nome</span>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={participant.full_name}
                      onChange={(event) =>
                        updateParticipant(index, 'full_name', event.target.value)
                      }
                    />
                  </label>

                  <button
                    className="ghost-button ghost-button--danger"
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
            <div className="feedback feedback--error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="form-actions">
            <Link className="ghost-button" to="/bookings">
              Cancelar
            </Link>
            <button className="primary-button primary-button--inline" type="submit" disabled={isSubmitting}>
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
