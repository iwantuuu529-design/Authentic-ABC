import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { creditWallet } from '../../lib/wallet'
import { pushNotification, logAdminAction } from '../../lib/notify'

const adminRecharge = new Hono<AppEnv>()

// GET /api/admin/recharge-requests?status=&page=
adminRecharge.get('/', async (c) => {
  const status = c.req.query('status') || 'pending'
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
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

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM recharge_requests${status !== 'all' ? ' WHERE status = ?' : ''}`
  )
    .bind(...(status !== 'all' ? [status] : []))
    .first<any>()

  return c.json({ success: true, requests: results, total: countRow?.total || 0, page, limit })
})

// GET /api/admin/recharge-requests/:id/proof — stream proof image
adminRecharge.get('/:id/proof', async (c) => {
  const id = c.req.param('id')
  const req = await c.env.DB.prepare('SELECT proof_file_key FROM recharge_requests WHERE id = ?').bind(id).first<any>()
  if (!req || !req.proof_file_key) return c.json({ success: false, message: 'প্রুফ পাওয়া যায়নি।' }, 404)

  const object = await c.env.FILES.get(req.proof_file_key)
  if (!object) return c.json({ success: false, message: 'ফাইল পাওয়া যায়নি।' }, 404)

  return new Response(object.body, {
    headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/jpeg' },
  })
})

// PUT /api/admin/recharge-requests/:id/approve
adminRecharge.put('/:id/approve', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')

  const req = await c.env.DB.prepare('SELECT * FROM recharge_requests WHERE id = ?').bind(id).first<any>()
  if (!req) return c.json({ success: false, message: 'রিকুয়েস্ট পাওয়া যায়নি।' }, 404)
  if (req.status !== 'pending') {
    return c.json({ success: false, message: 'এই রিকুয়েস্টটি ইতোমধ্যে প্রসেস করা হয়েছে।' }, 400)
  }

  await creditWallet(c.env.DB, req.user_id, req.amount, 'recharge', 'recharge_request', req.id, `রিচার্জ অনুমোদিত (${req.request_no})`)

  await c.env.DB.prepare(
    `UPDATE recharge_requests SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(admin.id, id)
    .run()

  await logAdminAction(c.env.DB, admin.id, 'recharge_approved', 'recharge_request', parseInt(id), `৳${req.amount}`)
  await pushNotification(
    c.env.DB,
    req.user_id,
    'রিচার্জ সফল হয়েছে! ✅',
    `আপনার ৳${req.amount} রিচার্জ রিকুয়েস্ট (${req.request_no}) অনুমোদিত হয়েছে এবং ব্যালেন্সে যোগ করা হয়েছে।`,
    'success',
    '/dashboard/wallet'
  )

  // First-recharge referral bonus: credited only on the referred user's first APPROVED recharge
  // (protects against fake/self-referral abuse via unapproved requests).
  const pendingReferral = await c.env.DB.prepare(
    `SELECT * FROM referrals WHERE referred_id = ? AND status = 'pending'`
  )
    .bind(req.user_id)
    .first<any>()

  if (pendingReferral) {
    const approvedCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM recharge_requests WHERE user_id = ? AND status = 'approved'`
    )
      .bind(req.user_id)
      .first<any>()

    if (approvedCount?.cnt === 1) {
      const bonusSetting = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = 'referral_bonus_amount'`).first<any>()
      const bonusAmount = parseFloat(bonusSetting?.value || '20')

      if (bonusAmount > 0) {
        await creditWallet(
          c.env.DB,
          pendingReferral.referrer_id,
          bonusAmount,
          'referral_bonus',
          'referral',
          pendingReferral.id,
          `রেফারেল বোনাস - নতুন ইউজারের প্রথম রিচার্জ`
        )
        await c.env.DB.prepare('UPDATE referrals SET status = ?, bonus_amount = ? WHERE id = ?')
          .bind('credited', bonusAmount, pendingReferral.id)
          .run()
        await pushNotification(
          c.env.DB,
          pendingReferral.referrer_id,
          'রেফারেল বোনাস পেয়েছেন! 🎉',
          `আপনার রেফার করা ইউজার প্রথম রিচার্জ সম্পন্ন করায় ৳${bonusAmount} বোনাস পেয়েছেন।`,
          'success',
          '/dashboard/referral'
        )
      }
    }
  }

  return c.json({ success: true, message: 'রিচার্জ অনুমোদন করা হয়েছে এবং ব্যালেন্স যোগ হয়েছে।' })
})

// PUT /api/admin/recharge-requests/:id/reject
adminRecharge.put('/:id/reject', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const reason = sanitizeText(body.reason, 300) || 'প্রুফ যাচাই করা যায়নি'

  const req = await c.env.DB.prepare('SELECT * FROM recharge_requests WHERE id = ?').bind(id).first<any>()
  if (!req) return c.json({ success: false, message: 'রিকুয়েস্ট পাওয়া যায়নি।' }, 404)
  if (req.status !== 'pending') {
    return c.json({ success: false, message: 'এই রিকুয়েস্টটি ইতোমধ্যে প্রসেস করা হয়েছে।' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE recharge_requests SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(reason, admin.id, id)
    .run()

  await logAdminAction(c.env.DB, admin.id, 'recharge_rejected', 'recharge_request', parseInt(id), reason)
  await pushNotification(
    c.env.DB,
    req.user_id,
    'রিচার্জ প্রত্যাখ্যাত হয়েছে',
    `আপনার ৳${req.amount} রিচার্জ রিকুয়েস্ট (${req.request_no}) প্রত্যাখ্যান করা হয়েছে। কারণ: ${reason}`,
    'error',
    '/dashboard/wallet'
  )

  return c.json({ success: true, message: 'রিকুয়েস্ট প্রত্যাখ্যান করা হয়েছে।' })
})

export default adminRecharge
