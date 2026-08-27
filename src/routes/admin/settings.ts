import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'

const adminSettings = new Hono<AppEnv>()

// ---- General settings (key-value) ----
adminSettings.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const settings: Record<string, string> = {}
  for (const row of results as any[]) settings[row.key] = row.value
  return c.json({ success: true, settings })
})

adminSettings.put('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  for (const [key, value] of Object.entries(body)) {
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    )
      .bind(key, String(value))
      .run()
  }
  await logAdminAction(c.env.DB, admin.id, 'settings_updated', 'settings', undefined, JSON.stringify(Object.keys(body)))
  return c.json({ success: true, message: 'সেটিংস আপডেট হয়েছে।' })
})

// ---- Manual payment methods (bKash/Nagad numbers) ----
adminSettings.get('/payment-methods', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM payment_methods ORDER BY sort_order ASC').all()
  return c.json({ success: true, methods: results })
})

adminSettings.post('/payment-methods', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const method = sanitizeText(body.method, 20)
  const accountNumber = sanitizeText(body.account_number, 30)

  if (!method || !accountNumber) {
    return c.json({ success: false, message: 'মেথড ও একাউন্ট নম্বর দিন।' }, 400)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO payment_methods (method, account_number, account_type, instructions_bn, sort_order) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(method, accountNumber, body.account_type || 'personal', body.instructions_bn || '', body.sort_order || 0)
    .run()

  return c.json({ success: true, message: 'পেমেন্ট মেথড যোগ করা হয়েছে।', id: result.meta.last_row_id })
})

adminSettings.put('/payment-methods/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const existing = await c.env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?').bind(id).first<any>()
  if (!existing) return c.json({ success: false, message: 'পাওয়া যায়নি।' }, 404)

  await c.env.DB.prepare(
    `UPDATE payment_methods SET method = ?, account_number = ?, account_type = ?, instructions_bn = ?, status = ?, sort_order = ? WHERE id = ?`
  )
    .bind(
      body.method || existing.method,
      body.account_number || existing.account_number,
      body.account_type || existing.account_type,
      body.instructions_bn ?? existing.instructions_bn,
      body.status || existing.status,
      body.sort_order ?? existing.sort_order,
      id
    )
    .run()

  return c.json({ success: true, message: 'আপডেট হয়েছে।' })
})

adminSettings.delete('/payment-methods/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM payment_methods WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: 'মুছে ফেলা হয়েছে।' })
})

// ---- Auto payment gateways (Uddoktapay/SSLCommerz etc.) ----
adminSettings.get('/payment-gateways', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM payment_gateways').all()
  const masked = (results as any[]).map((g) => ({
    ...g,
    api_key: g.api_key ? '••••••••' + String(g.api_key).slice(-4) : null,
    api_secret: g.api_secret ? '••••••••' : null,
  }))
  return c.json({ success: true, gateways: masked })
})

adminSettings.put('/payment-gateways/:id', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const existing = await c.env.DB.prepare('SELECT * FROM payment_gateways WHERE id = ?').bind(id).first<any>()
  if (!existing) return c.json({ success: false, message: 'পাওয়া যায়নি।' }, 404)

  await c.env.DB.prepare(
    `UPDATE payment_gateways SET
      api_base_url = ?, api_key = COALESCE(?, api_key), api_secret = COALESCE(?, api_secret),
      config = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(
      body.api_base_url || existing.api_base_url,
      body.api_key || null,
      body.api_secret || null,
      body.config ? JSON.stringify(body.config) : existing.config,
      body.status || existing.status,
      id
    )
    .run()

  await logAdminAction(c.env.DB, admin.id, 'payment_gateway_updated', 'payment_gateway', parseInt(id))

  return c.json({ success: true, message: 'গেটওয়ে আপডেট হয়েছে।' })
})

export default adminSettings
