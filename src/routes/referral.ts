// ============================================================
// Referral route — thin adapter over ReferralService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { ReferralService } from '../services'

const referral = new Hono<AppEnv>()

referral.get('/', authRequired, async (c) => {
  const result = await ReferralService.getSummary(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

export default referral
