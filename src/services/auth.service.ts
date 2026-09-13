// ============================================================
// AuthService — registration, login (with lockout), profile &
// password management. All business rules live here; the route
// layer (src/routes/auth.ts) only parses input and formats the
// response envelope.
// ============================================================

import type { Bindings } from '../types/bindings'
import { hashPassword, verifyPassword, generateReferralCode } from '../utils/crypto'
import { isValidBDPhone, isValidEmail, isStrongPassword, sanitizeText } from '../utils/validate'
import { signToken, getJwtSecret } from '../lib/jwt'
import { pushNotification } from '../lib/notify'
import { ApiError, badRequest, conflict, forbidden, unauthorized } from './errors'

export interface RegisterInput {
  name?: unknown
  phone?: unknown
  email?: unknown
  password?: unknown
  whatsapp?: unknown
  referral_code?: unknown
}

export interface LoginInput {
  phone?: unknown
  username?: unknown
  email?: unknown
  id?: unknown
  password?: unknown
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

export const AuthService = {
  /**
   * Creates a NEW user in `pending` status. Pending accounts can never
   * log in until an admin approves them (pending → active). No token is
   * issued here on purpose — approval is the gate.
   */
  async register(env: Bindings, input: RegisterInput) {
    const db = env.DB
    const name = sanitizeText(input.name, 100)
    const phone = sanitizeText(input.phone, 20)
    const email = input.email ? sanitizeText(input.email, 120) : null
    const password = typeof input.password === 'string' ? input.password : ''
    const whatsapp = input.whatsapp ? sanitizeText(input.whatsapp, 20) : phone
    const refCode = input.referral_code ? sanitizeText(input.referral_code, 20) : null

    if (!name || name.length < 2) {
      throw badRequest('সঠিক নাম দিন (কমপক্ষে ২ অক্ষর)।')
    }
    if (!isValidBDPhone(phone)) {
      throw badRequest('সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমনঃ 01xxxxxxxxx)।')
    }
    if (email && !isValidEmail(email)) {
      throw badRequest('সঠিক ইমেইল ঠিকানা দিন।')
    }
    if (!isStrongPassword(password)) {
      throw badRequest('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।')
    }

    const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first()
    if (existing) {
      throw conflict('এই মোবাইল নম্বর দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট আছে।')
    }

    let referrer: any = null
    if (refCode) {
      referrer = await db.prepare('SELECT id FROM users WHERE referral_code = ?').bind(refCode).first()
    }

    const passwordHash = await hashPassword(password)
    let referralCode = generateReferralCode(name)
    // Ensure uniqueness (retry a couple of times on collision)
    for (let i = 0; i < 3; i++) {
      const clash = await db.prepare('SELECT id FROM users WHERE referral_code = ?').bind(referralCode).first()
      if (!clash) break
      referralCode = generateReferralCode(name)
    }

    const result = await db
      .prepare(
        `INSERT INTO users (name, phone, email, whatsapp, password_hash, referral_code, referred_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(name, phone, email, whatsapp, passwordHash, referralCode, referrer?.id || null)
      .run()

    const userId = result.meta.last_row_id as number

    if (referrer?.id) {
      await db
        .prepare('INSERT INTO referrals (referrer_id, referred_id, status) VALUES (?, ?, ?)')
        .bind(referrer.id, userId, 'pending')
        .run()
    }

    await pushNotification(
      db,
      userId,
      'স্বাগতম! 🎉',
      'আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে এবং এখন অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদন হলে আপনাকে জানানো হবে।',
      'info'
    )

    return {
      userId,
      message:
        'রেজিস্ট্রেশন সফল হয়েছে! আপনার অ্যাকাউন্টটি এখন অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদন হলে আপনি লগইন করতে পারবেন।',
    }
  },

  /**
   * Verifies credentials, applies the brute-force lockout policy
   * (5 failures → 15 minute lock), enforces the pending/suspended
   * account gates, and issues a fresh JWT on success.
   */
  async login(env: Bindings, input: LoginInput, ip: string) {
    const db = env.DB
    // Self-heal owner accounts before verifying (idempotent, cheap once per isolate)
    try {
      const { CatalogService } = await import('./catalog.service')
      await CatalogService.ensureDefaultServices(db as any)
    } catch {}
    const identifier = sanitizeText(input.phone || input.username || input.email || input.id, 100)
    const password = typeof input.password === 'string' ? input.password.trim() : ''

    if (!identifier || !password) {
      throw badRequest('মোবাইল নম্বর / ইউজারনেম ও পাসওয়ার্ড দিন।')
    }

    const user = await db
      .prepare(
        `SELECT id, name, phone, email, password_hash, role, balance, status, failed_login_attempts, locked_until
         FROM users
         WHERE phone = ? OR email = ?`
      )
      .bind(identifier, identifier)
      .first<any>()

    if (!user) {
      throw unauthorized('ভুল মোবাইল নম্বর বা পাসওয়ার্ড।')
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new ApiError(
        423,
        'একাধিকবার ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।'
      )
    }

    const valid = await verifyPassword(password, user.password_hash)

    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1
      let lockedUntil: string | null = null
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
      await db
        .prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
        .bind(attempts, lockedUntil, user.id)
        .run()
      throw unauthorized('ভুল মোবাইল নম্বর বা পাসওয়ার্ড।')
    }

    if (user.status === 'pending') {
      throw new ApiError(
        403,
        'আপনার অ্যাকাউন্টটি এখনও অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদন হলে আপনাকে জানানো হবে।',
        { pending: true }
      )
    }
    if (user.status !== 'active') {
      throw forbidden('আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে। সাপোর্টে যোগাযোগ করুন।')
    }

    await db
      .prepare(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP, last_login_ip = ? WHERE id = ?`
      )
      .bind(ip, user.id)
      .run()

    const token = await signToken({ sub: user.id, role: user.role, phone: user.phone }, getJwtSecret(env))

    return {
      token,
      cookieMaxAge: TOKEN_TTL_SECONDS,
      message: 'সফলভাবে লগইন হয়েছে!',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        balance: user.balance,
      },
    }
  },

  /** Full profile of the currently-authenticated user. */
  async getMe(env: Bindings, userId: number) {
    return env.DB.prepare(
      `SELECT id, name, phone, email, whatsapp, role, balance, avatar_url, referral_code, kyc_status, created_at
       FROM users WHERE id = ?`
    )
      .bind(userId)
      .first()
  },

  /**
   * Updates profile fields. Changing the phone number (the login ID)
   * requires confirming the CURRENT password — same security bar as
   * change-password.
   */
  async updateProfile(
    env: Bindings,
    userId: number,
    input: {
      name?: unknown
      email?: unknown
      whatsapp?: unknown
      phone?: unknown
      current_password?: unknown
    }
  ) {
    const db = env.DB
    const name = sanitizeText(input.name, 100)
    const email = input.email ? sanitizeText(input.email, 120) : null
    const whatsapp = input.whatsapp ? sanitizeText(input.whatsapp, 20) : null
    const newPhone = input.phone ? sanitizeText(input.phone, 20) : null
    const currentPassword = typeof input.current_password === 'string' ? input.current_password : ''

    if (!name || name.length < 2) {
      throw badRequest('সঠিক নাম দিন।')
    }
    if (email && !isValidEmail(email)) {
      throw badRequest('সঠিক ইমেইল দিন।')
    }

    const existingUser = await db
      .prepare('SELECT phone, password_hash FROM users WHERE id = ?')
      .bind(userId)
      .first<any>()

    let phoneToSave = existingUser.phone
    if (newPhone && newPhone !== existingUser.phone) {
      if (!isValidBDPhone(newPhone)) {
        throw badRequest('সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।')
      }
      if (!currentPassword) {
        throw badRequest('মোবাইল নম্বর (লগইন আইডি) পরিবর্তনের জন্য বর্তমান পাসওয়ার্ড দিতে হবে।')
      }
      const valid = await verifyPassword(currentPassword, existingUser.password_hash)
      if (!valid) {
        throw badRequest('বর্তমান পাসওয়ার্ড সঠিক নয়।')
      }
      const dup = await db
        .prepare('SELECT id FROM users WHERE phone = ? AND id != ?')
        .bind(newPhone, userId)
        .first()
      if (dup) {
        throw badRequest('এই মোবাইল নম্বরে অন্য একটি অ্যাকাউন্ট আছে।')
      }
      phoneToSave = newPhone
    }

    await db
      .prepare('UPDATE users SET name = ?, email = ?, whatsapp = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(name, email, whatsapp, phoneToSave, userId)
      .run()

    return {
      phoneChanged: phoneToSave !== existingUser.phone,
      phone: phoneToSave,
      message:
        phoneToSave !== existingUser.phone
          ? 'প্রোফাইল ও লগইন মোবাইল নম্বর আপডেট হয়েছে।'
          : 'প্রোফাইল আপডেট হয়েছে।',
    }
  },

  /** Verifies the current password and swaps in a new one. */
  async changePassword(env: Bindings, userId: number, input: { current_password?: unknown; new_password?: unknown }) {
    const db = env.DB
    const currentPassword = typeof input.current_password === 'string' ? input.current_password : ''
    const newPassword = typeof input.new_password === 'string' ? input.new_password : ''

    if (!isStrongPassword(newPassword)) {
      throw badRequest('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।')
    }

    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(userId).first<any>()
    const valid = await verifyPassword(currentPassword, user.password_hash)
    if (!valid) {
      throw badRequest('বর্তমান পাসওয়ার্ড সঠিক নয়।')
    }

    const newHash = await hashPassword(newPassword)
    await db
      .prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(newHash, userId)
      .run()

    return { message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।' }
  },
}
