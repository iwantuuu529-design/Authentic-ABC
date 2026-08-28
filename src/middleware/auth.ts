import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types/bindings'
import { verifyToken, getJwtSecret } from '../lib/jwt'
import { getCookie } from 'hono/cookie'

/** Reads the JWT from cookie or Authorization header, loads the user, attaches to context. */
export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, 'auth_token') || c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ success: false, message: 'অনুমোদন প্রয়োজন। অনুগ্রহ করে লগইন করুন।' }, 401)
  }
  const payload = await verifyToken(token, getJwtSecret(c.env))
  if (!payload) {
    return c.json({ success: false, message: 'সেশনের মেয়াদ শেষ হয়ে গেছে। আবার লগইন করুন।' }, 401)
  }
  const user = await c.env.DB.prepare(
    'SELECT id, name, phone, email, role, balance, status FROM users WHERE id = ?'
  )
    .bind(payload.sub)
    .first()

  if (!user) {
    return c.json({ success: false, message: 'ইউজার পাওয়া যায়নি।' }, 401)
  }
  if (user.status === 'pending') {
    return c.json(
      { success: false, pending: true, message: 'আপনার অ্যাকাউন্টটি এখনও অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদন হলে আপনাকে জানানো হবে।' },
      403
    )
  }
  if (user.status !== 'active') {
    return c.json({ success: false, message: 'আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে। সাপোর্টে যোগাযোগ করুন।' }, 403)
  }
  c.set('user', user as any)
  await next()
})

/** Requires an authenticated admin or staff user. */
export const adminRequired = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, 'auth_token') || c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ success: false, message: 'অনুমোদন প্রয়োজন।' }, 401)
  }
  const payload = await verifyToken(token, getJwtSecret(c.env))
  if (!payload) {
    return c.json({ success: false, message: 'সেশনের মেয়াদ শেষ হয়ে গেছে।' }, 401)
  }
  const user = await c.env.DB.prepare(
    'SELECT id, name, phone, email, role, balance, status FROM users WHERE id = ?'
  )
    .bind(payload.sub)
    .first()
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return c.json({ success: false, message: 'এই সেকশনে প্রবেশের অনুমতি নেই।' }, 403)
  }
  if (user.status !== 'active') {
    return c.json({ success: false, message: 'অ্যাকাউন্ট নিষ্ক্রিয়।' }, 403)
  }
  c.set('user', user as any)
  await next()
})

/** Optional auth - attaches user if token present/valid, otherwise continues silently. */
export const authOptional = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, 'auth_token') || c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    const payload = await verifyToken(token, getJwtSecret(c.env))
    if (payload) {
      const user = await c.env.DB.prepare(
        'SELECT id, name, phone, email, role, balance, status FROM users WHERE id = ?'
      )
        .bind(payload.sub)
        .first()
      if (user && user.status === 'active') {
        c.set('user', user as any)
      }
    }
  }
  await next()
})
