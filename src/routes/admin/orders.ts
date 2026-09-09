// ============================================================
// Admin order console routes — thin adapters over AdminOrderService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { AdminOrderService } from '../../services'

const adminOrders = new Hono<AppEnv>()

// GET /api/admin/orders?status=&service_id=&page=
adminOrders.get('/', async (c) => {
  const result = await AdminOrderService.listOrders(c.env, {
    status: c.req.query('status'),
    service_id: c.req.query('service_id'),
    q: c.req.query('q'),
    page: parseInt(c.req.query('page') || '1', 10),
  })
  return c.json({ success: true, ...result })
})

// GET /api/admin/orders/:id — detail with form_data, logs
adminOrders.get('/:id', async (c) => {
  const result = await AdminOrderService.getOrderDetail(c.env, c.req.param('id'))
  return c.json({ success: true, ...result })
})

// GET /api/admin/orders/:id/upload/:fieldName — stream a user-uploaded
// form file (e.g. NID scan, photo) for this order so admin can review it.
adminOrders.get('/:id/upload/:fieldName', async (c) => {
  const file = await AdminOrderService.getUploadedFile(c.env, c.req.param('id'), c.req.param('fieldName'))
  return new Response(file.object.body, {
    headers: {
      'Content-Type': file.object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${file.filename}"`,
    },
  })
})

// PUT /api/admin/orders/:id/approve — mark completed, attach result
adminOrders.put('/:id/approve', async (c) => {
  const admin = c.get('user')!
  const contentType = c.req.header('content-type') || ''

  let note = ''
  let resultData: any = null
  let resultFile: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const fd = await c.req.formData()
    note = sanitizeText(fd.get('note'), 500)
    resultData = sanitizeText(fd.get('result_text'), 5000)
    const file = fd.get('result_file')
    if (file instanceof File && file.size > 0) resultFile = file
  } else {
    const body = await c.req.json().catch(() => ({}))
    note = sanitizeText(body.note, 500)
    resultData = body.result_data || null
  }

  const result = await AdminOrderService.approveOrder(c.env, admin.id, c.req.param('id'), { note, resultData, resultFile })
  return c.json({ success: true, message: result.message })
})

// PUT /api/admin/orders/:id/reject — reject + auto refund
adminOrders.put('/:id/reject', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminOrderService.rejectOrder(c.env, admin.id, c.req.param('id'), body.reason)
  return c.json({ success: true, message: result.message })
})

// PUT /api/admin/orders/:id/note — add internal note without status change
adminOrders.put('/:id/note', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminOrderService.setNote(c.env, admin.id, c.req.param('id'), body.note)
  return c.json({ success: true, message: result.message })
})

export default adminOrders
