import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { adminRequired } from '../../middleware/auth'
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
  const totalUsers = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM users WHERE role = 'user'`).first<any>()
  const activeUsers = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM users WHERE role = 'user' AND status = 'active'`
  ).first<any>()

  const revenue = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(-amount),0) as total FROM transactions WHERE type = 'order_payment'`
  ).first<any>()

  const todayRevenue = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(-amount),0) as total FROM transactions WHERE type = 'order_payment' AND DATE(created_at) = DATE('now')`
  ).first<any>()

  const pendingOrders = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM orders WHERE status IN ('pending','processing')`
  ).first<any>()

  const pendingRecharge = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(amount),0) as total FROM recharge_requests WHERE status = 'pending'`
  ).first<any>()

  const totalWalletBalance = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(balance),0) as total FROM users WHERE role = 'user'`
  ).first<any>()

  const openTickets = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM support_tickets WHERE status != 'closed'`).first<any>()

  const { results: dailyRevenue } = await c.env.DB.prepare(
    `SELECT DATE(created_at) as day, SUM(-amount) as total FROM transactions
     WHERE type = 'order_payment' AND created_at >= DATE('now','-14 days')
     GROUP BY DATE(created_at) ORDER BY day ASC`
  ).all()

  const { results: topServices } = await c.env.DB.prepare(
    `SELECT s.name_bn, s.total_orders, s.success_orders,
            (SELECT COALESCE(SUM(o2.price),0) FROM orders o2 WHERE o2.service_id = s.id) as revenue
     FROM services s ORDER BY s.total_orders DESC LIMIT 6`
  ).all()

  const { results: recentOrders } = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.price, o.status, o.created_at, u.name as user_name, s.name_bn as service_name
     FROM orders o JOIN users u ON u.id = o.user_id JOIN services s ON s.id = o.service_id
     ORDER BY o.created_at DESC LIMIT 8`
  ).all()

  return c.json({
    success: true,
    stats: {
      total_users: totalUsers?.cnt || 0,
      active_users: activeUsers?.cnt || 0,
      total_revenue: revenue?.total || 0,
      today_revenue: todayRevenue?.total || 0,
      pending_orders: pendingOrders?.cnt || 0,
      pending_recharge_count: pendingRecharge?.cnt || 0,
      pending_recharge_amount: pendingRecharge?.total || 0,
      total_wallet_liability: totalWalletBalance?.total || 0,
      open_tickets: openTickets?.cnt || 0,
    },
    daily_revenue: dailyRevenue,
    top_services: topServices,
    recent_orders: recentOrders,
  })
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
