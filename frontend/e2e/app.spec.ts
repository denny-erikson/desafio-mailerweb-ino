import { expect, test } from '@playwright/test'
import {
  createBookingViaUi,
  createRoomViaUi,
  createUniqueName,
  login,
  formatDateTimeLocal,
} from './helpers'

test('login', async ({ page }) => {
  await login(page)

  await expect(page.getByText('Meeting Room Booking')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
})

test('criar sala', async ({ page }) => {
  await login(page)

  const roomName = createUniqueName('Sala E2E')
  await createRoomViaUi(page, roomName, 10)

  const roomCard = page.locator('article').filter({ hasText: roomName })
  await expect(roomCard.getByText('10 lugares')).toBeVisible()
})

test('criar reserva', async ({ page }) => {
  await login(page)

  const roomName = createUniqueName('Sala Reserva')
  const bookingTitle = createUniqueName('Reserva E2E')

  await createRoomViaUi(page, roomName, 12)
  await createBookingViaUi(page, bookingTitle, roomName, { capacity: 12 })

  const bookingCard = page.locator('article').filter({ hasText: bookingTitle })
  await expect(bookingCard.getByText(roomName)).toBeVisible()
  await expect(bookingCard.getByText('Ativa')).toBeVisible()
})

test('conflito de horário', async ({ page }) => {
  await login(page)

  const roomName = createUniqueName('Sala Conflito')
  const firstTitle = createUniqueName('Reserva Base')
  const secondTitle = createUniqueName('Reserva Conflitante')
  const startAt = new Date(Date.now() + 3 * 60 * 60 * 1000)
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

  startAt.setSeconds(0, 0)
  endAt.setSeconds(0, 0)

  await createRoomViaUi(page, roomName, 6)
  await createBookingViaUi(page, firstTitle, roomName, {
    capacity: 6,
    startAt,
    endAt,
  })

  await page.goto('/bookings/new')
  await page.getByLabel('Título').fill(secondTitle)
  await page
    .getByLabel('Sala')
    .selectOption({ label: `${roomName} (6 lugares)` })
  await page.getByLabel('Início').fill(formatDateTimeLocal(startAt))
  await page.getByLabel('Fim').fill(formatDateTimeLocal(endAt))
  await page
    .getByLabel(/^E-mail$/)
    .fill(`conflito+${Date.now()}@example.com`)
  await page.getByLabel(/^Nome$/).fill('Conflito E2E')
  await page.getByRole('button', { name: 'Criar reserva' }).click()

  await expect(
    page.getByText(
      'Já existe uma reserva ativa nessa sala para o intervalo informado.',
    ),
  ).toBeVisible()
})
