// ============================================================
// AdminSettingsService — site settings key-value store, manual
// payment methods (bKash/Nagad numbers) and auto payment
// gateway configuration (secrets masked on read).
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'
import { badRequest, notFound } from '../errors'

export const AdminSettingsService = {
  // ------------------------- GENERAL (key-value) -------------------------

  async getAll(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all()
    const settings: Record<string, string> = {}
    for (const row of results as any[]) settings[row.key] = row.value
    return { settings }
  },

  async updateMany(env: Bindings, adminId: number, entries: Record<string, unknown>) {
    for (const [key, value] of Object.entries(entries)) {
      await env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      )
        .bind(key, String(value))
        .run()
    }
    await logAdminAction(env.DB, adminId, 'settings_updated', 'settings', undefined, JSON.stringify(Object.keys(entries)))
    return { message: 'সেটিংস আপডেট হয়েছে।' }
  },

  // ------------------------- MANUAL PAYMENT METHODS -------------------------

  async listPaymentMethods(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT * FROM payment_methods ORDER BY sort_order ASC').all()
    return { methods: results }
  },

  async createPaymentMethod(env: Bindings, body: any) {
    const method = sanitizeText(body.method, 20)
    const accountNumber = sanitizeText(body.account_number, 30)

    if (!method || !accountNumber) throw badRequest('মেথড ও একাউন্ট নম্বর দিন।')

    const result = await env.DB.prepare(
      `INSERT INTO payment_methods (method, account_number, account_type, instructions_bn, sort_order) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(method, accountNumber, body.account_type || 'personal', body.instructions_bn || '', body.sort_order || 0)
      .run()

    return { message: 'পেমেন্ট মেথড যোগ করা হয়েছে।', id: result.meta.last_row_id }
  },

  async updatePaymentMethod(env: Bindings, methodId: string, body: any) {
    const db = env.DB
    const existing = await db.prepare('SELECT * FROM payment_methods WHERE id = ?').bind(methodId).first<any>()
    if (!existing) throw notFound('পাওয়া যায়নি।')

    await db
      .prepare(`UPDATE payment_methods SET method = ?, account_number = ?, account_type = ?, instructions_bn = ?, status = ?, sort_order = ? WHERE id = ?`)
      .bind(
        body.method || existing.method,
        body.account_number || existing.account_number,
        body.account_type || existing.account_type,
        body.instructions_bn ?? existing.instructions_bn,
        body.status || existing.status,
        body.sort_order ?? existing.sort_order,
        methodId
      )
      .run()

    return { message: 'আপডেট হয়েছে।' }
  },

  async deletePaymentMethod(env: Bindings, methodId: string) {
    await env.DB.prepare('DELETE FROM payment_methods WHERE id = ?').bind(methodId).run()
    return { message: 'মুছে ফেলা হয়েছে।' }
  },

  // ------------------------- AUTO PAYMENT GATEWAYS -------------------------

  async listPaymentGateways(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT * FROM payment_gateways').all()
    const masked = (results as any[]).map((g) => ({
      ...g,
      api_key: g.api_key ? '••••••••' + String(g.api_key).slice(-4) : null,
      api_secret: g.api_secret ? '••••••••' : null,
    }))
    return { gateways: masked }
  },

  async updatePaymentGateway(env: Bindings, adminId: number, gatewayId: string, body: any) {
    const db = env.DB
    const existing = await db.prepare('SELECT * FROM payment_gateways WHERE id = ?').bind(gatewayId).first<any>()
    if (!existing) throw notFound('পাওয়া যায়নি।')

    await db
      .prepare(
        `UPDATE payment_gateways SET
        api_base_url = ?, api_key = COALESCE(?, api_key), api_secret = COALESCE(?, api_secret),
        config = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
      )
      .bind(
        body.api_base_url || existing.api_base_url,
        body.api_key || null,
        body.api_secret || null,
        body.config ? JSON.stringify(body.config) : existing.config,
        body.status || existing.status,
        gatewayId
      )
      .run()

    await logAdminAction(db, adminId, 'payment_gateway_updated', 'payment_gateway', parseInt(gatewayId))

    return { message: 'গেটওয়ে আপডেট হয়েছে।' }
  },
}
