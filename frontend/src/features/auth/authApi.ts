import { apiClient } from '../../api/client'
import type { AuthUser, LoginPayload, LoginResponse } from './types'

export async function loginRequest(payload: LoginPayload) {
  const response = await apiClient.post<LoginResponse>('/auth/login', payload)
  return response.data
}

export async function fetchCurrentUser() {
  const response = await apiClient.get<AuthUser>('/auth/me')
  return response.data
}
