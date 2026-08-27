import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { sanitizeText } from '../../utils/validate'
import { logAdminAction } from '../../lib/notify'
import { callApiProvider } from '../../lib/apiProvider'

const adminProviders = new Hono<AppEnv>()

// GET /api/admin/api-providers — list (secrets masked)
adminProviders.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM api_providers ORDER BY created_at DESC').all()
  const masked = (results as any[]).map((p) => ({
    ...p,
    auth_key_value: p.auth_key_value ? '••••••••' + String(p.auth_key_value).slice(-4) : null,
  }))
  return c.json({ success: true, providers: masked })
})

// POST /api/admin/api-providers — register a new pluggable API provider (no code deploy needed)
adminProviders.post('/', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))

  const name = sanitizeText(body.name, 100)
  const baseUrl = sanitizeText(body.base_url, 500)
  if (!name || !baseUrl) {
    return c.json({ success: false, message: 'প্রোভাইডারের নাম ও Base URL আবশ্যক।' }, 400)
  }

  const result = await c.env.DB.prepare(
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

  await logAdminAction(c.env.DB, admin.id, 'api_provider_created', 'api_provider', result.meta.last_row_id as number, name)

  return c.json({ success: true, message: 'API Provider তৈরি হয়েছে।', id: result.meta.last_row_id })
})

// PUT /api/admin/api-providers/:id
adminProviders.put('/:id', async (c) => {
  const admin = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const existing = await c.env.DB.prepare('SELECT * FROM api_providers WHERE id = ?').bind(id).first<any>()
  if (!existing) return c.json({ success: false, message: 'প্রোভাইডার পাওয়া যায়নি।' }, 404)

  await c.env.DB.prepare(
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
      id
    )
    .run()

  await logAdminAction(c.env.DB, admin.id, 'api_provider_updated', 'api_provider', parseInt(id))

  return c.json({ success: true, message: 'প্রোভাইডার আপডেট হয়েছে।' })
})

adminProviders.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const inUse = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM services WHERE api_provider_id = ?').bind(id).first<any>()
  if (inUse && inUse.cnt > 0) {
    return c.json({ success: false, message: 'এই প্রোভাইডার একটি সার্ভিসে ব্যবহৃত হচ্ছে, প্রথমে সেটি পরিবর্তন করুন।' }, 400)
  }
  await c.env.DB.prepare('DELETE FROM api_providers WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: 'প্রোভাইডার মুছে ফেলা হয়েছে।' })
})

// POST /api/admin/api-providers/:id/test — dry-run test call with sample data
adminProviders.post('/:id/test', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const sampleData = body.sample_data || {}

  const provider = await c.env.DB.prepare('SELECT * FROM api_providers WHERE id = ?').bind(id).first<any>()
  if (!provider) return c.json({ success: false, message: 'প্রোভাইডার পাওয়া যায়নি।' }, 404)

  const result = await callApiProvider(provider, null, sampleData)
  return c.json({ success: result.ok, test_result: result })
})

export default adminProviders
