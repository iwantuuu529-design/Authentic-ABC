// ============================================================
// Admin coupon routes — thin adapters over AdminCouponService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminCouponService } from '../../services'

const adminCoupons = new Hono<AppEnv>()

adminCoupons.get('/', async (c) => {
  const result = await AdminCouponService.listCoupons(c.env)
  return c.json({ success: true, ...result })
})

adminCoupons.post('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminCouponService.createCoupon(c.env, admin.id, body)
  return c.json({ success: true, message: result.message, id: result.id })
})

adminCoupons.put('/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminCouponService.updateCoupon(c.env, c.req.param('id'), body)
  return c.json({ success: true, message: result.message })
})

adminCoupons.delete('/:id', async (c) => {
  const result = await AdminCouponService.deleteCoupon(c.env, c.req.param('id'))
  return c.json({ success: true, message: result.message })
})

export default adminCoupons
