// ============================================================
// User dashboard route — thin adapter over DashboardService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { DashboardService } from '../services'

const dashboard = new Hono<AppEnv>()

// GET /api/dashboard/summary — bento grid cards, used percentage, recent activity
dashboard.get('/summary', authRequired, async (c) => {
  const result = await DashboardService.getSummary(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

export default dashboard
