import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'

const reports = new Hono<AppEnv>()

// GET /api/reports/overview
reports.get('/overview', authRequired, async (c) => {
  const user = c.get('user')!

  const { results: dailySpending } = await c.env.DB.prepare(
    `SELECT DATE(created_at) as day, SUM(-amount) as total
     FROM transactions WHERE user_id = ? AND type = 'order_payment' AND created_at >= DATE('now', '-14 days')
     GROUP BY DATE(created_at) ORDER BY day ASC`
  )
    .bind(user.id)
    .all()

  const { results: serviceDistribution } = await c.env.DB.prepare(
    `SELECT s.name_bn as service_name, COUNT(*) as count, SUM(o.price) as total_spent
     FROM orders o JOIN services s ON s.id = o.service_id
     WHERE o.user_id = ? GROUP BY o.service_id ORDER BY count DESC LIMIT 8`
  )
    .bind(user.id)
    .all()

  const { results: statusBreakdown } = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM orders WHERE user_id = ? GROUP BY status`
  )
    .bind(user.id)
    .all()

  return c.json({ success: true, daily_spending: dailySpending, service_distribution: serviceDistribution, status_breakdown: statusBreakdown })
})

export default reports
