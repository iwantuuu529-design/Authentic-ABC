// ============================================================
// Admin API provider routes — thin adapters over AdminProviderService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminProviderService } from '../../services'

const adminProviders = new Hono<AppEnv>()

// GET /api/admin/api-providers — list (secrets masked)
adminProviders.get('/', async (c) => {
  const result = await AdminProviderService.listProviders(c.env)
  return c.json({ success: true, ...result })
})

// POST /api/admin/api-providers — register a new pluggable API provider (no code deploy needed)
adminProviders.post('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminProviderService.createProvider(c.env, admin.id, body)
  return c.json({ success: true, message: result.message, id: result.id })
})

// PUT /api/admin/api-providers/:id
adminProviders.put('/:id', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminProviderService.updateProvider(c.env, admin.id, c.req.param('id'), body)
  return c.json({ success: true, message: result.message })
})

adminProviders.delete('/:id', async (c) => {
  const result = await AdminProviderService.deleteProvider(c.env, c.req.param('id'))
  return c.json({ success: true, message: result.message })
})

// POST /api/admin/api-providers/:id/test — dry-run test call with sample data
adminProviders.post('/:id/test', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminProviderService.testProvider(c.env, c.req.param('id'), body.sample_data || {})
  return c.json(result)
})

export default adminProviders
