// ============================================================
// Admin recharge approval routes — thin adapters over
// AdminRechargeService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminRechargeService } from '../../services'

const adminRecharge = new Hono<AppEnv>()

// GET /api/admin/recharge-requests?status=&page=
adminRecharge.get('/', async (c) => {
  const result = await AdminRechargeService.listRequests(c.env, {
    status: c.req.query('status'),
    page: parseInt(c.req.query('page') || '1', 10),
  })
  return c.json({ success: true, ...result })
})

// GET /api/admin/recharge-requests/:id/proof — stream proof image
adminRecharge.get('/:id/proof', async (c) => {
  const file = await AdminRechargeService.getProof(c.env, c.req.param('id'))
  return new Response(file.object.body, {
    headers: { 'Content-Type': file.object.httpMetadata?.contentType || 'image/jpeg' },
  })
})

// PUT /api/admin/recharge-requests/:id/approve
adminRecharge.put('/:id/approve', async (c) => {
  const admin = c.get('user')!
  const result = await AdminRechargeService.approve(c.env, admin.id, c.req.param('id'))
  return c.json({ success: true, message: result.message })
})

// PUT /api/admin/recharge-requests/:id/reject
adminRecharge.put('/:id/reject', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminRechargeService.reject(c.env, admin.id, c.req.param('id'), body.reason)
  return c.json({ success: true, message: result.message })
})

export default adminRecharge
