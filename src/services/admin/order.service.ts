// ============================================================
// AdminOrderService — the admin order console: list/search,
// detail review, approve-with-result (file or text), reject with
// auto-refund, and internal notes.
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { creditWallet } from '../../lib/wallet'
import { logOrderEvent, pushNotification, logAdminAction } from '../../lib/notify'
import { badRequest, notFound } from '../errors'

export const AdminOrderService = {
  async listOrders(env: Bindings, opts: { status?: string; service_id?: string; q?: string; page?: number } = {}) {
    const page = Math.max(1, opts.page || 1)
    const limit = 20
    const offset = (page - 1) * limit

    let query = `
    SELECT o.id, o.order_no, o.price, o.status, o.fulfillment_mode, o.created_at,
           u.id as user_id, u.name as user_name, u.phone as user_phone,
           s.name_bn as service_name, s.icon as service_icon
    FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN services s ON s.id = o.service_id
    WHERE 1=1
  `
    const params: any[] = []
    if (opts.status) {
      query += ' AND o.status = ?'
      params.push(opts.status)
    }
    if (opts.service_id) {
      query += ' AND o.service_id = ?'
      params.push(opts.service_id)
    }
    if (opts.q) {
      query += ' AND (o.order_no LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)'
      params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`)
    }
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const { results } = await env.DB.prepare(query).bind(...params).all()
    const countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM orders').first<any>()

    return { orders: results, total: countRow?.total || 0, page, limit }
  },

  async getOrderDetail(env: Bindings, orderId: string) {
    const db = env.DB

    const order = await db
      .prepare(
        `SELECT o.*, u.name as user_name, u.phone as user_phone, u.email as user_email, s.name_bn as service_name, s.form_schema
         FROM orders o JOIN users u ON u.id = o.user_id JOIN services s ON s.id = o.service_id
         WHERE o.id = ?`
      )
      .bind(orderId)
      .first<any>()

    if (!order) throw notFound('অর্ডার পাওয়া যায়নি।')

    const { results: logs } = await db
      .prepare('SELECT actor_type, actor_id, action, note, created_at FROM order_logs WHERE order_id = ? ORDER BY created_at ASC')
      .bind(orderId)
      .all()

    let formData = {}
    let formSchema = []
    try {
      formData = JSON.parse(order.form_data)
    } catch {}
    try {
      formSchema = JSON.parse(order.form_schema)
    } catch {}

    return { order: { ...order, form_data: formData, form_schema: formSchema }, logs }
  },

  /** Streams a user-uploaded form file (e.g. NID scan) for admin review. */
  async getUploadedFile(env: Bindings, orderId: string, fieldName: string) {
    const order = await env.DB.prepare('SELECT form_data FROM orders WHERE id = ?').bind(orderId).first<any>()
    if (!order) throw notFound('অর্ডার পাওয়া যায়নি।')

    let formData: Record<string, any> = {}
    try {
      formData = JSON.parse(order.form_data)
    } catch {}

    const objectKey = formData[fieldName]
    if (!objectKey || typeof objectKey !== 'string' || !objectKey.startsWith(`orders/`)) {
      throw notFound('ফাইল পাওয়া যায়নি।')
    }

    const object = await env.FILES.get(objectKey)
    if (!object) throw notFound('ফাইল পাওয়া যায়নি।')

    return { object, filename: objectKey.split('/').pop() || 'file' }
  },

  /**
   * Marks the order completed with an optional result (text JSON or
   * uploaded file) and notifies the user.
   */
  async approveOrder(
    env: Bindings,
    adminId: number,
    orderId: string,
    result: { note: string; resultData: any; resultFile?: File | null }
  ) {
    const db = env.DB

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<any>()
    if (!order) throw notFound('অর্ডার পাওয়া যায়নি।')
    if (order.status === 'completed') throw badRequest('এই অর্ডারটি ইতোমধ্যে সম্পন্ন হয়েছে।')

    let resultFileKey: string | null = null
    if (result.resultFile instanceof File && result.resultFile.size > 0) {
      const key = `results/${order.user_id}/${Date.now()}-${result.resultFile.name}`.replace(/\s+/g, '_')
      await env.FILES.put(key, await result.resultFile.arrayBuffer(), {
        httpMetadata: { contentType: result.resultFile.type || 'application/octet-stream' },
      })
      resultFileKey = key
    }

    await db
      .prepare(
        `UPDATE orders SET status = 'completed', result_data = ?, result_file_key = COALESCE(?, result_file_key),
         admin_note = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(typeof result.resultData === 'string' ? result.resultData : JSON.stringify(result.resultData || {}), resultFileKey, result.note, adminId, orderId)
      .run()

    await db.prepare('UPDATE services SET success_orders = success_orders + 1 WHERE id = ?').bind(order.service_id).run()

    await logOrderEvent(db, parseInt(orderId), 'admin', adminId, 'approved', result.note || 'এডমিন কর্তৃক সম্পন্ন করা হয়েছে')
    await pushNotification(
      db,
      order.user_id,
      'অর্ডার সম্পন্ন হয়েছে ✅',
      `আপনার অর্ডার (${order.order_no}) সম্পন্ন করা হয়েছে। বিস্তারিত দেখতে ক্লিক করুন।`,
      'success',
      `/dashboard/orders/${orderId}`
    )

    return { message: 'অর্ডার সম্পন্ন করা হয়েছে এবং ইউজারকে জানানো হয়েছে।' }
  },

  /** Rejects the order and auto-refunds any amount charged. */
  async rejectOrder(env: Bindings, adminId: number, orderId: string, rawReason: unknown) {
    const db = env.DB
    const reason = sanitizeText(rawReason, 500) || 'তথ্য যাচাই করা যায়নি'

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<any>()
    if (!order) throw notFound('অর্ডার পাওয়া যায়নি।')
    if (['completed', 'rejected', 'refunded'].includes(order.status)) {
      throw badRequest('এই অর্ডারের স্ট্যাটাস পরিবর্তন করা সম্ভব নয়।')
    }

    // Auto-refund if price was charged
    if (order.price > 0) {
      await creditWallet(db, order.user_id, order.price, 'refund', 'order', order.id, `অর্ডার (${order.order_no}) বাতিল - অটো রিফান্ড`)
    }

    await db
      .prepare(
        `UPDATE orders SET status = 'rejected', admin_note = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(reason, adminId, orderId)
      .run()

    await logOrderEvent(db, parseInt(orderId), 'admin', adminId, 'rejected', reason)
    await logOrderEvent(db, parseInt(orderId), 'system', null, 'refunded', `৳${order.price} স্বয়ংক্রিয়ভাবে ফেরত দেওয়া হয়েছে`)

    await pushNotification(
      db,
      order.user_id,
      'অর্ডার বাতিল হয়েছে',
      `আপনার অর্ডার (${order.order_no}) বাতিল করা হয়েছে। কারণ: ${reason}। ${order.price > 0 ? `৳${order.price} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।` : ''}`,
      'warning',
      `/dashboard/orders/${orderId}`
    )

    return { message: 'অর্ডার বাতিল করা হয়েছে এবং টাকা ফেরত দেওয়া হয়েছে।' }
  },

  async setNote(env: Bindings, adminId: number, orderId: string, rawNote: unknown) {
    const db = env.DB
    const note = sanitizeText(rawNote, 500)

    await db.prepare('UPDATE orders SET admin_note = ? WHERE id = ?').bind(note, orderId).run()
    await logOrderEvent(db, parseInt(orderId), 'admin', adminId, 'note', note)

    return { message: 'নোট যোগ করা হয়েছে।' }
  },
}
