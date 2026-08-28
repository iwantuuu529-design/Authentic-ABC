import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { creditWallet } from '../../lib/wallet'
import { logOrderEvent, pushNotification, logAdminAction } from '../../lib/notify'

const adminOrders = new Hono<AppEnv>()

// GET /api/admin/orders?status=&service_id=&page=
adminOrders.get('/', async (c) => {
  const status = c.req.query('status')
  const serviceId = c.req.query('service_id')
  const q = c.req.query('q')
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = 20
  const offset = (page - 1) * limit

  let query = `
    SELECT o.id, o.order_no, o.price, o.status, o.fulfillment_mode, o.created_at,
           u.id as user_id, u.name as user_name, u.phone as user_phone,
           s.name_bn as service_name, s.icon as service_icon
    FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN services s ON s.id = o.service_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) {
    query += ' AND o.status = ?'
    params.push(status)
  }
  if (serviceId) {
    query += ' AND o.service_id = ?'
    params.push(serviceId)
  }
  if (q) {
    query += ' AND (o.order_no LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM orders').first<any>()

  return c.json({ success: true, orders: results, total: countRow?.total || 0, page, limit })
})

// GET /api/admin/orders/:id — detail with form_data, logs
adminOrders.get('/:id', async (c) => {
  const id = c.req.param('id')

  const order = await c.env.DB.prepare(
    `SELECT o.*, u.name as user_name, u.phone as user_phone, u.email as user_email, s.name_bn as service_name, s.form_schema
     FROM orders o JOIN users u ON u.id = o.user_id JOIN services s ON s.id = o.service_id
     WHERE o.id = ?`
  )
    .bind(id)
    .first<any>()

  if (!order) return c.json({ success: false, message: 'অর্ডার পাওয়া যায়নি।' }, 404)

  const { results: logs } = await c.env.DB.prepare(
    'SELECT actor_type, actor_id, action, note, created_at FROM order_logs WHERE order_id = ? ORDER BY created_at ASC'
  )
    .bind(id)
    .all()

  let formData = {}
  let formSchema = []
  try {
    formData = JSON.parse(order.form_data)
  } catch {}
  try {
    formSchema = JSON.parse(order.form_schema)
  } catch {}

  return c.json({ success: true, order: { ...order, form_data: formData, form_schema: formSchema }, logs })
})

// GET /api/admin/orders/:id/upload/:fieldName — stream a user-uploaded
// form file (e.g. NID scan, photo) for this order so admin can review it.
// This is DIFFERENT from GET /api/orders/:id/result-file, which serves the
// file the ADMIN attaches as the order's *result* — this one serves what
// the USER submitted as part of the order form.
adminOrders.get('/:id/upload/:fieldName', async (c) => {
  const id = c.req.param('id')
  const fieldName = c.req.param('fieldName')

  const order = await c.env.DB.prepare('SELECT form_data FROM orders WHERE id = ?').bind(id).first<any>()
  if (!order) return c.json({ success: false, message: 'অর্ডার পাওয়া যায়নি।' }, 404)

  let formData: Record<string, any> = {}
  try {
    formData = JSON.parse(order.form_data)
  } catch {}

  const objectKey = formData[fieldName]
  if (!objectKey || typeof objectKey !== 'string' || !objectKey.startsWith(`orders/`)) {
    return c.json({ success: false, message: 'ফাইল পাওয়া যায়নি।' }, 404)
  }

  const object = await c.env.FILES.get(objectKey)
  if (!object) return c.json({ success: false, message: 'ফাইল পাওয়া যায়নি।' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${objectKey.split('/').pop()}"`,
    },
  })
})

// PUT /api/admin/orders/:id/approve — mark completed, attach result
adminOrders.put('/:id/approve', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const contentType = c.req.header('content-type') || ''

  let resultData: any = null
  let resultFileKey: string | null = null
  let note = ''

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>()
  if (!order) return c.json({ success: false, message: 'অর্ডার পাওয়া যায়নি।' }, 404)
  if (order.status === 'completed') {
    return c.json({ success: false, message: 'এই অর্ডারটি ইতোমধ্যে সম্পন্ন হয়েছে।' }, 400)
  }

  if (contentType.includes('multipart/form-data')) {
    const fd = await c.req.formData()
    note = sanitizeText(fd.get('note'), 500)
    resultData = sanitizeText(fd.get('result_text'), 5000)
    const file = fd.get('result_file')
    if (file instanceof File && file.size > 0) {
      const key = `results/${order.user_id}/${Date.now()}-${file.name}`.replace(/\s+/g, '_')
      await c.env.FILES.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      })
      resultFileKey = key
    }
  } else {
    const body = await c.req.json().catch(() => ({}))
    note = sanitizeText(body.note, 500)
    resultData = body.result_data || null
  }

  await c.env.DB.prepare(
    `UPDATE orders SET status = 'completed', result_data = ?, result_file_key = COALESCE(?, result_file_key),
     admin_note = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(typeof resultData === 'string' ? resultData : JSON.stringify(resultData || {}), resultFileKey, note, admin.id, id)
    .run()

  await c.env.DB.prepare('UPDATE services SET success_orders = success_orders + 1 WHERE id = ?').bind(order.service_id).run()

  await logOrderEvent(c.env.DB, parseInt(id), 'admin', admin.id, 'approved', note || 'এডমিন কর্তৃক সম্পন্ন করা হয়েছে')
  await pushNotification(
    c.env.DB,
    order.user_id,
    'অর্ডার সম্পন্ন হয়েছে ✅',
    `আপনার অর্ডার (${order.order_no}) সম্পন্ন করা হয়েছে। বিস্তারিত দেখতে ক্লিক করুন।`,
    'success',
    `/dashboard/orders/${id}`
  )

  return c.json({ success: true, message: 'অর্ডার সম্পন্ন করা হয়েছে এবং ইউজারকে জানানো হয়েছে।' })
})

// PUT /api/admin/orders/:id/reject — reject + auto refund
adminOrders.put('/:id/reject', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const reason = sanitizeText(body.reason, 500) || 'তথ্য যাচাই করা যায়নি'

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>()
  if (!order) return c.json({ success: false, message: 'অর্ডার পাওয়া যায়নি।' }, 404)
  if (['completed', 'rejected', 'refunded'].includes(order.status)) {
    return c.json({ success: false, message: 'এই অর্ডারের স্ট্যাটাস পরিবর্তন করা সম্ভব নয়।' }, 400)
  }

  // Auto-refund if price was charged
  if (order.price > 0) {
    await creditWallet(c.env.DB, order.user_id, order.price, 'refund', 'order', order.id, `অর্ডার (${order.order_no}) বাতিল - অটো রিফান্ড`)
  }

  await c.env.DB.prepare(
    `UPDATE orders SET status = 'rejected', admin_note = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(reason, admin.id, id)
    .run()

  await logOrderEvent(c.env.DB, parseInt(id), 'admin', admin.id, 'rejected', reason)
  await logOrderEvent(c.env.DB, parseInt(id), 'system', null, 'refunded', `৳${order.price} স্বয়ংক্রিয়ভাবে ফেরত দেওয়া হয়েছে`)

  await pushNotification(
    c.env.DB,
    order.user_id,
    'অর্ডার বাতিল হয়েছে',
    `আপনার অর্ডার (${order.order_no}) বাতিল করা হয়েছে। কারণ: ${reason}। ${order.price > 0 ? `৳${order.price} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।` : ''}`,
    'warning',
    `/dashboard/orders/${id}`
  )

  return c.json({ success: true, message: 'অর্ডার বাতিল করা হয়েছে এবং টাকা ফেরত দেওয়া হয়েছে।' })
})

// PUT /api/admin/orders/:id/note — add internal note without status change
adminOrders.put('/:id/note', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const note = sanitizeText(body.note, 500)

  await c.env.DB.prepare('UPDATE orders SET admin_note = ? WHERE id = ?').bind(note, id).run()
  await logOrderEvent(c.env.DB, parseInt(id), 'admin', admin.id, 'note', note)

  return c.json({ success: true, message: 'নোট যোগ করা হয়েছে।' })
})

export default adminOrders
