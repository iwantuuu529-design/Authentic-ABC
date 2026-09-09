// ============================================================
// AdminRechargeService — manual recharge approval queue.
// Approving credits the wallet and triggers the first-recharge
// referral bonus (exactly once per referred user). Rejecting
// records the admin's reason and notifies the user.
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { creditWallet } from '../../lib/wallet'
import { pushNotification, logAdminAction } from '../../lib/notify'
import { badRequest, notFound } from '../errors'

export const AdminRechargeService = {
  async listRequests(env: Bindings, opts: { status?: string; page?: number } = {}) {
    const status = opts.status || 'pending'
    const page = Math.max(1, opts.page || 1)
    const limit = 20
    const offset = (page - 1) * limit

    let query = `
    SELECT r.*, u.name as user_name, u.phone as user_phone
    FROM recharge_requests r JOIN users u ON u.id = r.user_id
    WHERE 1=1
  `
    const params: any[] = []
    if (status !== 'all') {
      query += ' AND r.status = ?'
      params.push(status)
    }
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const { results } = await env.DB.prepare(query).bind(...params).all()
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM recharge_requests${status !== 'all' ? ' WHERE status = ?' : ''}`
    )
      .bind(...(status !== 'all' ? [status] : []))
      .first<any>()

    return { requests: results, total: countRow?.total || 0, page, limit }
  },

  /** Returns the R2 proof image object for a recharge request. */
  async getProof(env: Bindings, requestId: string) {
    const req = await env.DB.prepare('SELECT proof_file_key FROM recharge_requests WHERE id = ?')
      .bind(requestId)
      .first<any>()
    if (!req || !req.proof_file_key) throw notFound('প্রুফ পাওয়া যায়নি।')

    const object = await env.FILES.get(req.proof_file_key)
    if (!object) throw notFound('ফাইল পাওয়া যায়নি।')

    return { object }
  },

  /**
   * Approves a pending recharge: credits the wallet, then awards the
   * referral bonus ONLY on the referred user's first APPROVED recharge
   * (protects against fake/self-referral abuse via unapproved requests).
   */
  async approve(env: Bindings, adminId: number, requestId: string) {
    const db = env.DB

    const req = await db.prepare('SELECT * FROM recharge_requests WHERE id = ?').bind(requestId).first<any>()
    if (!req) throw notFound('রিকুয়েস্ট পাওয়া যায়নি।')
    if (req.status !== 'pending') throw badRequest('এই রিকুয়েস্টটি ইতোমধ্যে প্রসেস করা হয়েছে।')

    await creditWallet(db, req.user_id, req.amount, 'recharge', 'recharge_request', req.id, `রিচার্জ অনুমোদিত (${req.request_no})`)

    await db
      .prepare(`UPDATE recharge_requests SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(adminId, requestId)
      .run()

    await logAdminAction(db, adminId, 'recharge_approved', 'recharge_request', parseInt(requestId), `৳${req.amount}`)
    await pushNotification(
      db,
      req.user_id,
      'রিচার্জ সফল হয়েছে! ✅',
      `আপনার ৳${req.amount} রিচার্জ রিকুয়েস্ট (${req.request_no}) অনুমোদিত হয়েছে এবং ব্যালেন্সে যোগ করা হয়েছে।`,
      'success',
      '/dashboard/wallet'
    )

    // First-recharge referral bonus
    const pendingReferral = await db
      .prepare(`SELECT * FROM referrals WHERE referred_id = ? AND status = 'pending'`)
      .bind(req.user_id)
      .first<any>()

    if (pendingReferral) {
      const approvedCount = await db
        .prepare(`SELECT COUNT(*) as cnt FROM recharge_requests WHERE user_id = ? AND status = 'approved'`)
        .bind(req.user_id)
        .first<any>()

      if (approvedCount?.cnt === 1) {
        const bonusSetting = await db.prepare(`SELECT value FROM settings WHERE key = 'referral_bonus_amount'`).first<any>()
        const bonusAmount = parseFloat(bonusSetting?.value || '20')

        if (bonusAmount > 0) {
          await creditWallet(
            db,
            pendingReferral.referrer_id,
            bonusAmount,
            'referral_bonus',
            'referral',
            pendingReferral.id,
            `রেফারেল বোনাস - নতুন ইউজারের প্রথম রিচার্জ`
          )
          await db
            .prepare('UPDATE referrals SET status = ?, bonus_amount = ? WHERE id = ?')
            .bind('credited', bonusAmount, pendingReferral.id)
            .run()
          await pushNotification(
            db,
            pendingReferral.referrer_id,
            'রেফারেল বোনাস পেয়েছেন! 🎉',
            `আপনার রেফার করা ইউজার প্রথম রিচার্জ সম্পন্ন করায় ৳${bonusAmount} বোনাস পেয়েছেন।`,
            'success',
            '/dashboard/referral'
          )
        }
      }
    }

    return { message: 'রিচার্জ অনুমোদন করা হয়েছে এবং ব্যালেন্স যোগ হয়েছে।' }
  },

  async reject(env: Bindings, adminId: number, requestId: string, rawReason: unknown) {
    const db = env.DB
    const reason = sanitizeText(rawReason, 300) || 'প্রুফ যাচাই করা যায়নি'

    const req = await db.prepare('SELECT * FROM recharge_requests WHERE id = ?').bind(requestId).first<any>()
    if (!req) throw notFound('রিকুয়েস্ট পাওয়া যায়নি।')
    if (req.status !== 'pending') throw badRequest('এই রিকুয়েস্টটি ইতোমধ্যে প্রসেস করা হয়েছে।')

    await db
      .prepare(`UPDATE recharge_requests SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(reason, adminId, requestId)
      .run()

    await logAdminAction(db, adminId, 'recharge_rejected', 'recharge_request', parseInt(requestId), reason)
    await pushNotification(
      db,
      req.user_id,
      'রিচার্জ প্রত্যাখ্যাত হয়েছে',
      `আপনার ৳${req.amount} রিচার্জ রিকুয়েস্ট (${req.request_no}) প্রত্যাখ্যান করা হয়েছে। কারণ: ${reason}`,
      'error',
      '/dashboard/wallet'
    )

    return { message: 'রিকুয়েস্ট প্রত্যাখ্যান করা হয়েছে।' }
  },
}
