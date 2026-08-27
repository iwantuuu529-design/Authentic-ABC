import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { generateCaptcha } from '../lib/captcha'
import { getJwtSecret } from '../lib/jwt'

const misc = new Hono<AppEnv>()

misc.get('/captcha', async (c) => {
  const captcha = await generateCaptcha(getJwtSecret(c.env))
  return c.json({ success: true, ...captcha })
})

misc.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const settings: Record<string, string> = {}
  for (const row of results as any[]) settings[row.key] = row.value
  return c.json({ success: true, settings })
})

export default misc
