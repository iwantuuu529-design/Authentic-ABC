import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authOptional } from '../middleware/auth'

const services = new Hono<AppEnv>()

// GET /api/services  — list all active services with categories
services.get('/', authOptional, async (c) => {
  const categorySlug = c.req.query('category')
  const search = c.req.query('q')

  let query = `
    SELECT s.id, s.name_bn, s.name_en, s.slug, s.description_bn, s.icon, s.price,
           s.avg_delivery_minutes, s.requires_captcha, s.is_featured, s.fulfillment_mode,
           s.total_orders, s.success_orders, c.slug as category_slug, c.name_bn as category_name_bn
    FROM services s
    LEFT JOIN service_categories c ON c.id = s.category_id
    WHERE s.status = 'active'
  `
  const params: any[] = []
  if (categorySlug) {
    query += ' AND c.slug = ?'
    params.push(categorySlug)
  }
  if (search) {
    query += ' AND (s.name_bn LIKE ? OR s.name_en LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  query += ' ORDER BY s.is_featured DESC, s.sort_order ASC'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()

  const categories = await c.env.DB.prepare(
    `SELECT id, name_bn, name_en, slug, icon FROM service_categories WHERE status = 'active' ORDER BY sort_order ASC`
  ).all()

  return c.json({ success: true, services: results, categories: categories.results })
})

// GET /api/services/:slug — service detail incl. form_schema for dynamic form rendering
services.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const service = await c.env.DB.prepare(
    `SELECT s.id, s.name_bn, s.name_en, s.slug, s.description_bn, s.icon, s.price,
            s.form_schema, s.avg_delivery_minutes, s.requires_captcha, s.fulfillment_mode,
            s.total_orders, s.success_orders, c.name_bn as category_name_bn
     FROM services s
     LEFT JOIN service_categories c ON c.id = s.category_id
     WHERE s.slug = ? AND s.status = 'active'`
  )
    .bind(slug)
    .first<any>()

  if (!service) {
    return c.json({ success: false, message: 'সার্ভিসটি খুঁজে পাওয়া যায়নি।' }, 404)
  }

  let formSchema = []
  try {
    formSchema = JSON.parse(service.form_schema)
  } catch {
    formSchema = []
  }

  return c.json({ success: true, service: { ...service, form_schema: formSchema } })
})

export default services
