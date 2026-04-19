import { Routes, Route } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/auth/AuthContext'
import { LoginPage } from './LoginPage'
import { renderWithRouter } from '../test/renderWithRouter'
import * as authApi from '../features/auth/authApi'

describe('LoginPage', () => {
  it('realiza o login e armazena o token', async () => {
    const loginRequestSpy = vi
      .spyOn(authApi, 'loginRequest')
      .mockResolvedValue({
        access_token: 'test-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          is_active: true,
        },
      })

    const user = userEvent.setup()

    renderWithRouter(
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Página inicial</div>} />
        </Routes>
      </AuthProvider>,
      { route: '/login' },
    )

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@example.com')
    await user.type(screen.getByLabelText(/senha/i), '123456')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await screen.findByText('Página inicial')

    expect(loginRequestSpy).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: '123456',
    })

    await waitFor(() => {
      expect(
        localStorage.getItem('meeting-room-booking.access-token'),
      ).toBe('test-token')
      expect(
        localStorage.getItem('meeting-room-booking.auth-user'),
      ).toContain('admin@example.com')
    })
  })
})
