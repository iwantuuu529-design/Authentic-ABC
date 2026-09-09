// ============================================================
// Admin settings routes — thin adapters over AdminSettingsService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminSettingsService } from '../../services'

const adminSettings = new Hono<AppEnv>()

// ---- General settings (key-value) ----
adminSettings.get('/', async (c) => {
  const result = await AdminSettingsService.getAll(c.env)
  return c.json({ success: true, ...result })
})

adminSettings.put('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminSettingsService.updateMany(c.env, admin.id, body)
  return c.json({ success: true, message: result.message })
})

// ---- Manual payment methods (bKash/Nagad numbers) ----
adminSettings.get('/payment-methods', async (c) => {
  const result = await AdminSettingsService.listPaymentMethods(c.env)
  return c.json({ success: true, ...result })
})

adminSettings.post('/payment-methods', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminSettingsService.createPaymentMethod(c.env, body)
  return c.json({ success: true, message: result.message, id: result.id })
})

adminSettings.put('/payment-methods/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminSettingsService.updatePaymentMethod(c.env, c.req.param('id'), body)
  return c.json({ success: true, message: result.message })
})

adminSettings.delete('/payment-methods/:id', async (c) => {
  const result = await AdminSettingsService.deletePaymentMethod(c.env, c.req.param('id'))
  return c.json({ success: true, message: result.message })
})

// ---- Auto payment gateways (Uddoktapay/SSLCommerz etc.) ----
adminSettings.get('/payment-gateways', async (c) => {
  const result = await AdminSettingsService.listPaymentGateways(c.env)
  return c.json({ success: true, ...result })
})

adminSettings.put('/payment-gateways/:id', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminSettingsService.updatePaymentGateway(c.env, admin.id, c.req.param('id'), body)
  return c.json({ success: true, message: result.message })
})

export default adminSettings
