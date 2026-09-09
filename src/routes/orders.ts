// ============================================================
// User order routes — thin adapters over OrderService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { OrderService } from '../services'

const orders = new Hono<AppEnv>()

// GET /api/orders — my orders (paginated + status filter)
orders.get('/', authRequired, async (c) => {
  const user = c.get('user')!
  const result = await OrderService.listMyOrders(c.env, user.id, {
    status: c.req.query('status'),
    page: parseInt(c.req.query('page') || '1', 10),
  })
  return c.json({ success: true, ...result })
})

// GET /api/orders/:id — order detail with timeline
orders.get('/:id', authRequired, async (c) => {
  const user = c.get('user')!
  const result = await OrderService.getOrderDetail(c.env, user.id, c.req.param('id'))
  return c.json({ success: true, ...result })
})

// GET /api/orders/:id/upload/:fieldName — download/view a file the
// current user themselves uploaded as part of this order's form
// (e.g. NID scan). Ownership-checked via user_id, mirrors the admin
// version at /api/admin/orders/:id/upload/:fieldName.
orders.get('/:id/upload/:fieldName', authRequired, async (c) => {
  const user = c.get('user')!
  const file = await OrderService.getUploadedFile(c.env, user.id, c.req.param('id'), c.req.param('fieldName'))
  return new Response(file.object.body, {
    headers: {
      'Content-Type': file.object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${file.filename}"`,
    },
  })
})

// POST /api/orders — create a new order (supports multipart for file fields)
orders.post('/', authRequired, async (c) => {
  const user = c.get('user')!
  const contentType = c.req.header('content-type') || ''

  const input = contentType.includes('multipart/form-data')
    ? await OrderService.parseMultipartInput(c.env, user.id, await c.req.formData())
    : OrderService.parseJsonInput(await c.req.json().catch(() => ({})))

  const order = await OrderService.createOrder(c.env, user.id, input)
  return c.json({ success: true, message: 'অর্ডার সফলভাবে সাবমিট হয়েছে।', order })
})

// GET /api/orders/:id/result-file — secure download of R2 result file
orders.get('/:id/result-file', authRequired, async (c) => {
  const user = c.get('user')!
  const file = await OrderService.getResultFile(c.env, user.id, c.req.param('id'))
  return new Response(file.object.body, {
    headers: {
      'Content-Type': file.object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    },
  })
})

export default orders
