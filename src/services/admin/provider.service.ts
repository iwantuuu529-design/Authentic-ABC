// ============================================================
// AdminProviderService — pluggable API provider registry: CRUD
// (secrets masked on read) + dry-run test calls through the
// shared callApiProvider engine.
// ============================================================

import type { Bindings } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'
import { callApiProvider } from '../../lib/apiProvider'
import { badRequest, notFound } from '../errors'

export const AdminProviderService = {
  async listProviders(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT * FROM api_providers ORDER BY created_at DESC').all()
    const masked = (results as any[]).map((p) => ({
      ...p,
      auth_key_value: p.auth_key_value ? '••••••••' + String(p.auth_key_value).slice(-4) : null,
    }))
    return { providers: masked }
  },

  async createProvider(env: Bindings, adminId: number, body: any) {
    const db = env.DB

    const name = sanitizeText(body.name, 100)
    const baseUrl = sanitizeText(body.base_url, 500)
    if (!name || !baseUrl) throw badRequest('প্রোভাইডারের নাম ও Base URL আবশ্যক।')

    const result = await db
      .prepare(
        `INSERT INTO api_providers
        (name, base_url, http_method, auth_type, auth_key_name, auth_key_value, request_template,
         response_success_path, response_success_value, response_result_path, response_error_path, timeout_ms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        name,
        baseUrl,
        body.http_method || 'POST',
        body.auth_type || 'header',
        body.auth_key_name || null,
        body.auth_key_value || null,
        body.request_template || null,
        body.response_success_path || null,
        body.response_success_value || null,
        body.response_result_path || null,
        body.response_error_path || null,
        body.timeout_ms || 15000,
        body.status || 'inactive'
      )
      .run()

    await logAdminAction(db, adminId, 'api_provider_created', 'api_provider', result.meta.last_row_id as number, name)

    return { message: 'API Provider তৈরি হয়েছে।', id: result.meta.last_row_id }
  },

  async updateProvider(env: Bindings, adminId: number, providerId: string, body: any) {
    const db = env.DB

    const existing = await db.prepare('SELECT * FROM api_providers WHERE id = ?').bind(providerId).first<any>()
    if (!existing) throw notFound('প্রোভাইডার পাওয়া যায়নি।')

    await db
      .prepare(
        `UPDATE api_providers SET
        name = ?, base_url = ?, http_method = ?, auth_type = ?, auth_key_name = ?,
        auth_key_value = COALESCE(?, auth_key_value), request_template = ?,
        response_success_path = ?, response_success_value = ?, response_result_path = ?,
        response_error_path = ?, timeout_ms = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
      )
      .bind(
        body.name || existing.name,
        body.base_url || existing.base_url,
        body.http_method || existing.http_method,
        body.auth_type || existing.auth_type,
        body.auth_key_name ?? existing.auth_key_name,
        body.auth_key_value || null, // only overwrite if explicitly provided (avoid wiping secret on masked resubmit)
        body.request_template ?? existing.request_template,
        body.response_success_path ?? existing.response_success_path,
        body.response_success_value ?? existing.response_success_value,
        body.response_result_path ?? existing.response_result_path,
        body.response_error_path ?? existing.response_error_path,
        body.timeout_ms ?? existing.timeout_ms,
        body.status || existing.status,
        providerId
      )
      .run()

    await logAdminAction(db, adminId, 'api_provider_updated', 'api_provider', parseInt(providerId))

    return { message: 'প্রোভাইডার আপডেট হয়েছে।' }
  },

  async deleteProvider(env: Bindings, providerId: string) {
    const inUse = await env.DB.prepare('SELECT COUNT(*) as cnt FROM services WHERE api_provider_id = ?')
      .bind(providerId)
      .first<any>()
    if (inUse && inUse.cnt > 0) {
      throw badRequest('এই প্রোভাইডার একটি সার্ভিসে ব্যবহৃত হচ্ছে, প্রথমে সেটি পরিবর্তন করুন।')
    }
    await env.DB.prepare('DELETE FROM api_providers WHERE id = ?').bind(providerId).run()
    return { message: 'প্রোভাইডার মুছে ফেলা হয়েছে।' }
  },

  /** Dry-run test call with sample data. */
  async testProvider(env: Bindings, providerId: string, sampleData: Record<string, any>) {
    const provider = await env.DB.prepare('SELECT * FROM api_providers WHERE id = ?').bind(providerId).first<any>()
    if (!provider) throw notFound('প্রোভাইডার পাওয়া যায়নি।')

    const result = await callApiProvider(provider, null, sampleData || {})
    return { success: result.ok, test_result: result }
  },
}
