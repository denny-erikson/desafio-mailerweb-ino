const ACCESS_TOKEN_KEY = 'meeting-room-booking.access-token'
const AUTH_USER_KEY = 'meeting-room-booking.auth-user'

export type StoredAuthUser = {
  id: number
  email: string
  full_name: string
  is_active: boolean
}

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setStoredAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function getStoredAuthUser(): StoredAuthUser | null {
  const rawUser = localStorage.getItem(AUTH_USER_KEY)

  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser) as StoredAuthUser
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function setStoredAuthUser(user: StoredAuthUser) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearStoredAuthUser() {
  localStorage.removeItem(AUTH_USER_KEY)
}
