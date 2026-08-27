import { sign, verify } from 'hono/jwt'

export interface JwtPayload {
  sub: number
  role: string
  phone: string
  exp: number
  [key: string]: unknown
}

const DEFAULT_SECRET = 'docflow-bd-dev-secret-change-in-production-2026'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export async function signToken(
  payload: { sub: number; role: string; phone: string },
  secret?: string
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  return sign({ ...payload, exp }, secret || DEFAULT_SECRET)
}

export async function verifyToken(token: string, secret?: string): Promise<JwtPayload | null> {
  try {
    const payload = await verify(token, secret || DEFAULT_SECRET, 'HS256')
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export function getJwtSecret(env: { JWT_SECRET?: string }): string {
  return env.JWT_SECRET || DEFAULT_SECRET
}
