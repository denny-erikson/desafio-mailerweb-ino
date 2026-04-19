import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import axios from 'axios'
import { fetchCurrentUser, loginRequest } from './authApi'
import { AuthContext, type AuthContextValue } from './context'
import {
  clearStoredAccessToken,
  clearStoredAuthUser,
  getStoredAccessToken,
  getStoredAuthUser,
  setStoredAccessToken,
  setStoredAuthUser,
} from './storage'
import type { AuthUser, LoginPayload } from './types'

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.detail ??
      'Nao foi possivel fazer login. Tente novamente.'
    )
  }

  return 'Nao foi possivel fazer login. Tente novamente.'
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuthUser())
  const [isBootstrapping, setIsBootstrapping] = useState(() =>
    Boolean(getStoredAccessToken()),
  )

  useEffect(() => {
    const token = getStoredAccessToken()

    if (!token) {
      return
    }

    let isMounted = true

    fetchCurrentUser()
      .then((currentUser) => {
        if (!isMounted) return
        setUser(currentUser)
        setStoredAuthUser(currentUser)
      })
      .catch(() => {
        if (!isMounted) return
        clearStoredAccessToken()
        clearStoredAuthUser()
        setUser(null)
      })
      .finally(() => {
        if (!isMounted) return
        setIsBootstrapping(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function login(payload: LoginPayload) {
    try {
      const response = await loginRequest(payload)
      setStoredAccessToken(response.access_token)
      setStoredAuthUser(response.user)
      setUser(response.user)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }

  function logout() {
    clearStoredAccessToken()
    clearStoredAuthUser()
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
    }),
    [isBootstrapping, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
