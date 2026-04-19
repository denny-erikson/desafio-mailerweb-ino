export type AuthUser = {
  id: number
  email: string
  full_name: string
  is_active: boolean
}

export type LoginPayload = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}
