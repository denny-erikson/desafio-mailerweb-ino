import axios from 'axios'
import { useEffect, useState, type FormEvent } from 'react'
import { useToast } from '../features/feedback/useToast'
import { createRoom, fetchRooms, updateRoom } from '../features/rooms/roomsApi'
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

function getUpdateRoomErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (detail === 'Room name already exists') {
      return 'Já existe uma sala cadastrada com esse nome.'
    }

    if (detail === 'Room not found') {
      return 'A sala selecionada não foi encontrada.'
    }

    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
  }

  return 'Não foi possível atualizar a sala no momento.'
}

function sortRoomsByName(items: Room[]) {
  return [...items].sort((firstRoom, secondRoom) =>
    firstRoom.name.localeCompare(secondRoom.name, 'pt-BR'),
  )
}

export function RoomsPage() {
  const { showToast } = useToast()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)
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

    try {
      const payload = {
        name: name.trim(),
        capacity: Number(capacity),
      }

      if (editingRoomId !== null) {
        const updatedRoom = await updateRoom(editingRoomId, payload)
        setRooms((currentRooms) =>
          sortRoomsByName(
            currentRooms.map((room) =>
              room.id === editingRoomId ? updatedRoom : room,
            ),
          ),
        )
        showToast({
          type: 'success',
          message: 'Sala atualizada com sucesso.',
        })
      } else {
        const createdRoom = await createRoom(payload)
        setRooms((currentRooms) =>
          sortRoomsByName([...currentRooms, createdRoom]),
        )
        showToast({
          type: 'success',
          message: 'Sala criada com sucesso.',
        })
      }

      setName('')
      setCapacity('8')
      setEditingRoomId(null)
    } catch (submitError) {
      showToast({
        type: 'error',
        message:
          editingRoomId !== null
            ? getUpdateRoomErrorMessage(submitError)
            : getCreateRoomErrorMessage(submitError),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleEditRoom(room: Room) {
    setEditingRoomId(room.id)
    setName(room.name)
    setCapacity(String(room.capacity))
  }

  function handleCancelEdit() {
    setEditingRoomId(null)
    setName('')
    setCapacity('8')
  }

  return (
    <section className="rounded-panel border border-app-border bg-white/90 p-4 shadow-soft md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
            Salas
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-app-strong">
            {editingRoomId !== null ? 'Editar sala' : 'Salas disponíveis'}
          </h2>
          <p className="text-sm leading-6 text-app-text">
            {editingRoomId !== null
              ? 'Atualize o nome e a capacidade da sala selecionada.'
              : 'Cadastre novas salas e acompanhe os ambientes disponíveis para reserva.'}
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
          <div className="flex flex-wrap justify-end gap-2">
            {editingRoomId !== null ? (
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-app-border px-4 text-sm font-medium text-app-strong transition hover:bg-app-muted"
                type="button"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancelar edição
              </button>
            ) : null}
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-app-strong px-4 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-65"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? editingRoomId !== null
                  ? 'Salvando alterações...'
                  : 'Criando sala...'
                : editingRoomId !== null
                  ? 'Salvar alterações'
                  : 'Criar sala'}
            </button>
          </div>
        </div>
      </form>

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
                  <h4 className="truncate text-base font-semibold text-app-strong"
                    title={ room.name}
                  >
                    {room.name}
                  </h4>
                  <p className="mt-1 text-sm text-app-text">ID #{room.id}</p>
                </div>
                <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
                  {room.capacity} lugares
                </span>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-app-border px-4 text-sm font-medium text-app-strong transition hover:bg-app-muted"
                  type="button"
                  onClick={() => handleEditRoom(room)}
                >
                  Editar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
