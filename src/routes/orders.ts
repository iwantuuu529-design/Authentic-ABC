import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { generateOrderNo } from '../utils/crypto'
import { debitWallet, creditWallet } from '../lib/wallet'
import { logOrderEvent, pushNotification } from '../lib/notify'
import { callApiProvider } from '../lib/apiProvider'
import { verifyCaptcha } from '../lib/captcha'
import { getJwtSecret } from '../lib/jwt'

const orders = new Hono<AppEnv>()

// ---------------------------------------------------------------
// GET /api/orders — my orders (paginated + status filter)
// ---------------------------------------------------------------
orders.get('/', authRequired, async (c) => {
  const user = c.get('user')!
  const status = c.req.query('status')
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = 15
  const offset = (page - 1) * limit

  let query = `
    SELECT o.id, o.order_no, o.price, o.status, o.fulfillment_mode, o.created_at, o.processed_at,
           s.name_bn as service_name, s.icon as service_icon, s.slug as service_slug
    FROM orders o JOIN services s ON s.id = o.service_id
    WHERE o.user_id = ?
  `
  const params: any[] = [user.id]
  if (status) {
    query += ' AND o.status = ?'
    params.push(status)
  }
  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM orders WHERE user_id = ?${status ? ' AND status = ?' : ''}`
  )
    .bind(...(status ? [user.id, status] : [user.id]))
    .first<{ total: number }>()

  return c.json({ success: true, orders: results, total: countRow?.total || 0, page, limit })
})

// ---------------------------------------------------------------
// GET /api/orders/:id — order detail with timeline
// ---------------------------------------------------------------
orders.get('/:id', authRequired, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')

  const order = await c.env.DB.prepare(
    `SELECT o.*, s.name_bn as service_name, s.icon as service_icon
     FROM orders o JOIN services s ON s.id = o.service_id
     WHERE o.id = ? AND o.user_id = ?`
  )
    .bind(id, user.id)
    .first<any>()

  if (!order) return c.json({ success: false, message: 'অর্ডার খুঁজে পাওয়া যায়নি।' }, 404)

  const logs = await c.env.DB.prepare(
    `SELECT actor_type, action, note, created_at FROM order_logs WHERE order_id = ? ORDER BY created_at ASC`
  )
    .bind(id)
    .all()

  let formData = {}
  let resultData = null
  try {
    formData = JSON.parse(order.form_data)
  } catch {}
  try {
    resultData = order.result_data ? JSON.parse(order.result_data) : null
  } catch {
    resultData = order.result_data
  }

  return c.json({
    success: true,
    order: { ...order, form_data: formData, result_data: resultData },
    logs: logs.results,
  })
})

// ---------------------------------------------------------------
// POST /api/orders — create a new order (supports multipart for file fields)
// ---------------------------------------------------------------
orders.post('/', authRequired, async (c) => {
  const user = c.get('user')!
  const contentType = c.req.header('content-type') || ''

  let formValues: Record<string, any> = {}
  let serviceSlug = ''
  let captchaToken = ''
  let captchaAnswer = ''
  const fileKeys: Record<string, string> = {}

  if (contentType.includes('multipart/form-data')) {
    const fd = await c.req.formData()
    serviceSlug = String(fd.get('service_slug') || '')
    captchaToken = String(fd.get('captcha_token') || '')
    captchaAnswer = String(fd.get('captcha_answer') || '')
    for (const [key, value] of fd.entries()) {
      if (key === 'service_slug' || key === 'captcha_token' || key === 'captcha_answer') continue
      if (value instanceof File) {
        if (value.size > 8 * 1024 * 1024) {
          return c.json({ success: false, message: `${key} ফাইলের সাইজ ৮MB এর বেশি হতে পারবে না।` }, 400)
        }
        const objectKey = `orders/${user.id}/${Date.now()}-${key}-${value.name}`.replace(/\s+/g, '_')
        await c.env.FILES.put(objectKey, await value.arrayBuffer(), {
          httpMetadata: { contentType: value.type || 'application/octet-stream' },
        })
        fileKeys[key] = objectKey
        formValues[key] = objectKey
      } else {
        formValues[key] = value
      }
    }
  } else {
    const body = await c.req.json().catch(() => ({}))
    serviceSlug = body.service_slug
    captchaToken = body.captcha_token
    captchaAnswer = body.captcha_answer
    formValues = body.form_data || {}
  }

  if (!serviceSlug) {
    return c.json({ success: false, message: 'সার্ভিস নির্বাচন করুন।' }, 400)
  }

  const service = await c.env.DB.prepare(
    `SELECT * FROM services WHERE slug = ? AND status = 'active'`
  )
    .bind(serviceSlug)
    .first<any>()

  if (!service) {
    return c.json({ success: false, message: 'সার্ভিসটি বর্তমানে সক্রিয় নেই।' }, 404)
  }

  // Captcha verification
  if (service.requires_captcha) {
    if (!captchaToken || !captchaAnswer) {
      return c.json({ success: false, message: 'ক্যাপচা যাচাই করুন।' }, 400)
    }
    const captchaOk = await verifyCaptcha(getJwtSecret(c.env), captchaToken, captchaAnswer)
    if (!captchaOk) {
      return c.json({ success: false, message: 'ক্যাপচার উত্তর ভুল অথবা মেয়াদোত্তীর্ণ। আবার চেষ্টা করুন।' }, 400)
    }
  }

  // Validate against dynamic form schema
  let schema: any[] = []
  try {
    schema = JSON.parse(service.form_schema)
  } catch {}

  for (const field of schema) {
    if (field.required && !formValues[field.name] && field.type !== 'file') {
      return c.json({ success: false, message: `"${field.label_bn}" পূরণ করা আবশ্যক।` }, 400)
    }
    if (field.required && field.type === 'file' && !fileKeys[field.name]) {
      return c.json({ success: false, message: `"${field.label_bn}" ফাইল আপলোড করুন।` }, 400)
    }
    if (field.pattern && formValues[field.name]) {
      const re = new RegExp(field.pattern)
      if (!re.test(String(formValues[field.name]))) {
        return c.json({ success: false, message: `"${field.label_bn}" এর ফরম্যাট সঠিক নয়।` }, 400)
      }
    }
  }

  // Debit wallet atomically (skip for free services priced at 0)
  if (service.price > 0) {
    const debit = await debitWallet(
      c.env.DB,
      user.id,
      service.price,
      'order_payment',
      'order',
      null,
      `${service.name_bn} সার্ভিসের মূল্য পরিশোধ`
    )
    if (!debit.success) {
      return c.json(
        { success: false, message: 'আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে রিচার্জ করুন।', code: 'INSUFFICIENT_BALANCE' },
        402
      )
    }
  }

  const orderNo = generateOrderNo()
  const result = await c.env.DB.prepare(
    `INSERT INTO orders (order_no, user_id, service_id, form_data, price, fulfillment_mode, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  )
    .bind(orderNo, user.id, service.id, JSON.stringify(formValues), service.price, service.fulfillment_mode)
    .run()

  const orderId = result.meta.last_row_id as number
  await logOrderEvent(c.env.DB, orderId, 'user', user.id, 'created', 'অর্ডার তৈরি হয়েছে')

  await c.env.DB.prepare('UPDATE services SET total_orders = total_orders + 1 WHERE id = ?').bind(service.id).run()

  // ---- Fulfillment ----
  if (service.fulfillment_mode === 'api' || service.fulfillment_mode === 'hybrid') {
    if (service.api_provider_id) {
      const provider = await c.env.DB.prepare('SELECT * FROM api_providers WHERE id = ? AND status = \'active\'')
        .bind(service.api_provider_id)
        .first<any>()

      if (provider) {
        await c.env.DB.prepare(`UPDATE orders SET status = 'processing' WHERE id = ?`).bind(orderId).run()
        await logOrderEvent(c.env.DB, orderId, 'system', null, 'auto_processing', `${provider.name} API-তে পাঠানো হয়েছে`)

        let fieldMapping: Record<string, string> | null = null
        try {
          fieldMapping = service.field_mapping ? JSON.parse(service.field_mapping) : null
        } catch {}

        const apiResult = await callApiProvider(provider, fieldMapping, formValues)
        await c.env.DB.prepare('UPDATE api_providers SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(provider.id)
          .run()

        if (apiResult.ok) {
          await c.env.DB.prepare(
            `UPDATE orders SET status = 'completed', result_data = ?, api_raw_response = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
            .bind(JSON.stringify(apiResult.result ?? {}), JSON.stringify(apiResult.raw ?? {}), orderId)
            .run()
          await c.env.DB.prepare('UPDATE services SET success_orders = success_orders + 1 WHERE id = ?')
            .bind(service.id)
            .run()
          await logOrderEvent(c.env.DB, orderId, 'system', null, 'api_success', 'স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে')
          await pushNotification(
            c.env.DB,
            user.id,
            'অর্ডার সম্পন্ন হয়েছে ✅',
            `আপনার "${service.name_bn}" অর্ডারটি (${orderNo}) স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে।`,
            'success',
            `/dashboard/orders/${orderId}`
          )
        } else {
          // API failed -> fallback to manual review queue (hybrid safety net) + auto-refund if pure API mode
          if (service.fulfillment_mode === 'api') {
            await creditWallet(
              c.env.DB,
              user.id,
              service.price,
              'refund',
              'order',
              orderId,
              `${service.name_bn} - API ব্যর্থ হওয়ায় স্বয়ংক্রিয় রিফান্ড`
            )
            await c.env.DB.prepare(
              `UPDATE orders SET status = 'refunded', api_raw_response = ?, admin_note = ? WHERE id = ?`
            )
              .bind(JSON.stringify(apiResult.raw ?? {}), apiResult.errorMessage || 'API failed', orderId)
              .run()
            await logOrderEvent(c.env.DB, orderId, 'system', null, 'refunded', apiResult.errorMessage || 'API ব্যর্থ - অটো রিফান্ড')
            await pushNotification(
              c.env.DB,
              user.id,
              'অর্ডার ব্যর্থ - রিফান্ড সম্পন্ন ↩️',
              `"${service.name_bn}" অর্ডারটি প্রসেস করা যায়নি। ৳${service.price} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`,
              'warning',
              `/dashboard/orders/${orderId}`
            )
          } else {
            // hybrid -> keep pending for manual admin review, don't refund yet
            await c.env.DB.prepare(
              `UPDATE orders SET status = 'pending', api_raw_response = ?, admin_note = ? WHERE id = ?`
            )
              .bind(JSON.stringify(apiResult.raw ?? {}), 'API failed, needs manual review', orderId)
              .run()
            await logOrderEvent(c.env.DB, orderId, 'system', null, 'api_failed', 'API ব্যর্থ - ম্যানুয়াল রিভিউতে পাঠানো হয়েছে')
          }
        }
      }
    }
  } else {
    await pushNotification(
      c.env.DB,
      user.id,
      'অর্ডার গৃহীত হয়েছে 🕐',
      `আপনার "${service.name_bn}" অর্ডারটি (${orderNo}) গৃহীত হয়েছে এবং ম্যানুয়ালি প্রসেস করা হবে।`,
      'info',
      `/dashboard/orders/${orderId}`
    )
  }

  const finalOrder = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first()

  return c.json({ success: true, message: 'অর্ডার সফলভাবে সাবমিট হয়েছে।', order: finalOrder })
})

// ---------------------------------------------------------------
// GET /api/orders/:id/result-file — secure download of R2 result file
// ---------------------------------------------------------------
orders.get('/:id/result-file', authRequired, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')

  const order = await c.env.DB.prepare('SELECT result_file_key FROM orders WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<any>()

  if (!order || !order.result_file_key) {
    return c.json({ success: false, message: 'ফাইল পাওয়া যায়নি।' }, 404)
  }

  const object = await c.env.FILES.get(order.result_file_key)
  if (!object) return c.json({ success: false, message: 'ফাইল পাওয়া যায়নি।' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${order.result_file_key.split('/').pop()}"`,
    },
  })
})

export default orders
