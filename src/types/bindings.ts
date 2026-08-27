export type Bindings = {
  DB: D1Database
  FILES: R2Bucket
  JWT_SECRET?: string
}

export type Variables = {
  user?: AuthUser
}

export interface AuthUser {
  id: number
  name: string
  phone: string
  email: string | null
  role: 'user' | 'admin' | 'staff'
  balance: number
  status: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
