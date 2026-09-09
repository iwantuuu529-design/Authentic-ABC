// ============================================================
// Reports route — thin adapter over ReportService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { ReportService } from '../services'

const reports = new Hono<AppEnv>()

// GET /api/reports/overview
reports.get('/overview', authRequired, async (c) => {
  const result = await ReportService.getOverview(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

export default reports
