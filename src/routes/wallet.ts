import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { generateRequestNo } from '../utils/crypto'
import { sanitizeText, isValidBDPhone } from '../utils/validate'
import { pushNotification } from '../lib/notify'
import { creditWallet } from '../lib/wallet'

const wallet = new Hono<AppEnv>()

// ---------------------------------------------------------------
// GET /api/wallet/summary
// ---------------------------------------------------------------
wallet.get('/summary', authRequired, async (c) => {
  const user = c.get('user')!

  const balanceRow = await c.env.DB.prepare('SELECT balance FROM users WHERE id = ?').bind(user.id).first<any>()

  const totalRecharge = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type IN ('recharge','coupon_bonus','referral_bonus') AND amount > 0`
  )
    .bind(user.id)
    .first<any>()

  const totalSpent = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(-amount),0) as total FROM transactions WHERE user_id = ? AND type = 'order_payment'`
  )
    .bind(user.id)
    .first<any>()

  const { results: recent } = await c.env.DB.prepare(
    `SELECT id, type, amount, balance_after, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
  )
    .bind(user.id)
    .all()

  return c.json({
    success: true,
    balance: balanceRow?.balance || 0,
    total_recharge: totalRecharge?.total || 0,
    total_spent: totalSpent?.total || 0,
    recent_transactions: recent,
  })
})

// ---------------------------------------------------------------
// GET /api/wallet/transactions — paginated ledger
// ---------------------------------------------------------------
wallet.get('/transactions', authRequired, async (c) => {
  const user = c.get('user')!
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = 20
  const offset = (page - 1) * limit

  const { results } = await c.env.DB.prepare(
    `SELECT id, type, amount, balance_before, balance_after, description, created_at
     FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(user.id, limit, offset)
    .all()

  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM transactions WHERE user_id = ?')
    .bind(user.id)
    .first<any>()

  return c.json({ success: true, transactions: results, total: countRow?.total || 0, page, limit })
})

// ---------------------------------------------------------------
// GET /api/wallet/payment-methods — active manual methods for recharge screen
// ---------------------------------------------------------------
wallet.get('/payment-methods', authRequired, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, method, account_number, account_type, instructions_bn FROM payment_methods WHERE status = 'active' ORDER BY sort_order ASC`
  ).all()
  const gateways = await c.env.DB.prepare(
    `SELECT provider_key, name FROM payment_gateways WHERE status = 'active' AND is_auto = 1`
  ).all()
  return c.json({ success: true, methods: results, auto_gateways: gateways.results })
})

// ---------------------------------------------------------------
// POST /api/wallet/recharge-request — manual recharge (with proof upload)
// ---------------------------------------------------------------
wallet.post('/recharge-request', authRequired, async (c) => {
  const user = c.get('user')!
  const fd = await c.req.formData().catch(() => null)
  if (!fd) return c.json({ success: false, message: 'ফর্ম ডেটা পড়া যায়নি।' }, 400)

  const method = sanitizeText(fd.get('method'), 20)
  const senderNumber = sanitizeText(fd.get('sender_number'), 20)
  const whatsappNumber = sanitizeText(fd.get('whatsapp_number'), 20)
  const transactionId = sanitizeText(fd.get('transaction_id'), 50)
  const amount = parseFloat(String(fd.get('amount') || '0'))
  const proofFile = fd.get('proof_file')

  if (!method || !['bkash', 'nagad', 'rocket', 'upay', 'other'].includes(method)) {
    return c.json({ success: false, message: 'পেমেন্ট মেথড নির্বাচন করুন।' }, 400)
  }
  if (!isValidBDPhone(senderNumber)) {
    return c.json({ success: false, message: 'সঠিক প্রেরকের মোবাইল নম্বর দিন।' }, 400)
  }
  if (!isValidBDPhone(whatsappNumber)) {
    return c.json({ success: false, message: 'সঠিক WhatsApp নম্বর দিন।' }, 400)
  }
  if (!transactionId || transactionId.length < 4) {
    return c.json({ success: false, message: 'সঠিক ট্রানজেকশন আইডি দিন।' }, 400)
  }
  if (!amount || amount < 10) {
    return c.json({ success: false, message: 'সর্বনিম্ন ১০ টাকা রিচার্জ করা যাবে।' }, 400)
  }
  if (!(proofFile instanceof File) || proofFile.size === 0) {
    return c.json({ success: false, message: 'পেমেন্টের স্ক্রিনশট/প্রুফ আপলোড করুন।' }, 400)
  }
  if (proofFile.size > 5 * 1024 * 1024) {
    return c.json({ success: false, message: 'প্রুফ ফাইল ৫MB এর বেশি হতে পারবে না।' }, 400)
  }

  const objectKey = `recharge_proofs/${user.id}/${Date.now()}-${proofFile.name}`.replace(/\s+/g, '_')
  await c.env.FILES.put(objectKey, await proofFile.arrayBuffer(), {
    httpMetadata: { contentType: proofFile.type || 'image/jpeg' },
  })

  // Duplicate transaction-id guard (avoid same proof reused across multiple requests)
  const dup = await c.env.DB.prepare(
    `SELECT id FROM recharge_requests WHERE transaction_id = ? AND status != 'rejected'`
  )
    .bind(transactionId)
    .first()
  if (dup) {
    return c.json({ success: false, message: 'এই ট্রানজেকশন আইডি দিয়ে ইতোমধ্যে একটি রিকুয়েস্ট আছে।' }, 409)
  }

  const requestNo = generateRequestNo()
  await c.env.DB.prepare(
    `INSERT INTO recharge_requests
      (request_no, user_id, method, sender_number, whatsapp_number, transaction_id, proof_file_key, amount, is_auto, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`
  )
    .bind(requestNo, user.id, method, senderNumber, whatsappNumber, transactionId, objectKey, amount)
    .run()

  await pushNotification(
    c.env.DB,
    user.id,
    'রিচার্জ রিকুয়েস্ট গৃহীত হয়েছে 🕐',
    `আপনার ৳${amount} রিচার্জ রিকুয়েস্টটি (${requestNo}) যাচাইয়ের জন্য পাঠানো হয়েছে। যাচাই সম্পন্ন হলে ব্যালেন্স যোগ হবে।`,
    'info',
    '/dashboard/wallet'
  )

  return c.json({ success: true, message: 'রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন যাচাই করার পর ব্যালেন্স যোগ হবে।', request_no: requestNo })
})

// ---------------------------------------------------------------
// GET /api/wallet/recharge-requests — my recharge history
// ---------------------------------------------------------------
wallet.get('/recharge-requests', authRequired, async (c) => {
  const user = c.get('user')!
  const { results } = await c.env.DB.prepare(
    `SELECT id, request_no, method, amount, status, admin_note, created_at, reviewed_at
     FROM recharge_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`
  )
    .bind(user.id)
    .all()
  return c.json({ success: true, requests: results })
})

// ---------------------------------------------------------------
// POST /api/wallet/redeem-coupon
// ---------------------------------------------------------------
wallet.post('/redeem-coupon', authRequired, async (c) => {
  const user = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const code = sanitizeText(body.code, 30).toUpperCase()

  if (!code) return c.json({ success: false, message: 'কুপন কোড দিন।' }, 400)

  const coupon = await c.env.DB.prepare(`SELECT * FROM coupons WHERE code = ? AND status = 'active'`)
    .bind(code)
    .first<any>()

  if (!coupon) return c.json({ success: false, message: 'কুপন কোডটি সঠিক নয় বা মেয়াদোত্তীর্ণ।' }, 404)

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return c.json({ success: false, message: 'কুপনের মেয়াদ শেষ হয়ে গেছে।' }, 400)
  }
  if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
    return c.json({ success: false, message: 'কুপনের ব্যবহারের সীমা শেষ হয়ে গেছে।' }, 400)
  }

  const userUsage = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM coupon_usages WHERE coupon_id = ? AND user_id = ?'
  )
    .bind(coupon.id, user.id)
    .first<any>()
  if (userUsage && userUsage.cnt >= (coupon.per_user_limit || 1)) {
    return c.json({ success: false, message: 'আপনি ইতোমধ্যে এই কুপনটি ব্যবহার করেছেন।' }, 400)
  }

  const bonusAmount = coupon.type === 'fixed' ? coupon.value : 0 // percentage-type coupons apply at recharge time, not standalone redeem
  if (bonusAmount <= 0) {
    return c.json({ success: false, message: 'এই কুপনটি শুধুমাত্র রিচার্জের সময় প্রযোজ্য।' }, 400)
  }

  await creditWallet(c.env.DB, user.id, bonusAmount, 'coupon_bonus', 'coupon', coupon.id, `কুপন "${code}" রিডিম করা হয়েছে`)
  await c.env.DB.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').bind(coupon.id).run()
  await c.env.DB.prepare(
    'INSERT INTO coupon_usages (coupon_id, user_id, reference_type, amount_discounted) VALUES (?, ?, ?, ?)'
  )
    .bind(coupon.id, user.id, 'standalone_redeem', bonusAmount)
    .run()

  await pushNotification(c.env.DB, user.id, 'কুপন রিডিম সফল 🎁', `৳${bonusAmount} আপনার ওয়ালেটে যোগ হয়েছে।`, 'success')

  return c.json({ success: true, message: `৳${bonusAmount} সফলভাবে যোগ হয়েছে!`, bonus: bonusAmount })
})

export default wallet
