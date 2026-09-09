// ============================================================
// AdminCatalogService — service & category management: CRUD with
// dynamic form schemas, fulfillment modes, quick rate updates and
// safe deletes (deactivate when order history exists).
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'
import { badRequest, notFound, conflict } from '../errors'

const FULFILLMENT_MODES = ['manual', 'api', 'hybrid', 'auto']

export const AdminCatalogService = {
  // ------------------------- CATEGORIES -------------------------

  async listCategories(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT * FROM service_categories ORDER BY sort_order ASC').all()
    return { categories: results }
  },

  async createCategory(env: Bindings, input: { name_bn?: unknown; name_en?: unknown; slug?: unknown; icon?: unknown }) {
    const nameBn = sanitizeText(input.name_bn, 100)
    const nameEn = sanitizeText(input.name_en, 100)
    const slug = sanitizeText(input.slug, 50).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const icon = sanitizeText(input.icon, 50) || 'fa-layer-group'

    if (!nameBn || !nameEn || !slug) throw badRequest('ক্যাটাগরির নাম ও স্লাগ আবশ্যক।')

    const result = await env.DB.prepare('INSERT INTO service_categories (name_bn, name_en, slug, icon) VALUES (?, ?, ?, ?)')
      .bind(nameBn, nameEn, slug, icon)
      .run()

    return { message: 'ক্যাটাগরি তৈরি হয়েছে।', id: result.meta.last_row_id }
  },

  // ------------------------- SERVICES -------------------------

  async listServices(env: Bindings) {
    const { results } = await env.DB.prepare(
      `SELECT s.*, c.name_bn as category_name_bn, ap.name as api_provider_name
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       LEFT JOIN api_providers ap ON ap.id = s.api_provider_id
       ORDER BY s.sort_order ASC`
    ).all()
    return { services: results }
  },

  async createService(env: Bindings, adminId: number, body: any) {
    const db = env.DB

    const nameBn = sanitizeText(body.name_bn, 150)
    const nameEn = sanitizeText(body.name_en, 150)
    const slug = sanitizeText(body.slug, 80).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const price = parseFloat(body.price)
    const fulfillmentMode = sanitizeText(body.fulfillment_mode, 20) || 'manual'

    if (!nameBn || !nameEn || !slug || isNaN(price) || price < 0) {
      throw badRequest('সার্ভিসের নাম, স্লাগ ও মূল্য সঠিকভাবে দিন।')
    }
    if (!FULFILLMENT_MODES.includes(fulfillmentMode)) {
      throw badRequest('সঠিক ফুলফিলমেন্ট মোড দিন (manual/api/hybrid/auto)।')
    }
    if ((fulfillmentMode === 'api' || fulfillmentMode === 'hybrid') && !body.api_provider_id) {
      throw badRequest('API/Hybrid মোডের জন্য একটি API Provider নির্বাচন করুন।')
    }

    let formSchema: any[] = []
    try {
      formSchema = Array.isArray(body.form_schema) ? body.form_schema : JSON.parse(body.form_schema || '[]')
    } catch {
      throw badRequest('form_schema সঠিক JSON ফরম্যাটে নয়।')
    }

    const existing = await db.prepare('SELECT id FROM services WHERE slug = ?').bind(slug).first()
    if (existing) throw conflict('এই স্লাগে ইতোমধ্যে একটি সার্ভিস আছে।')

    const result = await db
      .prepare(
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

    await logAdminAction(db, adminId, 'service_created', 'service', result.meta.last_row_id as number, nameBn)

    return { message: 'সার্ভিস তৈরি হয়েছে।', id: result.meta.last_row_id }
  },

  async updateService(env: Bindings, adminId: number, serviceId: string, body: any) {
    const db = env.DB

    const existing = await db.prepare('SELECT * FROM services WHERE id = ?').bind(serviceId).first<any>()
    if (!existing) throw notFound('সার্ভিস পাওয়া যায়নি।')

    let formSchema = existing.form_schema
    if (body.form_schema !== undefined) {
      try {
        const parsed = Array.isArray(body.form_schema) ? body.form_schema : JSON.parse(body.form_schema)
        formSchema = JSON.stringify(parsed)
      } catch {
        throw badRequest('form_schema সঠিক JSON ফরম্যাটে নয়।')
      }
    }

    await db
      .prepare(
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
        serviceId
      )
      .run()

    await logAdminAction(db, adminId, 'service_updated', 'service', parseInt(serviceId))

    return { message: 'সার্ভিস আপডেট হয়েছে।' }
  },

  /** Quick price/cost update from the management table. */
  async updateRate(env: Bindings, adminId: number, serviceId: string, body: any) {
    const db = env.DB

    const price = parseFloat(body.price)
    if (isNaN(price) || price < 0) throw badRequest('সঠিক মূল্য প্রদান করুন।')

    const existing = await db.prepare('SELECT id, name_bn, price FROM services WHERE id = ?').bind(serviceId).first<any>()
    if (!existing) throw notFound('সার্ভিস পাওয়া যায়নি।')

    const costPrice = body.cost_price !== undefined ? parseFloat(body.cost_price) : null

    if (costPrice !== null && !isNaN(costPrice) && costPrice >= 0) {
      await db.prepare('UPDATE services SET price = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(price, costPrice, serviceId)
        .run()
    } else {
      await db.prepare('UPDATE services SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(price, serviceId).run()
    }

    await logAdminAction(db, adminId, 'service_rate_updated', 'service', parseInt(serviceId), `রেট পরিবর্তন: ৳${existing.price} -> ৳${price}`)
    return { message: `"${existing.name_bn}" এর নতুন রেট ৳${price} সফলভাবে সেভ করা হয়েছে।` }
  },

  /**
   * Hard-deletes a service only when no order history exists;
   * otherwise deactivates it to preserve referential integrity.
   */
  async deleteService(env: Bindings, adminId: number, serviceId: string) {
    const db = env.DB

    const orderCount = await db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE service_id = ?').bind(serviceId).first<any>()
    if (orderCount && orderCount.cnt > 0) {
      await db.prepare(`UPDATE services SET status = 'inactive' WHERE id = ?`).bind(serviceId).run()
      await logAdminAction(db, adminId, 'service_deactivated', 'service', parseInt(serviceId))
      return { message: 'এই সার্ভিসে অর্ডার হিস্ট্রি থাকায় মুছে না ফেলে নিষ্ক্রিয় করা হয়েছে।' }
    }

    await db.prepare('DELETE FROM services WHERE id = ?').bind(serviceId).run()
    await logAdminAction(db, adminId, 'service_deleted', 'service', parseInt(serviceId))
    return { message: 'সার্ভিস মুছে ফেলা হয়েছে।' }
  },
}
