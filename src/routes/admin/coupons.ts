import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'

const adminCoupons = new Hono<AppEnv>()

adminCoupons.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()
  return c.json({ success: true, coupons: results })
})

adminCoupons.post('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const code = sanitizeText(body.code, 30).toUpperCase()
  const type = sanitizeText(body.type, 20) || 'fixed'
  const value = parseFloat(body.value)

  if (!code || isNaN(value) || value <= 0) {
    return c.json({ success: false, message: 'কুপন কোড ও মূল্য সঠিকভাবে দিন।' }, 400)
  }
  if (!['fixed', 'percentage'].includes(type)) {
    return c.json({ success: false, message: 'সঠিক টাইপ দিন (fixed/percentage)।' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM coupons WHERE code = ?').bind(code).first()
  if (existing) return c.json({ success: false, message: 'এই কোড ইতোমধ্যে ব্যবহৃত হয়েছে।' }, 409)

  const result = await c.env.DB.prepare(
    `INSERT INTO coupons (code, type, value, min_recharge, max_discount, usage_limit, per_user_limit, applicable_to, expires_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  )
    .bind(
      code,
      type,
      value,
      body.min_recharge || 0,
      body.max_discount || null,
      body.usage_limit || 0,
      body.per_user_limit || 1,
      body.applicable_to || 'recharge',
      body.expires_at || null
    )
    .run()

  await logAdminAction(c.env.DB, admin.id, 'coupon_created', 'coupon', result.meta.last_row_id as number, code)

  return c.json({ success: true, message: 'কুপন তৈরি হয়েছে।', id: result.meta.last_row_id })
})

adminCoupons.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const status = sanitizeText(body.status, 20)

  if (status && ['active', 'inactive'].includes(status)) {
    await c.env.DB.prepare('UPDATE coupons SET status = ? WHERE id = ?').bind(status, id).run()
  }
  return c.json({ success: true, message: 'কুপন আপডেট হয়েছে।' })
})

adminCoupons.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: 'কুপন মুছে ফেলা হয়েছে।' })
})

export default adminCoupons
