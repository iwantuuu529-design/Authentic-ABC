import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { pushNotification } from '../../lib/notify'

const adminSupport = new Hono<AppEnv>()

adminSupport.get('/tickets', async (c) => {
  const status = c.req.query('status')
  let query = `
    SELECT t.id, t.ticket_no, t.subject, t.category, t.priority, t.status, t.created_at, t.updated_at,
           u.name as user_name, u.phone as user_phone
    FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE 1=1
  `
  const params: any[] = []
  if (status) {
    query += ' AND t.status = ?'
    params.push(status)
  }
  query += ' ORDER BY t.updated_at DESC'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ success: true, tickets: results })
})

adminSupport.get('/tickets/:id', async (c) => {
  const id = c.req.param('id')
  const ticket = await c.env.DB.prepare(
    `SELECT t.*, u.name as user_name, u.phone as user_phone FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = ?`
  )
    .bind(id)
    .first()
  if (!ticket) return c.json({ success: false, message: 'টিকেট পাওয়া যায়নি।' }, 404)

  const { results: messages } = await c.env.DB.prepare(
    'SELECT sender_type, message, attachment_key, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC'
  )
    .bind(id)
    .all()

  return c.json({ success: true, ticket, messages })
})

adminSupport.post('/tickets/:id/reply', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const message = sanitizeText(body.message, 2000)

  if (!message) return c.json({ success: false, message: 'বার্তা লিখুন।' }, 400)

  const ticket = await c.env.DB.prepare('SELECT user_id FROM support_tickets WHERE id = ?').bind(id).first<any>()
  if (!ticket) return c.json({ success: false, message: 'টিকেট পাওয়া যায়নি।' }, 404)

  await c.env.DB.prepare(
    `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES (?, 'admin', ?, ?)`
  )
    .bind(id, admin.id, message)
    .run()

  await c.env.DB.prepare(`UPDATE support_tickets SET status = 'answered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run()

  await pushNotification(c.env.DB, ticket.user_id, 'সাপোর্ট রিপ্লাই এসেছে 💬', 'আপনার টিকেটে এডমিন রিপ্লাই দিয়েছেন।', 'info', '/dashboard/support')

  return c.json({ success: true, message: 'রিপ্লাই পাঠানো হয়েছে।' })
})

adminSupport.put('/tickets/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const status = sanitizeText(body.status, 20)

  if (!['open', 'answered', 'closed'].includes(status)) {
    return c.json({ success: false, message: 'সঠিক স্ট্যাটাস দিন।' }, 400)
  }

  await c.env.DB.prepare('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id)
    .run()

  return c.json({ success: true, message: 'স্ট্যাটাস আপডেট হয়েছে।' })
})

export default adminSupport
