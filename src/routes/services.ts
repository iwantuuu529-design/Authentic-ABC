import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authOptional } from '../middleware/auth'

const services = new Hono<AppEnv>()

let servicesInitialized = false

async function ensureDefaultServices(db: any) {
  if (servicesInitialized || !db) return
  try {
    // 1. Ensure categories exist
    await db.prepare(`
      INSERT OR IGNORE INTO service_categories (id, name_bn, name_en, slug, icon, sort_order) VALUES
      (1, 'জন্ম নিবন্ধন', 'Birth Registration', 'birth', 'fa-baby', 1),
      (2, 'এনআইডি ও ভোটার সেবা', 'NID & Voter Services', 'nid', 'fa-id-card', 2),
      (3, 'ভূমি সেবা', 'Land Services', 'land', 'fa-map-location-dot', 3),
      (4, 'অন্যান্য সেবা', 'Other Services', 'others', 'fa-layer-group', 4)
    `).run()

    // 2. Check if nibandan-pdf-create exists
    const check = await db.prepare("SELECT id FROM services WHERE slug = 'nibandan-pdf-create'").first()
    if (!check) {
      await db.prepare(`
        INSERT INTO services
        (category_id, name_bn, name_en, slug, description_bn, icon, price, cost_price, fulfillment_mode, form_schema, avg_delivery_minutes, requires_captcha, is_featured, sort_order, status)
        VALUES
        (1, 'নিবন্ধন পিডিএফ তৈরি', 'NIBANDAN PDF CREATE', 'nibandan-pdf-create',
         'পিডিএফ আপলোড করে অটো-প্রসেসিংয়ের মাধ্যমে ইউনিক ফরম্যাটে জন্ম নিবন্ধন সনদ প্রস্তুত করুন।', 'fa-file-pdf', 4.00, 1.00, 'manual',
         '[{"name":"pdf_file","label_bn":"পিডিএফ আপলোড করুন","type":"file","accept":".pdf","required":true},{"name":"name_bn","label_bn":"নাম (বাংলা)","type":"text","required":true},{"name":"name_en","label_bn":"নাম (ইংরেজি)","type":"text","required":true},{"name":"registration_no","label_bn":"নিবন্ধন নম্বর","type":"text","required":true},{"name":"book_no","label_bn":"পিন / বুক নম্বর","type":"text","required":false},{"name":"father_name_bn","label_bn":"পিতার নাম","type":"text","required":true},{"name":"mother_name_bn","label_bn":"মাতার নাম","type":"text","required":true},{"name":"birth_place","label_bn":"জন্মস্থান","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"text","required":true},{"name":"gender_blood","label_bn":"লিঙ্গ / রক্তের গ্রুপ","type":"text","required":false},{"name":"issue_date","label_bn":"প্রদানের তারিখ","type":"text","required":false},{"name":"address","label_bn":"ঠিকানা","type":"textarea","required":true}]',
         5, 0, 1, 1, 'active')
      `).run()
    }
    servicesInitialized = true
  } catch (err) {
    console.error('ensureDefaultServices error:', err)
  }
}

// GET /api/services  — list all active services with categories
services.get('/', authOptional, async (c) => {
  await ensureDefaultServices(c.env.DB)

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
  await ensureDefaultServices(c.env.DB)
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
