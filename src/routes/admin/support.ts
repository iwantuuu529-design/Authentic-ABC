// ============================================================
// Admin support routes — thin adapters over SupportService
// (admin side of the ticket lifecycle).
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { SupportService } from '../../services'

const adminSupport = new Hono<AppEnv>()

adminSupport.get('/tickets', async (c) => {
  const result = await SupportService.listAllTickets(c.env, c.req.query('status'))
  return c.json({ success: true, ...result })
})

adminSupport.get('/tickets/:id', async (c) => {
  const result = await SupportService.getTicketForAdmin(c.env, c.req.param('id'))
  return c.json({ success: true, ...result })
})

adminSupport.post('/tickets/:id/reply', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await SupportService.adminReply(c.env, admin.id, c.req.param('id'), body.message)
  return c.json({ success: true, message: result.message })
})

adminSupport.put('/tickets/:id/status', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await SupportService.setTicketStatus(c.env, c.req.param('id'), String(body.status || ''))
  return c.json({ success: true, message: result.message })
})

export default adminSupport
