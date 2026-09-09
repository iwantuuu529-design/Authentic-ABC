// ============================================================
// OrderService — the heart of the platform: order listing,
// detail, creation (with dynamic-schema validation, wallet debit,
// captcha) and the fulfillment engine (auto / api / hybrid /
// manual), plus secure file access.
// ============================================================

import type { Bindings } from '../types/bindings'
import { generateOrderNo } from '../utils/crypto'
import { debitWallet, creditWallet } from '../lib/wallet'
import { logOrderEvent, pushNotification } from '../lib/notify'
import { callApiProvider } from '../lib/apiProvider'
import { verifyCaptcha } from '../lib/captcha'
import { getJwtSecret } from '../lib/jwt'
import { ApiError, badRequest, notFound } from './errors'
import { AUTO_DOCUMENT_SLUGS, buildAutoResult } from './fulfillment.service'

export interface CreateOrderInput {
  serviceSlug: string
  captchaToken: string
  captchaAnswer: string
  formValues: Record<string, any>
  /** form field name -> R2 object key for uploaded file fields */
  fileKeys: Record<string, string>
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export const OrderService = {
  /** My orders, paginated + optional status filter. */
  async listMyOrders(env: Bindings, userId: number, opts: { status?: string; page?: number } = {}) {
    const page = Math.max(1, opts.page || 1)
    const limit = 15
    const offset = (page - 1) * limit

    let query = `
    SELECT o.id, o.order_no, o.price, o.status, o.fulfillment_mode, o.created_at, o.processed_at,
           s.name_bn as service_name, s.icon as service_icon, s.slug as service_slug
    FROM orders o JOIN services s ON s.id = o.service_id
    WHERE o.user_id = ?
  `
    const params: any[] = [userId]
    if (opts.status) {
      query += ' AND o.status = ?'
      params.push(opts.status)
    }
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const { results } = await env.DB.prepare(query).bind(...params).all()

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM orders WHERE user_id = ?${opts.status ? ' AND status = ?' : ''}`
    )
      .bind(...(opts.status ? [userId, opts.status] : [userId]))
      .first<{ total: number }>()

    return { orders: results, total: countRow?.total || 0, page, limit }
  },

  /** Order detail (owner-scoped) with timeline logs and parsed JSON blobs. */
  async getOrderDetail(env: Bindings, userId: number, orderId: string) {
    const order = await env.DB.prepare(
      `SELECT o.*, s.name_bn as service_name, s.icon as service_icon, s.form_schema
       FROM orders o JOIN services s ON s.id = o.service_id
       WHERE o.id = ? AND o.user_id = ?`
    )
      .bind(orderId, userId)
      .first<any>()

    if (!order) throw notFound('অর্ডার খুঁজে পাওয়া যায়নি।')

    const logs = await env.DB.prepare(
      `SELECT actor_type, action, note, created_at FROM order_logs WHERE order_id = ? ORDER BY created_at ASC`
    )
      .bind(orderId)
      .all()

    let formData = {}
    let resultData = null
    let formSchema = []
    try {
      formData = JSON.parse(order.form_data)
    } catch {}
    try {
      resultData = order.result_data ? JSON.parse(order.result_data) : null
    } catch {
      resultData = order.result_data
    }
    try {
      formSchema = JSON.parse(order.form_schema)
    } catch {}

    return { order: { ...order, form_data: formData, result_data: resultData, form_schema: formSchema }, logs: logs.results }
  },

  /**
   * Parses a multipart order submission: uploads every file field to R2
   * (owner-scoped key) and collects scalar fields. Throws on >8MB files.
   */
  async parseMultipartInput(env: Bindings, userId: number, fd: FormData): Promise<CreateOrderInput> {
    const input: CreateOrderInput = {
      serviceSlug: String(fd.get('service_slug') || ''),
      captchaToken: String(fd.get('captcha_token') || ''),
      captchaAnswer: String(fd.get('captcha_answer') || ''),
      formValues: {},
      fileKeys: {},
    }
    for (const [key, value] of fd.entries()) {
      if (key === 'service_slug' || key === 'captcha_token' || key === 'captcha_answer') continue
      if (value instanceof File) {
        if (value.size > MAX_UPLOAD_BYTES) {
          throw badRequest(`${key} ফাইলের সাইজ ৮MB এর বেশি হতে পারবে না।`)
        }
        const objectKey = `orders/${userId}/${Date.now()}-${key}-${value.name}`.replace(/\s+/g, '_')
        await env.FILES.put(objectKey, await value.arrayBuffer(), {
          httpMetadata: { contentType: value.type || 'application/octet-stream' },
        })
        input.fileKeys[key] = objectKey
        input.formValues[key] = objectKey
      } else {
        input.formValues[key] = value
      }
    }
    return input
  },

  /** Parses a plain-JSON order submission. */
  parseJsonInput(body: any): CreateOrderInput {
    return {
      serviceSlug: body.service_slug || '',
      captchaToken: body.captcha_token || '',
      captchaAnswer: body.captcha_answer || '',
      formValues: body.form_data || {},
      fileKeys: {},
    }
  },

  /**
   * Creates an order end-to-end:
   *  1. validates the service is active
   *  2. verifies captcha when the service demands it
   *  3. validates values against the dynamic form schema
   *  4. debits the wallet atomically (402 if short)
   *  5. inserts the order + audit log
   *  6. runs the fulfillment engine (auto NID / api / hybrid / manual)
   */
  async createOrder(env: Bindings, userId: number, input: CreateOrderInput) {
    const db = env.DB
    const { serviceSlug, captchaToken, captchaAnswer, formValues, fileKeys } = input

    if (!serviceSlug) throw badRequest('সার্ভিস নির্বাচন করুন।')

    const service = await db.prepare(`SELECT * FROM services WHERE slug = ? AND status = 'active'`)
      .bind(serviceSlug)
      .first<any>()

    if (!service) throw notFound('সার্ভিসটি বর্তমানে সক্রিয় নেই।')

    // Captcha verification
    if (service.requires_captcha) {
      if (!captchaToken || !captchaAnswer) throw badRequest('ক্যাপচা যাচাই করুন।')
      const captchaOk = await verifyCaptcha(getJwtSecret(env), captchaToken, captchaAnswer)
      if (!captchaOk) throw badRequest('ক্যাপচার উত্তর ভুল অথবা মেয়াদোত্তীর্ণ। আবার চেষ্টা করুন।')
    }

    // Validate against dynamic form schema
    let schema: any[] = []
    try {
      schema = JSON.parse(service.form_schema)
    } catch {}

    for (const field of schema) {
      if (field.required && !formValues[field.name] && field.type !== 'file') {
        throw badRequest(`"${field.label_bn}" পূরণ করা আবশ্যক।`)
      }
      if (field.required && field.type === 'file' && !fileKeys[field.name]) {
        throw badRequest(`"${field.label_bn}" ফাইল আপলোড করুন।`)
      }
      if (field.pattern && formValues[field.name]) {
        const re = new RegExp(field.pattern)
        if (!re.test(String(formValues[field.name]))) {
          throw badRequest(`"${field.label_bn}" এর ফরম্যাট সঠিক নয়।`)
        }
      }
    }

    // Debit wallet atomically (skip for free services priced at 0)
    if (service.price > 0) {
      const debit = await debitWallet(db, userId, service.price, 'order_payment', 'order', null, `${service.name_bn} সার্ভিসের মূল্য পরিশোধ`)
      if (!debit.success) {
        throw new ApiError(402, 'আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে রিচার্জ করুন।', {
          code: 'INSUFFICIENT_BALANCE',
        })
      }
    }

    const orderNo = generateOrderNo()
    const result = await db
      .prepare(
        `INSERT INTO orders (order_no, user_id, service_id, form_data, price, fulfillment_mode, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(orderNo, userId, service.id, JSON.stringify(formValues), service.price, service.fulfillment_mode)
      .run()

    const orderId = result.meta.last_row_id as number
    await logOrderEvent(db, orderId, 'user', userId, 'created', 'অর্ডার তৈরি হয়েছে')

    await db.prepare('UPDATE services SET total_orders = total_orders + 1 WHERE id = ?').bind(service.id).run()

    // Link any pending order payment transaction to this orderId
    try {
      await db
        .prepare("UPDATE transactions SET reference_id = ? WHERE user_id = ? AND reference_type = 'order' AND reference_id IS NULL")
        .bind(orderId, userId)
        .run()
    } catch {}

    await this.fulfill(env, { orderId, orderNo, userId, service, formValues, fileKeys })

    const created = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<any>()
    // Parse JSON blobs so the create-response matches the detail-response shape
    try {
      created.form_data = JSON.parse(created.form_data)
    } catch {}
    try {
      created.result_data = created.result_data ? JSON.parse(created.result_data) : null
    } catch {}
    return created
  },

  /**
   * Fulfillment engine — config-driven via FulfillmentService.
   *  - auto (AUTO_DOCUMENT family) : build the service-specific result instantly
   *  - api               : call configured provider; refund on failure
   *  - hybrid            : call provider; fall back to manual review
   *  - manual            : notify + wait for admin
   */
  async fulfill(
    env: Bindings,
    ctx: { orderId: number; orderNo: string; userId: number; service: any; formValues: Record<string, any>; fileKeys: Record<string, string> }
  ) {
    const db = env.DB
    const { orderId, orderNo, userId, service, formValues, fileKeys } = ctx

    if (service.fulfillment_mode === 'auto' || AUTO_DOCUMENT_SLUGS.has(service.slug)) {
      // Instant auto fulfillment — per-service result builder packages the
      // user-submitted data (the server never invents data on its own).
      const { resultData, logNote, notifTitle } = buildAutoResult(service, formValues, fileKeys)

      await db
        .prepare(`UPDATE orders SET status = 'completed', result_data = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(JSON.stringify(resultData), orderId)
        .run()

      await db.prepare('UPDATE services SET success_orders = success_orders + 1 WHERE id = ?').bind(service.id).run()

      await logOrderEvent(db, orderId, 'system', null, 'auto_completed', logNote)
      await pushNotification(
        db,
        userId,
        notifTitle,
        `আপনার "${service.name_bn}" অর্ডারটি (${orderNo}) স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে। ওয়ালেট থেকে ৳${service.price} ফি কর্তন করা হয়েছে।`,
        'success',
        `/dashboard/orders/${orderId}`
      )
      return
    }

    if (service.fulfillment_mode === 'api' || service.fulfillment_mode === 'hybrid') {
      if (service.api_provider_id) {
        const provider = await db
          .prepare(`SELECT * FROM api_providers WHERE id = ? AND status = 'active'`)
          .bind(service.api_provider_id)
          .first<any>()

        if (provider) {
          await db.prepare(`UPDATE orders SET status = 'processing' WHERE id = ?`).bind(orderId).run()
          await logOrderEvent(db, orderId, 'system', null, 'auto_processing', `${provider.name} API-তে পাঠানো হয়েছে`)

          let fieldMapping: Record<string, string> | null = null
          try {
            fieldMapping = service.field_mapping ? JSON.parse(service.field_mapping) : null
          } catch {}

          const apiResult = await callApiProvider(provider, fieldMapping, formValues)
          await db.prepare('UPDATE api_providers SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(provider.id).run()

          if (apiResult.ok) {
            await db
              .prepare(
                `UPDATE orders SET status = 'completed', result_data = ?, api_raw_response = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`
              )
              .bind(JSON.stringify(apiResult.result ?? {}), JSON.stringify(apiResult.raw ?? {}), orderId)
              .run()
            await db.prepare('UPDATE services SET success_orders = success_orders + 1 WHERE id = ?').bind(service.id).run()
            await logOrderEvent(db, orderId, 'system', null, 'api_success', 'স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে')
            await pushNotification(
              db,
              userId,
              'অর্ডার সম্পন্ন হয়েছে ✅',
              `আপনার "${service.name_bn}" অর্ডারটি (${orderNo}) স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে।`,
              'success',
              `/dashboard/orders/${orderId}`
            )
          } else if (service.fulfillment_mode === 'api') {
            // API failed in pure-api mode → auto-refund
            await creditWallet(db, userId, service.price, 'refund', 'order', orderId, `${service.name_bn} - API ব্যর্থ হওয়ায় স্বয়ংক্রিয় রিফান্ড`)
            await db
              .prepare(`UPDATE orders SET status = 'refunded', api_raw_response = ?, admin_note = ? WHERE id = ?`)
              .bind(JSON.stringify(apiResult.raw ?? {}), apiResult.errorMessage || 'API failed', orderId)
              .run()
            await logOrderEvent(db, orderId, 'system', null, 'refunded', apiResult.errorMessage || 'API ব্যর্থ - অটো রিফান্ড')
            await pushNotification(
              db,
              userId,
              'অর্ডার ব্যর্থ - রিফান্ড সম্পন্ন ↩️',
              `"${service.name_bn}" অর্ডারটি প্রসেস করা যায়নি। ৳${service.price} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`,
              'warning',
              `/dashboard/orders/${orderId}`
            )
          } else {
            // hybrid -> keep pending for manual admin review, don't refund yet
            await db
              .prepare(`UPDATE orders SET status = 'pending', api_raw_response = ?, admin_note = ? WHERE id = ?`)
              .bind(JSON.stringify(apiResult.raw ?? {}), 'API failed, needs manual review', orderId)
              .run()
            await logOrderEvent(db, orderId, 'system', null, 'api_failed', 'API ব্যর্থ - ম্যানুয়াল রিভিউতে পাঠানো হয়েছে')
          }
          return
        }
      }
    }

    // manual (default)
    await pushNotification(
      db,
      userId,
      'অর্ডার গৃহীত হয়েছে 🕐',
      `আপনার "${service.name_bn}" অর্ডারটি (${orderNo}) গৃহীত হয়েছে এবং ম্যানুয়ালি প্রসেস করা হবে।`,
      'info',
      `/dashboard/orders/${orderId}`
    )
  },

  /**
   * Returns the R2 object for a file the USER uploaded on their own
   * order (owner-scoped). Used for inline previews/downloads.
   */
  async getUploadedFile(env: Bindings, userId: number, orderId: string, fieldName: string) {
    const order = await env.DB.prepare('SELECT form_data FROM orders WHERE id = ? AND user_id = ?')
      .bind(orderId, userId)
      .first<any>()
    if (!order) throw notFound('অর্ডার পাওয়া যায়নি।')

    let formData: Record<string, any> = {}
    try {
      formData = JSON.parse(order.form_data)
    } catch {}

    const objectKey = formData[fieldName]
    if (!objectKey || typeof objectKey !== 'string' || !objectKey.startsWith(`orders/${userId}/`)) {
      throw notFound('ফাইল পাওয়া যায়নি।')
    }

    const object = await env.FILES.get(objectKey)
    if (!object) throw notFound('ফাইল পাওয়া যায়নি।')

    return { object, filename: objectKey.split('/').pop() || 'file' }
  },

  /** Returns the R2 object for an order's admin-attached result file (owner-scoped). */
  async getResultFile(env: Bindings, userId: number, orderId: string) {
    const order = await env.DB.prepare('SELECT result_file_key FROM orders WHERE id = ? AND user_id = ?')
      .bind(orderId, userId)
      .first<any>()

    if (!order || !order.result_file_key) throw notFound('ফাইল পাওয়া যায়নি।')

    const object = await env.FILES.get(order.result_file_key)
    if (!object) throw notFound('ফাইল পাওয়া যায়নি।')

    return { object, filename: order.result_file_key.split('/').pop() || 'file' }
  },
}
