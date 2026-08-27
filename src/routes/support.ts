import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { generateTicketNo } from '../utils/crypto'
import { sanitizeText } from '../utils/validate'

const support = new Hono<AppEnv>()

// GET /api/support/tickets — my tickets
support.get('/tickets', authRequired, async (c) => {
  const user = c.get('user')!
  const { results } = await c.env.DB.prepare(
    `SELECT id, ticket_no, subject, category, priority, status, created_at, updated_at
     FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC`
  )
    .bind(user.id)
    .all()
  return c.json({ success: true, tickets: results })
})

// POST /api/support/tickets — create ticket + first message
support.post('/tickets', authRequired, async (c) => {
  const user = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const subject = sanitizeText(body.subject, 150)
  const message = sanitizeText(body.message, 2000)
  const category = sanitizeText(body.category, 30) || 'general'
  const orderId = body.order_id ? parseInt(body.order_id, 10) : null

  if (!subject || !message) {
    return c.json({ success: false, message: 'বিষয় ও বার্তা লিখুন।' }, 400)
  }

  const ticketNo = generateTicketNo()
  const result = await c.env.DB.prepare(
    `INSERT INTO support_tickets (ticket_no, user_id, subject, category, order_id, status)
     VALUES (?, ?, ?, ?, ?, 'open')`
  )
    .bind(ticketNo, user.id, subject, category, orderId)
    .run()

  const ticketId = result.meta.last_row_id as number
  await c.env.DB.prepare(
    `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES (?, 'user', ?, ?)`
  )
    .bind(ticketId, user.id, message)
    .run()

  return c.json({ success: true, message: 'টিকেট সফলভাবে তৈরি হয়েছে।', ticket_id: ticketId, ticket_no: ticketNo })
})

// GET /api/support/tickets/:id — ticket with messages
support.get('/tickets/:id', authRequired, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')

  const ticket = await c.env.DB.prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<any>()
  if (!ticket) return c.json({ success: false, message: 'টিকেট পাওয়া যায়নি।' }, 404)

  const { results: messages } = await c.env.DB.prepare(
    'SELECT sender_type, message, attachment_key, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC'
  )
    .bind(id)
    .all()

  return c.json({ success: true, ticket, messages })
})

// POST /api/support/tickets/:id/reply — user reply
support.post('/tickets/:id/reply', authRequired, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const message = sanitizeText(body.message, 2000)

  if (!message) return c.json({ success: false, message: 'বার্তা লিখুন।' }, 400)

  const ticket = await c.env.DB.prepare('SELECT id, status FROM support_tickets WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<any>()
  if (!ticket) return c.json({ success: false, message: 'টিকেট পাওয়া যায়নি।' }, 404)
  if (ticket.status === 'closed') {
    return c.json({ success: false, message: 'এই টিকেটটি বন্ধ করা হয়েছে।' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES (?, 'user', ?, ?)`
  )
    .bind(id, user.id, message)
    .run()

  await c.env.DB.prepare(`UPDATE support_tickets SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run()

  return c.json({ success: true, message: 'বার্তা পাঠানো হয়েছে।' })
})

export default support
