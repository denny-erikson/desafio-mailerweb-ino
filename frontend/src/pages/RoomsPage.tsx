import { useEffect, useState } from 'react'
import axios from 'axios'
import { fetchRooms } from '../features/rooms/roomsApi'
import type { Room } from '../features/rooms/types'

function getRoomsErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.detail ??
      'Nao foi possivel carregar as salas no momento.'
    )
  }

  return 'Nao foi possivel carregar as salas no momento.'
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    fetchRooms()
      .then((response) => {
        if (!isMounted) return
        setRooms(response)
        setError('')
      })
      .catch((requestError) => {
        if (!isMounted) return
        setError(getRoomsErrorMessage(requestError))
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="surface-card">
      <div className="section-header">
        <div>
          <div className="status-chip">Salas</div>
          <h2 className="section-title">Salas disponiveis</h2>
          <p className="section-copy">
            Confira as salas cadastradas no backend antes de seguir para a
            criacao das reservas.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="state-card" aria-live="polite">
          <strong>Carregando salas...</strong>
          <p>Estamos consultando a API protegida para montar a lista.</p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="feedback feedback--error" role="alert">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && rooms.length === 0 ? (
        <div className="state-card">
          <strong>Nenhuma sala cadastrada</strong>
          <p>
            Crie a primeira sala no backend ou pela proxima etapa do frontend
            para começar a gerenciar reservas.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && rooms.length > 0 ? (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <article className="room-card" key={room.id}>
              <div className="room-card__header">
                <div>
                  <h3>{room.name}</h3>
                  <p>ID #{room.id}</p>
                </div>
                <span className="room-capacity">{room.capacity} lugares</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
