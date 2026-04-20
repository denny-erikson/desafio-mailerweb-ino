import { expect, type Page } from '@playwright/test'

const DEFAULT_EMAIL = 'admin@meetingroom.local'
const DEFAULT_PASSWORD = '123@mudar'

export function getE2ECredentials() {
  return {
    email: process.env.E2E_USER_EMAIL ?? DEFAULT_EMAIL,
    password: process.env.E2E_USER_PASSWORD ?? DEFAULT_PASSWORD,
  }
}

export function createUniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

export function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export async function login(page: Page) {
  const { email, password } = getE2ECredentials()

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(
    page.getByRole('heading', { name: 'Visão geral' }),
  ).toBeVisible()
}

export async function createRoomViaUi(page: Page, roomName: string, capacity = 8) {
  await page.getByRole('link', { name: /^Salas$/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Salas disponíveis' }),
  ).toBeVisible()

  await page.getByLabel('Nome da sala').fill(roomName)
  await page.getByLabel('Capacidade').fill(String(capacity))
  await page.getByRole('button', { name: 'Criar sala' }).click()

  await expect(page.getByText('Sala criada com sucesso.')).toBeVisible()
  await expect(page.getByText(roomName)).toBeVisible()
}

export async function createBookingViaUi(
  page: Page,
  bookingTitle: string,
  roomName: string,
  options?: {
    capacity?: number
    participantEmail?: string
    participantName?: string
    startAt?: Date
    endAt?: Date
  },
) {
  const capacity = options?.capacity ?? 8
  const participantEmail =
    options?.participantEmail ?? `participante+${Date.now()}@example.com`
  const participantName = options?.participantName ?? 'Participante E2E'
  const startAt =
    options?.startAt ??
    new Date(Date.now() + 2 * 60 * 60 * 1000)
  const endAt =
    options?.endAt ??
    new Date(startAt.getTime() + 60 * 60 * 1000)

  startAt.setSeconds(0, 0)
  endAt.setSeconds(0, 0)

  await page.goto('/bookings/new')
  await expect(
    page.getByRole('heading', { name: 'Crie uma nova reserva' }),
  ).toBeVisible()

  await page.getByLabel('Título').fill(bookingTitle)
  await page
    .getByLabel('Sala')
    .selectOption({ label: `${roomName} (${capacity} lugares)` })
  await page.getByLabel('Início').fill(formatDateTimeLocal(startAt))
  await page.getByLabel('Fim').fill(formatDateTimeLocal(endAt))
  await page.getByLabel(/^E-mail$/).fill(participantEmail)
  await page.getByLabel(/^Nome$/).fill(participantName)
  await page.getByRole('button', { name: 'Criar reserva' }).click()

  await expect(page.getByText('Reserva criada com sucesso.')).toBeVisible()
  await expect(page.getByText(bookingTitle)).toBeVisible()

  return {
    startAt,
    endAt,
    participantEmail,
    participantName,
  }
}
