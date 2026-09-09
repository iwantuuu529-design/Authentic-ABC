// ============================================================
// Auth routes — thin HTTP adapters over AuthService.
// ============================================================

import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { AuthService } from '../services'

const auth = new Hono<AppEnv>()

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
}

// POST /api/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AuthService.register(c.env, body)
  // Pending accounts are NOT auto-logged-in — no cookie/token is issued until admin approval.
  return c.json({ success: true, pending: true, message: result.message })
})

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const result = await AuthService.login(c.env, body, ip)
  setCookie(c, 'auth_token', result.token, { ...COOKIE_OPTS, maxAge: result.cookieMaxAge })
  return c.json({ success: true, message: result.message, user: result.user })
})

// POST /api/auth/logout
auth.post('/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/' })
  return c.json({ success: true, message: 'লগআউট সম্পন্ন হয়েছে।' })
})

// GET /api/auth/me
auth.get('/me', authRequired, async (c) => {
  const user = await AuthService.getMe(c.env, c.get('user')!.id)
  return c.json({ success: true, user })
})

// PUT /api/auth/profile
auth.put('/profile', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AuthService.updateProfile(c.env, c.get('user')!.id, body)
  return c.json({ success: true, message: result.message, phone: result.phone })
})

// POST /api/auth/change-password
auth.post('/change-password', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AuthService.changePassword(c.env, c.get('user')!.id, body)
  return c.json({ success: true, message: result.message })
})

export default auth
