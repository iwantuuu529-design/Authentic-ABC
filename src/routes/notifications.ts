import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'

const notifications = new Hono<AppEnv>()

notifications.get('/', authRequired, async (c) => {
  const user = c.get('user')!
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`
  )
    .bind(user.id)
    .all()

  const unread = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0')
    .bind(user.id)
    .first<any>()

  return c.json({ success: true, notifications: results, unread_count: unread?.cnt || 0 })
})

notifications.post('/:id/read', authRequired, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(id, user.id).run()
  return c.json({ success: true })
})

notifications.post('/read-all', authRequired, async (c) => {
  const user = c.get('user')!
  await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').bind(user.id).run()
  return c.json({ success: true })
})

export default notifications
