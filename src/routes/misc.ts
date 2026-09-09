// ============================================================
// Misc public routes (captcha + site settings) — thin adapters
// over MiscService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { MiscService } from '../services'

const misc = new Hono<AppEnv>()

misc.get('/captcha', async (c) => {
  const captcha = await MiscService.getCaptcha(c.env)
  return c.json({ success: true, ...captcha })
})

misc.get('/settings', async (c) => {
  const result = await MiscService.getPublicSettings(c.env)
  return c.json({ success: true, ...result })
})

export default misc
