// ============================================================
// AdminUserService — user management: list/search/detail,
// approval workflow (pending → active), suspend/ban, manual
// balance adjustments, KYC review and account deletion.
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { creditWallet, debitWallet } from '../../lib/wallet'
import { logAdminAction, pushNotification } from '../../lib/notify'
import { badRequest, notFound, forbidden } from '../errors'

export const AdminUserService = {
  async listUsers(env: Bindings, opts: { q?: string; status?: string; page?: number } = {}) {
    const page = Math.max(1, opts.page || 1)
    const limit = 20
    const offset = (page - 1) * limit

    let query = `SELECT id, name, phone, email, balance, role, status, kyc_status, created_at FROM users WHERE role = 'user'`
    const params: any[] = []
    if (opts.q) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'
      params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`)
    }
    if (opts.status) {
      query += ' AND status = ?'
      params.push(opts.status)
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const { results } = await env.DB.prepare(query).bind(...params).all()
    const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM users WHERE role = 'user'`).first<any>()

    return { users: results, total: countRow?.total || 0, page, limit }
  },

  async getUserDetail(env: Bindings, userId: string) {
    const db = env.DB

    const user = await db
      .prepare(
        `SELECT id, name, phone, email, whatsapp, balance, role, status, kyc_status, kyc_nid_number, referral_code, created_at, last_login_at, last_login_ip
         FROM users WHERE id = ?`
      )
      .bind(userId)
      .first()
    if (!user) throw notFound('ইউজার পাওয়া যায়নি।')

    const { results: orders } = await db
      .prepare(
        `SELECT o.id, o.order_no, o.price, o.status, o.created_at, s.name_bn as service_name
         FROM orders o JOIN services s ON s.id = o.service_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 20`
      )
      .bind(userId)
      .all()

    const { results: transactions } = await db
      .prepare(`SELECT type, amount, balance_after, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`)
      .bind(userId)
      .all()

    return { user, orders, transactions }
  },

  /** Approve (pending→active) / suspend / activate / ban. */
  async setUserStatus(env: Bindings, adminId: number, userId: string, rawStatus: string) {
    const db = env.DB
    const status = sanitizeText(rawStatus, 20)

    if (!['pending', 'active', 'suspended', 'banned'].includes(status)) {
      throw badRequest('সঠিক স্ট্যাটাস দিন।')
    }

    const before = await db.prepare('SELECT status FROM users WHERE id = ?').bind(userId).first<any>()

    await db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, userId).run()
    await logAdminAction(db, adminId, 'user_status_change', 'user', parseInt(userId), `Status changed to ${status}`)

    // Notify the user when their account moves from pending → active (i.e. admin approval)
    const justApproved = before?.status === 'pending' && status === 'active'
    if (justApproved) {
      await pushNotification(
        db,
        parseInt(userId),
        'অ্যাকাউন্ট অনুমোদিত হয়েছে! ✅',
        'আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে। এখন আপনি লগইন করে সকল সার্ভিস ব্যবহার করতে পারবেন।',
        'success',
        '/dashboard'
      )
    }

    return { message: justApproved ? 'ইউজার অনুমোদন করা হয়েছে।' : 'ইউজারের স্ট্যাটাস আপডেট হয়েছে।' }
  },

  /** Manual credit/debit with reason (positive = credit, negative = debit). */
  async adjustBalance(env: Bindings, adminId: number, userId: number, rawAmount: unknown, rawReason: unknown) {
    const db = env.DB
    const amount = parseFloat(String(rawAmount))
    const reason = sanitizeText(rawReason, 200) || 'এডমিন কর্তৃক ব্যালেন্স সমন্বয়'

    if (!amount || isNaN(amount) || amount === 0) {
      throw badRequest('সঠিক পরিমাণ দিন (পজিটিভ = যোগ, নেগেটিভ = বিয়োগ)।')
    }

    const result =
      amount > 0
        ? await creditWallet(db, userId, amount, 'admin_adjustment', 'manual', adminId, reason)
        : await debitWallet(db, userId, Math.abs(amount), 'admin_adjustment', 'manual', adminId, reason)

    if (!result.success) {
      throw badRequest(result.reason === 'insufficient_balance' ? 'ইউজারের ব্যালেন্স যথেষ্ট নয়।' : 'ব্যর্থ হয়েছে।')
    }

    await logAdminAction(db, adminId, 'balance_adjustment', 'user', userId, `${amount > 0 ? '+' : ''}${amount} — ${reason}`)
    await pushNotification(
      db,
      userId,
      'ব্যালেন্স আপডেট হয়েছে',
      `আপনার ওয়ালেটে ${amount > 0 ? '৳' + amount + ' যোগ' : '৳' + Math.abs(amount) + ' বিয়োগ'} করা হয়েছে। কারণ: ${reason}`,
      amount > 0 ? 'success' : 'warning'
    )

    return { message: 'ব্যালেন্স আপডেট হয়েছে।', balance_after: result.balanceAfter }
  },

  async setKycStatus(env: Bindings, adminId: number, userId: string, rawStatus: string) {
    const db = env.DB
    const status = sanitizeText(rawStatus, 20)

    if (!['verified', 'rejected', 'pending'].includes(status)) throw badRequest('সঠিক স্ট্যাটাস দিন।')

    await db.prepare('UPDATE users SET kyc_status = ? WHERE id = ?').bind(status, userId).run()
    await logAdminAction(db, adminId, 'kyc_review', 'user', parseInt(userId), `KYC ${status}`)
    await pushNotification(
      db,
      parseInt(userId),
      'KYC আপডেট',
      status === 'verified' ? 'আপনার KYC ভেরিফাই করা হয়েছে।' : 'আপনার KYC প্রত্যাখ্যান করা হয়েছে। আবার সাবমিট করুন।',
      status === 'verified' ? 'success' : 'error'
    )

    return { message: 'KYC স্ট্যাটাস আপডেট হয়েছে।' }
  },

  /** Deletes a non-admin user and their ledger/orders/notifications. */
  async deleteUser(env: Bindings, adminId: number, userId: string) {
    const db = env.DB

    const target = await db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').bind(userId).first<any>()
    if (!target) throw notFound('ইউজার পাওয়া যায়নি।')
    if (target.role === 'admin') throw forbidden('এডমিন একাউন্ট ডিলিট করা যাবে না।')

    await db.prepare('DELETE FROM transactions WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM orders WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

    await logAdminAction(db, adminId, 'user_delete', 'user', parseInt(userId), `Deleted user ${target.name} (${target.phone})`)
    return { message: 'ইউজার সফলভাবে ডিলিট করা হয়েছে।' }
  },
}
