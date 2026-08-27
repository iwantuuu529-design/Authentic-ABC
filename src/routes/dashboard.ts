import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'

const dashboard = new Hono<AppEnv>()

// GET /api/dashboard/summary — bento grid cards, used percentage, recent activity
dashboard.get('/summary', authRequired, async (c) => {
  const user = c.get('user')!

  const balanceRow = await c.env.DB.prepare('SELECT balance FROM users WHERE id = ?').bind(user.id).first<any>()

  const totalRecharge = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND amount > 0`
  )
    .bind(user.id)
    .first<any>()

  const totalSpent = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(-amount),0) as total FROM transactions WHERE user_id = ? AND type = 'order_payment'`
  )
    .bind(user.id)
    .first<any>()

  const orderCounts = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'rejected' OR status = 'refunded' THEN 1 ELSE 0 END) as failed
     FROM orders WHERE user_id = ?`
  )
    .bind(user.id)
    .first<any>()

  const { results: recentOrders } = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.price, o.status, o.created_at, s.name_bn as service_name, s.icon as service_icon
     FROM orders o JOIN services s ON s.id = o.service_id
     WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 5`
  )
    .bind(user.id)
    .all()

  const { results: recentTx } = await c.env.DB.prepare(
    `SELECT type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`
  )
    .bind(user.id)
    .all()

  const recharge = totalRecharge?.total || 0
  const spent = totalSpent?.total || 0
  const usagePercent = recharge > 0 ? Math.min(100, Math.round((spent / recharge) * 100)) : 0

  return c.json({
    success: true,
    balance: balanceRow?.balance || 0,
    total_recharge: recharge,
    total_spent: spent,
    usage_percent: usagePercent,
    order_stats: orderCounts,
    recent_orders: recentOrders,
    recent_transactions: recentTx,
  })
})

export default dashboard
