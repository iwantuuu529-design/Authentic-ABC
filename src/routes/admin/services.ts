// ============================================================
// Admin service/catalog management routes — thin adapters over
// AdminCatalogService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminCatalogService } from '../../services'

const adminServices = new Hono<AppEnv>()

// GET /api/admin/services — all (incl inactive) for management
adminServices.get('/', async (c) => {
  const result = await AdminCatalogService.listServices(c.env)
  return c.json({ success: true, ...result })
})

// GET /api/admin/services/categories
adminServices.get('/categories', async (c) => {
  const result = await AdminCatalogService.listCategories(c.env)
  return c.json({ success: true, ...result })
})

adminServices.post('/categories', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminCatalogService.createCategory(c.env, body)
  return c.json({ success: true, message: result.message, id: result.id })
})

// POST /api/admin/services — create new service (dynamic form schema, fulfillment mode)
adminServices.post('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminCatalogService.createService(c.env, admin.id, body)
  return c.json({ success: true, message: result.message, id: result.id })
})

// PUT /api/admin/services/:id — update
adminServices.put('/:id', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminCatalogService.updateService(c.env, admin.id, c.req.param('id'), body)
  return c.json({ success: true, message: result.message })
})

// PATCH /api/admin/services/:id/rate — quick rate/price update by admin
adminServices.patch('/:id/rate', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminCatalogService.updateRate(c.env, admin.id, c.req.param('id'), body)
  return c.json({ success: true, message: result.message })
})

// DELETE /api/admin/services/:id
adminServices.delete('/:id', async (c) => {
  const admin = c.get('user')!
  const result = await AdminCatalogService.deleteService(c.env, admin.id, c.req.param('id'))
  return c.json({ success: true, message: result.message })
})

export default adminServices
