import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import { createRoom, fetchRooms } from '../features/rooms/roomsApi'
import type { Room } from '../features/rooms/types'

function getRoomsErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.detail ??
      'Não foi possível carregar as salas no momento.'
    )
  }

  return 'Não foi possível carregar as salas no momento.'
}

function getCreateRoomErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (detail === 'Room name already exists') {
      return 'Já existe uma sala cadastrada com esse nome.'
    }

    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
  }

  return 'Não foi possível criar a sala no momento.'
}

function sortRoomsByName(items: Room[]) {
  return [...items].sort((firstRoom, secondRoom) =>
    firstRoom.name.localeCompare(secondRoom.name, 'pt-BR'),
  )
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createError, setCreateError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('8')

  useEffect(() => {
    let isMounted = true

    fetchRooms()
      .then((response) => {
        if (!isMounted) return
        setRooms(sortRoomsByName(response))
        setLoadError('')
      })
      .catch((requestError) => {
        if (!isMounted) return
        setLoadError(getRoomsErrorMessage(requestError))
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setCreateError('')
    setSuccessMessage('')

    try {
      const createdRoom = await createRoom({
        name: name.trim(),
        capacity: Number(capacity),
      })

      setRooms((currentRooms) => sortRoomsByName([...currentRooms, createdRoom]))
      setName('')
      setCapacity('8')
      setSuccessMessage('Sala criada com sucesso.')
    } catch (submitError) {
      setCreateError(getCreateRoomErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-panel border border-app-border bg-white/90 p-4 shadow-soft md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
            Salas
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-app-strong">
            Salas disponíveis
          </h2>
          <p className="text-sm leading-6 text-app-text">
            Cadastre novas salas e acompanhe os ambientes disponíveis para
            reserva.
          </p>
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-app-strong">
              Nome da sala
            </span>
            <input
              className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
              type="text"
              name="name"
              placeholder="Ex.: Sala Atlas"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-app-strong">Capacidade</span>
            <input
              className="min-h-12 rounded-2xl border border-app-border bg-app-surface px-4 text-app-strong outline-none transition focus:border-app-strong"
              type="number"
              name="capacity"
              min={1}
              step={1}
              inputMode="numeric"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              required
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-app-strong px-4 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-65"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Criando sala...' : 'Criar sala'}
          </button>
        </div>
      </form>

      {createError ? (
        <div
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {createError}
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div
          className="mt-4 rounded-2xl border border-app-border bg-app-muted/80 p-4"
          aria-live="polite"
        >
          <strong className="block text-sm font-medium text-app-strong">
            Carregando salas...
          </strong>
          <p className="mt-1 text-sm text-app-text">
            Estamos consultando a API protegida para montar a lista.
          </p>
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <div
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      {!isLoading && !loadError && rooms.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-app-border bg-app-muted/80 p-4">
          <strong className="block text-sm font-medium text-app-strong">
            Nenhuma sala cadastrada
          </strong>
          <p className="mt-1 text-sm text-app-text">
            Crie a primeira sala por aqui para começar a gerenciar reservas.
          </p>
        </div>
      ) : null}

      {!isLoading && !loadError && rooms.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article
              className="rounded-2xl border border-app-border bg-app-surface p-4"
              key={room.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-app-strong">
                    {room.name}
                  </h3>
                  <p className="mt-1 text-sm text-app-text">ID #{room.id}</p>
                </div>
                <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
                  {room.capacity} lugares
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
