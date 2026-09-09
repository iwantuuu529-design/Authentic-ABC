// ============================================================
// WalletService — balance summary, paginated ledger, payment
// methods, manual recharge requests (with R2 proof upload),
// recharge history and standalone coupon redemption.
// ============================================================

import type { Bindings } from '../types/bindings'
import { generateRequestNo } from '../utils/crypto'
import { sanitizeText, isValidBDPhone } from '../utils/validate'
import { pushNotification } from '../lib/notify'
import { creditWallet } from '../lib/wallet'
import { ApiError, badRequest, notFound, conflict } from './errors'

const VALID_METHODS = ['bkash', 'nagad', 'rocket', 'upay', 'other']
const MAX_PROOF_BYTES = 5 * 1024 * 1024

export const WalletService = {
  /** Balance + lifetime totals + last 10 transactions. */
  async getSummary(env: Bindings, userId: number) {
    const db = env.DB

    const balanceRow = await db.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first<any>()

    const totalRecharge = await db
      .prepare(
        `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type IN ('recharge','coupon_bonus','referral_bonus') AND amount > 0`
      )
      .bind(userId)
      .first<any>()

    const totalSpent = await db
      .prepare(`SELECT COALESCE(SUM(-amount),0) as total FROM transactions WHERE user_id = ? AND type = 'order_payment'`)
      .bind(userId)
      .first<any>()

    const { results: recent } = await db
      .prepare(`SELECT id, type, amount, balance_after, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`)
      .bind(userId)
      .all()

    return {
      balance: balanceRow?.balance || 0,
      total_recharge: totalRecharge?.total || 0,
      total_spent: totalSpent?.total || 0,
      recent_transactions: recent,
    }
  },

  /** Paginated transaction ledger. */
  async listTransactions(env: Bindings, userId: number, page = 1) {
    const safePage = Math.max(1, page)
    const limit = 20
    const offset = (safePage - 1) * limit

    const { results } = await env.DB.prepare(
      `SELECT id, type, amount, balance_before, balance_after, description, created_at
       FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(userId, limit, offset)
      .all()

    const countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM transactions WHERE user_id = ?')
      .bind(userId)
      .first<any>()

    return { transactions: results, total: countRow?.total || 0, page: safePage, limit }
  },

  /** Active manual payment methods + any active auto gateways. */
  async getPaymentMethods(env: Bindings) {
    const { results } = await env.DB.prepare(
      `SELECT id, method, account_number, account_type, instructions_bn FROM payment_methods WHERE status = 'active' ORDER BY sort_order ASC`
    ).all()
    const gateways = await env.DB.prepare(
      `SELECT provider_key, name FROM payment_gateways WHERE status = 'active' AND is_auto = 1`
    ).all()
    return { methods: results, auto_gateways: gateways.results }
  },

  /**
   * Creates a manual recharge request: validates the sender/WhatsApp
   * numbers + amount, stores the proof image in R2, guards against a
   * reused transaction id, and notifies the user.
   */
  async createRechargeRequest(
    env: Bindings,
    userId: number,
    fields: {
      method: string
      senderNumber: string
      whatsappNumber: string
      transactionId: string
      amount: number
      proofFile: File | null
    }
  ) {
    const db = env.DB
    const { method, senderNumber, whatsappNumber, transactionId, amount, proofFile } = fields

    if (!method || !VALID_METHODS.includes(method)) throw badRequest('পেমেন্ট মেথড নির্বাচন করুন।')
    if (!isValidBDPhone(senderNumber)) throw badRequest('সঠিক প্রেরকের মোবাইল নম্বর দিন।')
    if (!isValidBDPhone(whatsappNumber)) throw badRequest('সঠিক WhatsApp নম্বর দিন।')
    if (!transactionId || transactionId.length < 4) throw badRequest('সঠিক ট্রানজেকশন আইডি দিন।')
    if (!amount || amount < 10) throw badRequest('সর্বনিম্ন ১০ টাকা রিচার্জ করা যাবে।')
    if (!(proofFile instanceof File) || proofFile.size === 0) throw badRequest('পেমেন্টের স্ক্রিনশট/প্রুফ আপলোড করুন।')
    if (proofFile.size > MAX_PROOF_BYTES) throw badRequest('প্রুফ ফাইল ৫MB এর বেশি হতে পারবে না।')

    const objectKey = `recharge_proofs/${userId}/${Date.now()}-${proofFile.name}`.replace(/\s+/g, '_')
    await env.FILES.put(objectKey, await proofFile.arrayBuffer(), {
      httpMetadata: { contentType: proofFile.type || 'image/jpeg' },
    })

    // Duplicate transaction-id guard (avoid same proof reused across multiple requests)
    const dup = await db
      .prepare(`SELECT id FROM recharge_requests WHERE transaction_id = ? AND status != 'rejected'`)
      .bind(transactionId)
      .first()
    if (dup) throw conflict('এই ট্রানজেকশন আইডি দিয়ে ইতোমধ্যে একটি রিকুয়েস্ট আছে।')

    const requestNo = generateRequestNo()
    await db
      .prepare(
        `INSERT INTO recharge_requests
        (request_no, user_id, method, sender_number, whatsapp_number, transaction_id, proof_file_key, amount, is_auto, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`
      )
      .bind(requestNo, userId, method, senderNumber, whatsappNumber, transactionId, objectKey, amount)
      .run()

    await pushNotification(
      db,
      userId,
      'রিচার্জ রিকুয়েস্ট গৃহীত হয়েছে 🕐',
      `আপনার ৳${amount} রিচার্জ রিকুয়েস্টটি (${requestNo}) যাচাইয়ের জন্য পাঠানো হয়েছে। যাচাই সম্পন্ন হলে ব্যালেন্স যোগ হবে।`,
      'info',
      '/dashboard/wallet'
    )

    return {
      requestNo,
      message: 'রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন যাচাই করার পর ব্যালেন্স যোগ হবে।',
    }
  },

  /** The user's own recharge history (last 30). */
  async listMyRechargeRequests(env: Bindings, userId: number) {
    const { results } = await env.DB.prepare(
      `SELECT id, request_no, method, amount, status, admin_note, created_at, reviewed_at
       FROM recharge_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`
    )
      .bind(userId)
      .all()
    return { requests: results }
  },

  /**
   * Standalone coupon redemption — only FIXED coupons are redeemable
   * here; percentage coupons apply at recharge time. Enforces expiry,
   * global usage limit and per-user limit, then credits the wallet.
   */
  async redeemCoupon(env: Bindings, userId: number, rawCode: string) {
    const db = env.DB
    const code = sanitizeText(rawCode, 30).toUpperCase()

    if (!code) throw badRequest('কুপন কোড দিন।')

    const coupon = await db.prepare(`SELECT * FROM coupons WHERE code = ? AND status = 'active'`).bind(code).first<any>()
    if (!coupon) throw notFound('কুপন কোডটি সঠিক নয় বা মেয়াদোত্তীর্ণ।')

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw badRequest('কুপনের মেয়াদ শেষ হয়ে গেছে।')
    }
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
      throw badRequest('কুপনের ব্যবহারের সীমা শেষ হয়ে গেছে।')
    }

    const userUsage = await db
      .prepare('SELECT COUNT(*) as cnt FROM coupon_usages WHERE coupon_id = ? AND user_id = ?')
      .bind(coupon.id, userId)
      .first<any>()
    if (userUsage && userUsage.cnt >= (coupon.per_user_limit || 1)) {
      throw badRequest('আপনি ইতোমধ্যে এই কুপনটি ব্যবহার করেছেন।')
    }

    const bonusAmount = coupon.type === 'fixed' ? coupon.value : 0 // percentage-type coupons apply at recharge time, not standalone redeem
    if (bonusAmount <= 0) {
      throw badRequest('এই কুপনটি শুধুমাত্র রিচার্জের সময় প্রযোজ্য।')
    }

    await creditWallet(db, userId, bonusAmount, 'coupon_bonus', 'coupon', coupon.id, `কুপন "${code}" রিডিম করা হয়েছে`)
    await db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').bind(coupon.id).run()
    await db
      .prepare('INSERT INTO coupon_usages (coupon_id, user_id, reference_type, amount_discounted) VALUES (?, ?, ?, ?)')
      .bind(coupon.id, userId, 'standalone_redeem', bonusAmount)
      .run()

    await pushNotification(db, userId, 'কুপন রিডিম সফল 🎁', `৳${bonusAmount} আপনার ওয়ালেটে যোগ হয়েছে।`, 'success')

    return { message: `৳${bonusAmount} সফলভাবে যোগ হয়েছে!`, bonus: bonusAmount }
  },
}

export { ApiError }
