// ============================================================
// AdminCouponService — coupon CRUD (fixed/percentage, limits,
// expiry) with duplicate-code protection.
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'
import { badRequest, conflict } from '../errors'

export const AdminCouponService = {
  async listCoupons(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()
    return { coupons: results }
  },

  async createCoupon(env: Bindings, adminId: number, body: any) {
    const db = env.DB

    const code = sanitizeText(body.code, 30).toUpperCase()
    const type = sanitizeText(body.type, 20) || 'fixed'
    const value = parseFloat(body.value)

    if (!code || isNaN(value) || value <= 0) throw badRequest('কুপন কোড ও মূল্য সঠিকভাবে দিন।')
    if (!['fixed', 'percentage'].includes(type)) throw badRequest('সঠিক টাইপ দিন (fixed/percentage)।')

    const existing = await db.prepare('SELECT id FROM coupons WHERE code = ?').bind(code).first()
    if (existing) throw conflict('এই কোড ইতোমধ্যে ব্যবহৃত হয়েছে।')

    const result = await db
      .prepare(
        `INSERT INTO coupons (code, type, value, min_recharge, max_discount, usage_limit, per_user_limit, applicable_to, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .bind(
        code,
        type,
        value,
        body.min_recharge || 0,
        body.max_discount || null,
        body.usage_limit || 0,
        body.per_user_limit || 1,
        body.applicable_to || 'recharge',
        body.expires_at || null
      )
      .run()

    await logAdminAction(db, adminId, 'coupon_created', 'coupon', result.meta.last_row_id as number, code)

    return { message: 'কুপন তৈরি হয়েছে।', id: result.meta.last_row_id }
  },

  async updateCoupon(env: Bindings, couponId: string, body: any) {
    const status = sanitizeText(body.status, 20)
    if (status && ['active', 'inactive'].includes(status)) {
      await env.DB.prepare('UPDATE coupons SET status = ? WHERE id = ?').bind(status, couponId).run()
    }
    return { message: 'কুপন আপডেট হয়েছে।' }
  },

  async deleteCoupon(env: Bindings, couponId: string) {
    await env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(couponId).run()
    return { message: 'কুপন মুছে ফেলা হয়েছে।' }
  },
}
