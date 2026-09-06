import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'

const adminServices = new Hono<AppEnv>()

// GET /api/admin/services — all (incl inactive) for management
adminServices.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, c.name_bn as category_name_bn, ap.name as api_provider_name
     FROM services s
     LEFT JOIN service_categories c ON c.id = s.category_id
     LEFT JOIN api_providers ap ON ap.id = s.api_provider_id
     ORDER BY s.sort_order ASC`
  ).all()
  return c.json({ success: true, services: results })
})

// GET /api/admin/services/categories
adminServices.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM service_categories ORDER BY sort_order ASC').all()
  return c.json({ success: true, categories: results })
})

adminServices.post('/categories', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const nameBn = sanitizeText(body.name_bn, 100)
  const nameEn = sanitizeText(body.name_en, 100)
  const slug = sanitizeText(body.slug, 50).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const icon = sanitizeText(body.icon, 50) || 'fa-layer-group'

  if (!nameBn || !nameEn || !slug) {
    return c.json({ success: false, message: 'ক্যাটাগরির নাম ও স্লাগ আবশ্যক।' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO service_categories (name_bn, name_en, slug, icon) VALUES (?, ?, ?, ?)'
  )
    .bind(nameBn, nameEn, slug, icon)
    .run()

  return c.json({ success: true, message: 'ক্যাটাগরি তৈরি হয়েছে।', id: result.meta.last_row_id })
})

// POST /api/admin/services — create new service (dynamic form schema, fulfillment mode)
adminServices.post('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))

  const nameBn = sanitizeText(body.name_bn, 150)
  const nameEn = sanitizeText(body.name_en, 150)
  const slug = sanitizeText(body.slug, 80).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const price = parseFloat(body.price)
  const fulfillmentMode = sanitizeText(body.fulfillment_mode, 20) || 'manual'

  if (!nameBn || !nameEn || !slug || isNaN(price) || price < 0) {
    return c.json({ success: false, message: 'সার্ভিসের নাম, স্লাগ ও মূল্য সঠিকভাবে দিন।' }, 400)
  }
  if (!['manual', 'api', 'hybrid', 'auto'].includes(fulfillmentMode)) {
    return c.json({ success: false, message: 'সঠিক ফুলফিলমেন্ট মোড দিন (manual/api/hybrid/auto)।' }, 400)
  }
  if ((fulfillmentMode === 'api' || fulfillmentMode === 'hybrid') && !body.api_provider_id) {
    return c.json({ success: false, message: 'API/Hybrid মোডের জন্য একটি API Provider নির্বাচন করুন।' }, 400)
  }

  let formSchema: any[] = []
  try {
    formSchema = Array.isArray(body.form_schema) ? body.form_schema : JSON.parse(body.form_schema || '[]')
  } catch {
    return c.json({ success: false, message: 'form_schema সঠিক JSON ফরম্যাটে নয়।' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM services WHERE slug = ?').bind(slug).first()
  if (existing) return c.json({ success: false, message: 'এই স্লাগে ইতোমধ্যে একটি সার্ভিস আছে।' }, 409)

  const result = await c.env.DB.prepare(
    `INSERT INTO services
      (category_id, name_bn, name_en, slug, description_bn, description_en, icon, price, cost_price,
       fulfillment_mode, api_provider_id, field_mapping, form_schema, avg_delivery_minutes, requires_captcha,
       is_featured, sort_order, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.category_id || null,
      nameBn,
      nameEn,
      slug,
      body.description_bn || '',
      body.description_en || '',
      body.icon || 'fa-file-lines',
      price,
      body.cost_price || 0,
      fulfillmentMode,
      body.api_provider_id || null,
      body.field_mapping ? JSON.stringify(body.field_mapping) : null,
      JSON.stringify(formSchema),
      body.avg_delivery_minutes || 60,
      body.requires_captcha ? 1 : 0,
      body.is_featured ? 1 : 0,
      body.sort_order || 0,
      body.status || 'active'
    )
    .run()

  await logAdminAction(c.env.DB, admin.id, 'service_created', 'service', result.meta.last_row_id as number, nameBn)

  return c.json({ success: true, message: 'সার্ভিস তৈরি হয়েছে।', id: result.meta.last_row_id })
})

// PUT /api/admin/services/:id — update
adminServices.put('/:id', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const existing = await c.env.DB.prepare('SELECT * FROM services WHERE id = ?').bind(id).first<any>()
  if (!existing) return c.json({ success: false, message: 'সার্ভিস পাওয়া যায়নি।' }, 404)

  let formSchema = existing.form_schema
  if (body.form_schema !== undefined) {
    try {
      const parsed = Array.isArray(body.form_schema) ? body.form_schema : JSON.parse(body.form_schema)
      formSchema = JSON.stringify(parsed)
    } catch {
      return c.json({ success: false, message: 'form_schema সঠিক JSON ফরম্যাটে নয়।' }, 400)
    }
  }

  await c.env.DB.prepare(
    `UPDATE services SET
      category_id = ?, name_bn = ?, name_en = ?, description_bn = ?, description_en = ?, icon = ?,
      price = ?, cost_price = ?, fulfillment_mode = ?, api_provider_id = ?, field_mapping = ?,
      form_schema = ?, avg_delivery_minutes = ?, requires_captcha = ?, is_featured = ?, sort_order = ?,
      status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(
      body.category_id ?? existing.category_id,
      sanitizeText(body.name_bn, 150) || existing.name_bn,
      sanitizeText(body.name_en, 150) || existing.name_en,
      body.description_bn ?? existing.description_bn,
      body.description_en ?? existing.description_en,
      body.icon || existing.icon,
      body.price !== undefined ? parseFloat(body.price) : existing.price,
      body.cost_price !== undefined ? parseFloat(body.cost_price) : existing.cost_price,
      body.fulfillment_mode || existing.fulfillment_mode,
      body.api_provider_id ?? existing.api_provider_id,
      body.field_mapping ? JSON.stringify(body.field_mapping) : existing.field_mapping,
      formSchema,
      body.avg_delivery_minutes ?? existing.avg_delivery_minutes,
      body.requires_captcha !== undefined ? (body.requires_captcha ? 1 : 0) : existing.requires_captcha,
      body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : existing.is_featured,
      body.sort_order ?? existing.sort_order,
      body.status || existing.status,
      id
    )
    .run()

  await logAdminAction(c.env.DB, admin.id, 'service_updated', 'service', parseInt(id))

  return c.json({ success: true, message: 'সার্ভিস আপডেট হয়েছে।' })
})

// PATCH /api/admin/services/:id/rate — quick rate/price update by admin
adminServices.patch('/:id/rate', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const price = parseFloat(body.price)
  if (isNaN(price) || price < 0) {
    return c.json({ success: false, message: 'সঠিক মূল্য প্রদান করুন।' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id, name_bn, price FROM services WHERE id = ?').bind(id).first<any>()
  if (!existing) return c.json({ success: false, message: 'সার্ভিস পাওয়া যায়নি।' }, 404)

  const costPrice = body.cost_price !== undefined ? parseFloat(body.cost_price) : null

  if (costPrice !== null && !isNaN(costPrice) && costPrice >= 0) {
    await c.env.DB.prepare('UPDATE services SET price = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(price, costPrice, id)
      .run()
  } else {
    await c.env.DB.prepare('UPDATE services SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(price, id)
      .run()
  }

  await logAdminAction(c.env.DB, admin.id, 'service_rate_updated', 'service', parseInt(id), `রেট পরিবর্তন: ৳${existing.price} -> ৳${price}`)
  return c.json({ success: true, message: `"${existing.name_bn}" এর নতুন রেট ৳${price} সফলভাবে সেভ করা হয়েছে।` })
})

// DELETE /api/admin/services/:id
adminServices.delete('/:id', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')

  const orderCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM orders WHERE service_id = ?').bind(id).first<any>()
  if (orderCount && orderCount.cnt > 0) {
    // Don't hard-delete a service with order history — deactivate instead to preserve referential integrity
    await c.env.DB.prepare(`UPDATE services SET status = 'inactive' WHERE id = ?`).bind(id).run()
    await logAdminAction(c.env.DB, admin.id, 'service_deactivated', 'service', parseInt(id))
    return c.json({ success: true, message: 'এই সার্ভিসে অর্ডার হিস্ট্রি থাকায় মুছে না ফেলে নিষ্ক্রিয় করা হয়েছে।' })
  }

  await c.env.DB.prepare('DELETE FROM services WHERE id = ?').bind(id).run()
  await logAdminAction(c.env.DB, admin.id, 'service_deleted', 'service', parseInt(id))
  return c.json({ success: true, message: 'সার্ভিস মুছে ফেলা হয়েছে।' })
})

export default adminServices
