// ============================================================
// Admin router — mounts every admin sub-module behind the
// adminRequired middleware; the overview endpoint is a thin
// adapter over AdminDashboardService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { adminRequired } from '../../middleware/auth'
import { AdminDashboardService } from '../../services'
import adminUsers from './users'
import adminServices from './services'
import adminOrders from './orders'
import adminRecharge from './recharge'
import adminCoupons from './coupons'
import adminProviders from './providers'
import adminSupport from './support'
import adminSettings from './settings'
import adminStorage from './storage'

const admin = new Hono<AppEnv>()

admin.use('*', adminRequired)

// GET /api/admin/dashboard — global stats
admin.get('/dashboard', async (c) => {
  const result = await AdminDashboardService.getStats(c.env)
  return c.json({ success: true, ...result })
})

admin.route('/users', adminUsers)
admin.route('/services', adminServices)
admin.route('/orders', adminOrders)
admin.route('/recharge-requests', adminRecharge)
admin.route('/coupons', adminCoupons)
admin.route('/api-providers', adminProviders)
admin.route('/support', adminSupport)
admin.route('/settings', adminSettings)
admin.route('/storage', adminStorage)

export default admin
