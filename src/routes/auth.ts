import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv } from '../types/bindings'
import { hashPassword, verifyPassword, generateOtp, generateReferralCode } from '../utils/crypto'
import { isValidBDPhone, isValidEmail, isStrongPassword, sanitizeText } from '../utils/validate'
import { signToken, getJwtSecret } from '../lib/jwt'
import { authRequired } from '../middleware/auth'
import { creditWallet } from '../lib/wallet'
import { pushNotification } from '../lib/notify'

const auth = new Hono<AppEnv>()

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
}

// ---------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = sanitizeText(body.name, 100)
  const phone = sanitizeText(body.phone, 20)
  const email = body.email ? sanitizeText(body.email, 120) : null
  const password = typeof body.password === 'string' ? body.password : ''
  const whatsapp = body.whatsapp ? sanitizeText(body.whatsapp, 20) : phone
  const refCode = body.referral_code ? sanitizeText(body.referral_code, 20) : null

  if (!name || name.length < 2) {
    return c.json({ success: false, message: 'সঠিক নাম দিন (কমপক্ষে ২ অক্ষর)।' }, 400)
  }
  if (!isValidBDPhone(phone)) {
    return c.json({ success: false, message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমনঃ 01xxxxxxxxx)।' }, 400)
  }
  if (email && !isValidEmail(email)) {
    return c.json({ success: false, message: 'সঠিক ইমেইল ঠিকানা দিন।' }, 400)
  }
  if (!isStrongPassword(password)) {
    return c.json({ success: false, message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first()
  if (existing) {
    return c.json({ success: false, message: 'এই মোবাইল নম্বর দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট আছে।' }, 409)
  }

  let referrer: any = null
  if (refCode) {
    referrer = await c.env.DB.prepare('SELECT id FROM users WHERE referral_code = ?').bind(refCode).first()
  }

  const passwordHash = await hashPassword(password)
  let referralCode = generateReferralCode(name)
  // Ensure uniqueness (retry a couple of times on collision)
  for (let i = 0; i < 3; i++) {
    const clash = await c.env.DB.prepare('SELECT id FROM users WHERE referral_code = ?').bind(referralCode).first()
    if (!clash) break
    referralCode = generateReferralCode(name)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO users (name, phone, email, whatsapp, password_hash, referral_code, referred_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
  )
    .bind(name, phone, email, whatsapp, passwordHash, referralCode, referrer?.id || null)
    .run()

  const userId = result.meta.last_row_id as number

  if (referrer?.id) {
    await c.env.DB.prepare('INSERT INTO referrals (referrer_id, referred_id, status) VALUES (?, ?, ?)')
      .bind(referrer.id, userId, 'pending')
      .run()
  }

  await pushNotification(
    c.env.DB,
    userId,
    'স্বাগতম! 🎉',
    'আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে এবং এখন অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদন হলে আপনাকে জানানো হবে।',
    'info'
  )

  // Pending accounts are NOT auto-logged-in — no cookie/token is issued until admin approval.
  return c.json({
    success: true,
    pending: true,
    message: 'রেজিস্ট্রেশন সফল হয়েছে! আপনার অ্যাকাউন্টটি এখন অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদন হলে আপনি লগইন করতে পারবেন।',
  })
})

// ---------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const phone = sanitizeText(body.phone, 20)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!phone || !password) {
    return c.json({ success: false, message: 'মোবাইল নম্বর ও পাসওয়ার্ড দিন।' }, 400)
  }

  const user = await c.env.DB.prepare(
    `SELECT id, name, phone, email, password_hash, role, balance, status, failed_login_attempts, locked_until
     FROM users WHERE phone = ?`
  )
    .bind(phone)
    .first<any>()

  if (!user) {
    return c.json({ success: false, message: 'ভুল মোবাইল নম্বর বা পাসওয়ার্ড।' }, 401)
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return c.json(
      { success: false, message: 'একাধিকবার ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।' },
      423
    )
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1
    let lockedUntil: string | null = null
    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    }
    await c.env.DB.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
      .bind(attempts, lockedUntil, user.id)
      .run()
    return c.json({ success: false, message: 'ভুল মোবাইল নম্বর বা পাসওয়ার্ড।' }, 401)
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

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  await c.env.DB.prepare(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP, last_login_ip = ? WHERE id = ?`
  )
    .bind(ip, user.id)
    .run()

  const token = await signToken({ sub: user.id, role: user.role, phone: user.phone }, getJwtSecret(c.env))
  setCookie(c, 'auth_token', token, COOKIE_OPTS)

  return c.json({
    success: true,
    message: 'সফলভাবে লগইন হয়েছে!',
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      balance: user.balance,
    },
  })
})

// ---------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------
auth.post('/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/' })
  return c.json({ success: true, message: 'লগআউট সম্পন্ন হয়েছে।' })
})

// ---------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------
auth.get('/me', authRequired, async (c) => {
  const authUser = c.get('user')!
  const user = await c.env.DB.prepare(
    `SELECT id, name, phone, email, whatsapp, role, balance, avatar_url, referral_code, kyc_status, created_at
     FROM users WHERE id = ?`
  )
    .bind(authUser.id)
    .first()
  return c.json({ success: true, user })
})

// ---------------------------------------------------------------
// PUT /api/auth/profile
// Phone number (login ID) change is optional and requires the CURRENT
// password to confirm — it's the account's primary login credential, so
// this mirrors the same security bar as change-password.
// ---------------------------------------------------------------
auth.put('/profile', authRequired, async (c) => {
  const authUser = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const name = sanitizeText(body.name, 100)
  const email = body.email ? sanitizeText(body.email, 120) : null
  const whatsapp = body.whatsapp ? sanitizeText(body.whatsapp, 20) : null
  const newPhone = body.phone ? sanitizeText(body.phone, 20) : null
  const currentPassword = typeof body.current_password === 'string' ? body.current_password : ''

  if (!name || name.length < 2) {
    return c.json({ success: false, message: 'সঠিক নাম দিন।' }, 400)
  }
  if (email && !isValidEmail(email)) {
    return c.json({ success: false, message: 'সঠিক ইমেইল দিন।' }, 400)
  }

  const existingUser = await c.env.DB.prepare('SELECT phone, password_hash FROM users WHERE id = ?').bind(authUser.id).first<any>()

  let phoneToSave = existingUser.phone
  if (newPhone && newPhone !== existingUser.phone) {
    if (!isValidBDPhone(newPhone)) {
      return c.json({ success: false, message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।' }, 400)
    }
    if (!currentPassword) {
      return c.json({ success: false, message: 'মোবাইল নম্বর (লগইন আইডি) পরিবর্তনের জন্য বর্তমান পাসওয়ার্ড দিতে হবে।' }, 400)
    }
    const valid = await verifyPassword(currentPassword, existingUser.password_hash)
    if (!valid) {
      return c.json({ success: false, message: 'বর্তমান পাসওয়ার্ড সঠিক নয়।' }, 400)
    }
    const dup = await c.env.DB.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').bind(newPhone, authUser.id).first()
    if (dup) {
      return c.json({ success: false, message: 'এই মোবাইল নম্বরে অন্য একটি অ্যাকাউন্ট আছে।' }, 400)
    }
    phoneToSave = newPhone
  }

  await c.env.DB.prepare('UPDATE users SET name = ?, email = ?, whatsapp = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(name, email, whatsapp, phoneToSave, authUser.id)
    .run()

  return c.json({ success: true, message: phoneToSave !== existingUser.phone ? 'প্রোফাইল ও লগইন মোবাইল নম্বর আপডেট হয়েছে।' : 'প্রোফাইল আপডেট হয়েছে।', phone: phoneToSave })
})

// ---------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------
auth.post('/change-password', authRequired, async (c) => {
  const authUser = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const currentPassword = typeof body.current_password === 'string' ? body.current_password : ''
  const newPassword = typeof body.new_password === 'string' ? body.new_password : ''

  if (!isStrongPassword(newPassword)) {
    return c.json({ success: false, message: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' }, 400)
  }

  const user = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(authUser.id).first<any>()
  const valid = await verifyPassword(currentPassword, user.password_hash)
  if (!valid) {
    return c.json({ success: false, message: 'বর্তমান পাসওয়ার্ড সঠিক নয়।' }, 400)
  }

  const newHash = await hashPassword(newPassword)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(newHash, authUser.id)
    .run()

  return c.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।' })
})

export default auth
