import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RoomsPage } from './RoomsPage'
import { renderWithRouter } from '../test/renderWithRouter'
import * as roomsApi from '../features/rooms/roomsApi'

describe('RoomsPage', () => {
  it('cria uma sala e atualiza a listagem na interface', async () => {
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([])
    const createRoomSpy = vi.spyOn(roomsApi, 'createRoom').mockResolvedValue({
      id: 9,
      name: 'Sala Orion',
      capacity: 12,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    })

    const user = userEvent.setup()

    renderWithRouter(<RoomsPage />, { route: '/rooms' })

    await screen.findByText('Nenhuma sala cadastrada')

    await user.type(screen.getByLabelText(/nome da sala/i), 'Sala Orion')
    await user.clear(screen.getByLabelText(/capacidade/i))
    await user.type(screen.getByLabelText(/capacidade/i), '12')
    await user.click(screen.getByRole('button', { name: /criar sala/i }))

    await screen.findByText('Sala criada com sucesso.')

    expect(createRoomSpy).toHaveBeenCalledWith({
      name: 'Sala Orion',
      capacity: 12,
    })
    expect(screen.getByText('Sala Orion')).toBeInTheDocument()
    expect(screen.getByText('12 lugares')).toBeInTheDocument()
  })

  it('mostra toast de erro quando a criação falha', async () => {
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([])
    vi.spyOn(roomsApi, 'createRoom').mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          detail: 'Room name already exists',
        },
      },
    })

    const user = userEvent.setup()

    renderWithRouter(<RoomsPage />, { route: '/rooms' })

    await screen.findByText('Nenhuma sala cadastrada')

    await user.type(screen.getByLabelText(/nome da sala/i), 'Sala Orion')
    await user.clear(screen.getByLabelText(/capacidade/i))
    await user.type(screen.getByLabelText(/capacidade/i), '12')
    await user.click(screen.getByRole('button', { name: /criar sala/i }))

    await screen.findByRole('alert')
    expect(
      screen.getByText('Já existe uma sala cadastrada com esse nome.'),
    ).toBeInTheDocument()
  })

  it('edita uma sala e atualiza a listagem na interface', async () => {
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([
      {
        id: 9,
        name: 'Sala Orion',
        capacity: 12,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      },
    ])
    const updateRoomSpy = vi.spyOn(roomsApi, 'updateRoom').mockResolvedValue({
      id: 9,
      name: 'Sala Polaris',
      capacity: 18,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T11:00:00Z',
    })

    const user = userEvent.setup()

    renderWithRouter(<RoomsPage />, { route: '/rooms' })

    await screen.findByText('Sala Orion')

    await user.click(screen.getByRole('button', { name: /editar sala/i }))
    await user.clear(screen.getByLabelText(/nome da sala/i))
    await user.type(screen.getByLabelText(/nome da sala/i), 'Sala Polaris')
    await user.clear(screen.getByLabelText(/capacidade/i))
    await user.type(screen.getByLabelText(/capacidade/i), '18')
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    await screen.findByText('Sala atualizada com sucesso.')

    expect(updateRoomSpy).toHaveBeenCalledWith(9, {
      name: 'Sala Polaris',
      capacity: 18,
    })
    expect(screen.getByText('Sala Polaris')).toBeInTheDocument()
    expect(screen.getByText('18 lugares')).toBeInTheDocument()
  })

  it('mostra toast de erro quando a edição falha por nome duplicado', async () => {
    vi.spyOn(roomsApi, 'fetchRooms').mockResolvedValue([
      {
        id: 9,
        name: 'Sala Orion',
        capacity: 12,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      },
    ])
    vi.spyOn(roomsApi, 'updateRoom').mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          detail: 'Room name already exists',
        },
      },
    })

    const user = userEvent.setup()

    renderWithRouter(<RoomsPage />, { route: '/rooms' })

    await screen.findByText('Sala Orion')

    await user.click(screen.getByRole('button', { name: /editar sala/i }))
    await user.clear(screen.getByLabelText(/nome da sala/i))
    await user.type(screen.getByLabelText(/nome da sala/i), 'Sala Duplicada')
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    await screen.findByRole('alert')
    expect(
      screen.getByText('Já existe uma sala cadastrada com esse nome.'),
    ).toBeInTheDocument()
  })
})
