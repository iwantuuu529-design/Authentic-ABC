// ============================================================
// Notification routes — thin adapters over NotificationService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { NotificationService } from '../services'

const notifications = new Hono<AppEnv>()

notifications.get('/', authRequired, async (c) => {
  const result = await NotificationService.list(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

notifications.post('/:id/read', authRequired, async (c) => {
  await NotificationService.markRead(c.env, c.get('user')!.id, c.req.param('id'))
  return c.json({ success: true })
})

notifications.post('/read-all', authRequired, async (c) => {
  await NotificationService.markAllRead(c.env, c.get('user')!.id)
  return c.json({ success: true })
})

export default notifications
