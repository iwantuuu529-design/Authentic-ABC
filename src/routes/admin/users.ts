import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { creditWallet, debitWallet } from '../../lib/wallet'
import { logAdminAction, pushNotification } from '../../lib/notify'

const adminUsers = new Hono<AppEnv>()

// GET /api/admin/users?q=&status=&page=
adminUsers.get('/', async (c) => {
  const q = c.req.query('q')
  const status = c.req.query('status')
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = 20
  const offset = (page - 1) * limit

  let query = `SELECT id, name, phone, email, balance, role, status, kyc_status, created_at FROM users WHERE role = 'user'`
  const params: any[] = []
  if (q) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM users WHERE role = 'user'`).first<any>()

  return c.json({ success: true, users: results, total: countRow?.total || 0, page, limit })
})

// GET /api/admin/users/:id — full detail with orders/transactions
adminUsers.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = await c.env.DB.prepare(
    `SELECT id, name, phone, email, whatsapp, balance, role, status, kyc_status, kyc_nid_number, referral_code, created_at, last_login_at, last_login_ip
     FROM users WHERE id = ?`
  )
    .bind(id)
    .first()
  if (!user) return c.json({ success: false, message: 'ইউজার পাওয়া যায়নি।' }, 404)

  const { results: orders } = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.price, o.status, o.created_at, s.name_bn as service_name
     FROM orders o JOIN services s ON s.id = o.service_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 20`
  )
    .bind(id)
    .all()

  const { results: transactions } = await c.env.DB.prepare(
    `SELECT type, amount, balance_after, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
  )
    .bind(id)
    .all()

  return c.json({ success: true, user, orders, transactions })
})

// PUT /api/admin/users/:id/status — approve (pending→active) / suspend / activate / ban
adminUsers.put('/:id/status', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const status = sanitizeText(body.status, 20)

  if (!['pending', 'active', 'suspended', 'banned'].includes(status)) {
    return c.json({ success: false, message: 'সঠিক স্ট্যাটাস দিন।' }, 400)
  }

  const before = await c.env.DB.prepare('SELECT status FROM users WHERE id = ?').bind(id).first<any>()

  await c.env.DB.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, id).run()
  await logAdminAction(c.env.DB, admin.id, 'user_status_change', 'user', parseInt(id), `Status changed to ${status}`)

  // Notify the user when their account moves from pending → active (i.e. admin approval)
  if (before?.status === 'pending' && status === 'active') {
    await pushNotification(
      c.env.DB,
      parseInt(id),
      'অ্যাকাউন্ট অনুমোদিত হয়েছে! ✅',
      'আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে। এখন আপনি লগইন করে সকল সার্ভিস ব্যবহার করতে পারবেন।',
      'success',
      '/dashboard'
    )
  }

  return c.json({ success: true, message: status === 'active' && before?.status === 'pending' ? 'ইউজার অনুমোদন করা হয়েছে।' : 'ইউজারের স্ট্যাটাস আপডেট হয়েছে।' })
})

// POST /api/admin/users/:id/adjust-balance — manual credit/debit with reason
adminUsers.post('/:id/adjust-balance', async (c) => {
  const admin = c.get('user')!
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.json().catch(() => ({}))
  const amount = parseFloat(body.amount)
  const reason = sanitizeText(body.reason, 200) || 'এডমিন কর্তৃক ব্যালেন্স সমন্বয়'

  if (!amount || isNaN(amount) || amount === 0) {
    return c.json({ success: false, message: 'সঠিক পরিমাণ দিন (পজিটিভ = যোগ, নেগেটিভ = বিয়োগ)।' }, 400)
  }

  let result
  if (amount > 0) {
    result = await creditWallet(c.env.DB, id, amount, 'admin_adjustment', 'manual', admin.id, reason)
  } else {
    result = await debitWallet(c.env.DB, id, Math.abs(amount), 'admin_adjustment', 'manual', admin.id, reason)
  }

  if (!result.success) {
    return c.json({ success: false, message: result.reason === 'insufficient_balance' ? 'ইউজারের ব্যালেন্স যথেষ্ট নয়।' : 'ব্যর্থ হয়েছে।' }, 400)
  }

  await logAdminAction(c.env.DB, admin.id, 'balance_adjustment', 'user', id, `${amount > 0 ? '+' : ''}${amount} — ${reason}`)
  await pushNotification(
    c.env.DB,
    id,
    'ব্যালেন্স আপডেট হয়েছে',
    `আপনার ওয়ালেটে ${amount > 0 ? '৳' + amount + ' যোগ' : '৳' + Math.abs(amount) + ' বিয়োগ'} করা হয়েছে। কারণ: ${reason}`,
    amount > 0 ? 'success' : 'warning'
  )

  return c.json({ success: true, message: 'ব্যালেন্স আপডেট হয়েছে।', balance_after: result.balanceAfter })
})

// PUT /api/admin/users/:id/kyc — approve/reject KYC
adminUsers.put('/:id/kyc', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const status = sanitizeText(body.status, 20)

  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return c.json({ success: false, message: 'সঠিক স্ট্যাটাস দিন।' }, 400)
  }

  await c.env.DB.prepare('UPDATE users SET kyc_status = ? WHERE id = ?').bind(status, id).run()
  await logAdminAction(c.env.DB, admin.id, 'kyc_review', 'user', parseInt(id), `KYC ${status}`)
  await pushNotification(
    c.env.DB,
    parseInt(id),
    'KYC আপডেট',
    status === 'verified' ? 'আপনার KYC ভেরিফাই করা হয়েছে।' : 'আপনার KYC প্রত্যাখ্যান করা হয়েছে। আবার সাবমিট করুন।',
    status === 'verified' ? 'success' : 'error'
  )

  return c.json({ success: true, message: 'KYC স্ট্যাটাস আপডেট হয়েছে।' })
})

export default adminUsers
