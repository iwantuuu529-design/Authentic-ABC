// ============================================================
// SupportService — user-side support tickets (list/create/view/
// reply) AND the admin-side ticket console. One module owns the
// whole ticket lifecycle so the rules stay consistent on both
// sides of the conversation.
// ============================================================

import type { Bindings } from '../types/bindings'
import { generateTicketNo } from '../utils/crypto'
import { sanitizeText } from '../utils/validate'
import { pushNotification } from '../lib/notify'
import { badRequest, notFound } from './errors'

export const SupportService = {
  // ------------------------- USER SIDE -------------------------

  async listMyTickets(env: Bindings, userId: number) {
    const { results } = await env.DB.prepare(
      `SELECT id, ticket_no, subject, category, priority, status, created_at, updated_at
       FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC`
    )
      .bind(userId)
      .all()
    return { tickets: results }
  },

  async createTicket(env: Bindings, userId: number, input: { subject?: unknown; message?: unknown; category?: unknown; order_id?: unknown }) {
    const db = env.DB
    const subject = sanitizeText(input.subject, 150)
    const message = sanitizeText(input.message, 2000)
    const category = sanitizeText(input.category, 30) || 'general'
    const orderId = input.order_id ? parseInt(String(input.order_id), 10) : null

    if (!subject || !message) throw badRequest('বিষয় ও বার্তা লিখুন।')

    const ticketNo = generateTicketNo()
    const result = await db
      .prepare(
        `INSERT INTO support_tickets (ticket_no, user_id, subject, category, order_id, status)
         VALUES (?, ?, ?, ?, ?, 'open')`
      )
      .bind(ticketNo, userId, subject, category, orderId)
      .run()

    const ticketId = result.meta.last_row_id as number
    await db
      .prepare(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES (?, 'user', ?, ?)`)
      .bind(ticketId, userId, message)
      .run()

    return { message: 'টিকেট সফলভাবে তৈরি হয়েছে।', ticket_id: ticketId, ticket_no: ticketNo }
  },

  async getMyTicket(env: Bindings, userId: number, ticketId: string) {
    const db = env.DB

    const ticket = await db.prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?')
      .bind(ticketId, userId)
      .first<any>()
    if (!ticket) throw notFound('টিকেট পাওয়া যায়নি।')

    const { results: messages } = await db
      .prepare('SELECT sender_type, message, attachment_key, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC')
      .bind(ticketId)
      .all()

    return { ticket, messages }
  },

  async replyToMyTicket(env: Bindings, userId: number, ticketId: string, rawMessage: unknown) {
    const db = env.DB
    const message = sanitizeText(rawMessage, 2000)
    if (!message) throw badRequest('বার্তা লিখুন।')

    const ticket = await db.prepare('SELECT id, status FROM support_tickets WHERE id = ? AND user_id = ?')
      .bind(ticketId, userId)
      .first<any>()
    if (!ticket) throw notFound('টিকেট পাওয়া যায়নি।')
    if (ticket.status === 'closed') throw badRequest('এই টিকেটটি বন্ধ করা হয়েছে।')

    await db
      .prepare(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES (?, 'user', ?, ?)`)
      .bind(ticketId, userId, message)
      .run()

    await db.prepare(`UPDATE support_tickets SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(ticketId)
      .run()

    return { message: 'বার্তা পাঠানো হয়েছে।' }
  },

  // ------------------------- ADMIN SIDE -------------------------

  async listAllTickets(env: Bindings, status?: string) {
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

    const { results } = await env.DB.prepare(query).bind(...params).all()
    return { tickets: results }
  },

  async getTicketForAdmin(env: Bindings, ticketId: string) {
    const db = env.DB

    const ticket = await db
      .prepare(`SELECT t.*, u.name as user_name, u.phone as user_phone FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = ?`)
      .bind(ticketId)
      .first()
    if (!ticket) throw notFound('টিকেট পাওয়া যায়নি।')

    const { results: messages } = await db
      .prepare('SELECT sender_type, message, attachment_key, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC')
      .bind(ticketId)
      .all()

    return { ticket, messages }
  },

  async adminReply(env: Bindings, adminId: number, ticketId: string, rawMessage: unknown) {
    const db = env.DB
    const message = sanitizeText(rawMessage, 2000)
    if (!message) throw badRequest('বার্তা লিখুন।')

    const ticket = await db.prepare('SELECT user_id FROM support_tickets WHERE id = ?').bind(ticketId).first<any>()
    if (!ticket) throw notFound('টিকেট পাওয়া যায়নি।')

    await db
      .prepare(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES (?, 'admin', ?, ?)`)
      .bind(ticketId, adminId, message)
      .run()

    await db.prepare(`UPDATE support_tickets SET status = 'answered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(ticketId)
      .run()

    await pushNotification(db, ticket.user_id, 'সাপোর্ট রিপ্লাই এসেছে 💬', 'আপনার টিকেটে এডমিন রিপ্লাই দিয়েছেন।', 'info', '/dashboard/support')

    return { message: 'রিপ্লাই পাঠানো হয়েছে।' }
  },

  async setTicketStatus(env: Bindings, ticketId: string, rawStatus: string) {
    const status = sanitizeText(rawStatus, 20)
    if (!['open', 'answered', 'closed'].includes(status)) throw badRequest('সঠিক স্ট্যাটাস দিন।')

    await env.DB.prepare('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(status, ticketId)
      .run()

    return { message: 'স্ট্যাটাস আপডেট হয়েছে।' }
  },
}
