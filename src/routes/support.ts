// ============================================================
// Support routes (user side) — thin adapters over SupportService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { SupportService } from '../services'

const support = new Hono<AppEnv>()

// GET /api/support/tickets — my tickets
support.get('/tickets', authRequired, async (c) => {
  const result = await SupportService.listMyTickets(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

// POST /api/support/tickets — create ticket + first message
support.post('/tickets', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await SupportService.createTicket(c.env, c.get('user')!.id, body)
  return c.json({ success: true, ...result })
})

// GET /api/support/tickets/:id — ticket with messages
support.get('/tickets/:id', authRequired, async (c) => {
  const result = await SupportService.getMyTicket(c.env, c.get('user')!.id, c.req.param('id'))
  return c.json({ success: true, ...result })
})

// POST /api/support/tickets/:id/reply — user reply
support.post('/tickets/:id/reply', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await SupportService.replyToMyTicket(c.env, c.get('user')!.id, c.req.param('id'), body.message)
  return c.json({ success: true, ...result })
})

export default support
