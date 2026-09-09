// ============================================================
// DashboardService — aggregated "home" data for the logged-in
// user: balance, lifetime totals, order stats, recent activity.
// ============================================================

import type { Bindings } from '../types/bindings'

export const DashboardService = {
  async getSummary(env: Bindings, userId: number) {
    const db = env.DB

    const balanceRow = await db.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first<any>()

    const totalRecharge = await db
      .prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND amount > 0`)
      .bind(userId)
      .first<any>()

    const totalSpent = await db
      .prepare(`SELECT COALESCE(SUM(-amount),0) as total FROM transactions WHERE user_id = ? AND type = 'order_payment'`)
      .bind(userId)
      .first<any>()

    const orderCounts = await db
      .prepare(
        `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'rejected' OR status = 'refunded' THEN 1 ELSE 0 END) as failed
       FROM orders WHERE user_id = ?`
      )
      .bind(userId)
      .first<any>()

    const { results: recentOrders } = await db
      .prepare(
        `SELECT o.id, o.order_no, o.price, o.status, o.created_at, s.name_bn as service_name, s.icon as service_icon
       FROM orders o JOIN services s ON s.id = o.service_id
       WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 5`
      )
      .bind(userId)
      .all()

    const { results: recentTx } = await db
      .prepare(`SELECT type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`)
      .bind(userId)
      .all()

    const recharge = totalRecharge?.total || 0
    const spent = totalSpent?.total || 0
    const usagePercent = recharge > 0 ? Math.min(100, Math.round((spent / recharge) * 100)) : 0

    return {
      balance: balanceRow?.balance || 0,
      total_recharge: recharge,
      total_spent: spent,
      usage_percent: usagePercent,
      order_stats: orderCounts,
      recent_orders: recentOrders,
      recent_transactions: recentTx,
    }
  },
}
