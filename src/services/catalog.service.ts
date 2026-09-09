// ============================================================
// CatalogService — public service catalog: categories, service
// listings, service detail (dynamic form schema), default-service
// seeding, and the NID-analysis proxy.
// ============================================================

import type { Bindings } from '../types/bindings'
import { ApiError, notFound } from './errors'
import { getBdrisApiKey, bdrisStartCaptcha, bdrisVerify, fetchCaptchaImage } from '../lib/bdris'

let servicesInitialized = false

export const CatalogService = {
  /**
   * Idempotent bootstrap: guarantees the default categories and the
   * flagship "nid-create" service exist even on a freshly restored DB.
   */
  async ensureDefaultServices(db: D1Database) {
    if (servicesInitialized || !db) return
    try {
      // 1. Ensure categories exist
      await db
        .prepare(
          `
      INSERT OR IGNORE INTO service_categories (id, name_bn, name_en, slug, icon, sort_order) VALUES
      (1, 'জন্ম নিবন্ধন', 'Birth Registration', 'birth', 'fa-baby', 1),
      (2, 'এনআইডি ও ভোটার সেবা', 'NID & Voter Services', 'nid', 'fa-id-card', 2),
      (3, 'ভূমি সেবা', 'Land Services', 'land', 'fa-map-location-dot', 3),
      (4, 'অন্যান্য সেবা', 'Other Services', 'others', 'fa-layer-group', 4)
    `
        )
        .run()

      // 2. Ensure nid-create service exists in Category 2 (NID & Voter Services)
      // Update legacy nibandan-pdf-create or existing nid-create to auto fulfillment mode
      await db
        .prepare(
          `
      UPDATE services
      SET category_id = 2,
          name_bn = 'এনআইডি ক্রিয়েট',
          name_en = 'NID CREATE',
          slug = 'nid-create',
          fulfillment_mode = 'auto',
          description_bn = 'CMS কপি বা অনলাইন কপি আপলোড করে স্বয়ংক্রিয়ভাবে ইনস্ট্যান্ট এনআইডি কার্ড প্রস্তুত করুন।',
          icon = 'fa-id-card'
      WHERE slug = 'nibandan-pdf-create' OR slug = 'nid-create'
    `
        )
        .run()

      const checkNid = await db.prepare("SELECT id FROM services WHERE slug = 'nid-create'").first()
      if (!checkNid) {
        await db
          .prepare(
            `
        INSERT INTO services
        (category_id, name_bn, name_en, slug, description_bn, icon, price, cost_price, fulfillment_mode, form_schema, avg_delivery_minutes, requires_captcha, is_featured, sort_order, status)
        VALUES
        (2, 'এনআইডি ক্রিয়েট', 'NID CREATE', 'nid-create',
         'CMS কপি বা অনলাইন কপি আপলোড করে স্বয়ংক্রিয়ভাবে ইনস্ট্যান্ট এনআইডি কার্ড প্রস্তুত করুন।', 'fa-id-card', 4.00, 1.00, 'auto',
         '[{"name":"pdf_file","label_bn":"পিডিএফ আপলোড করুন","type":"file","accept":".pdf","required":true},{"name":"name_bn","label_bn":"নাম (বাংলা)","type":"text","required":true},{"name":"name_en","label_bn":"নাম (ইংরেজি)","type":"text","required":true},{"name":"registration_no","label_bn":"এনআইডি নম্বর","type":"text","required":true},{"name":"book_no","label_bn":"পিন নম্বর","type":"text","required":false},{"name":"father_name_bn","label_bn":"পিতার নাম","type":"text","required":true},{"name":"mother_name_bn","label_bn":"মাতার নাম","type":"text","required":true},{"name":"birth_place","label_bn":"জন্মস্থান","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"text","required":true},{"name":"gender_blood","label_bn":"রক্তের গ্রুপ / লিঙ্গ","type":"text","required":false},{"name":"issue_date","label_bn":"প্রদানের তারিখ","type":"text","required":false},{"name":"address","label_bn":"ঠিকানা","type":"textarea","required":true}]',
         1, 0, 1, 1, 'active')
      `
          )
          .run()
      }

      // 3. Per-service fulfillment logic (mirrors migrations 0003/0004 so
      // production D1 self-heals without running wrangler migrations):
      //    - doc-generation services -> auto
      //    - lookups -> hybrid + correct field_mapping
      //    - bdris_api_key setting
      await db.prepare(`UPDATE services SET fulfillment_mode = 'auto' WHERE slug IN ('nid-create', 'nibandan-pdf-create', 'nid-make')`).run()
      await db.prepare(`UPDATE services SET fulfillment_mode = 'hybrid', field_mapping = '{"ubrn":"ubrn","dob":"dob"}' WHERE slug = 'birth-certificate-search'`).run()
      await db
        .prepare(
          `UPDATE services SET fulfillment_mode = 'hybrid', field_mapping = '{"name":"name","father_name":"father_name","year_from":"year_from","year_to":"year_to","gender":"gender"}' WHERE slug = 'birth-ministry-data'`
        )
        .run()
      await db.prepare(`UPDATE services SET fulfillment_mode = 'hybrid', field_mapping = '{"nid_number":"nid_number","dob":"dob"}' WHERE slug = 'nid-sign-copy'`).run()
      await db
        .prepare(
          `UPDATE services SET fulfillment_mode = 'hybrid', field_mapping = '{"district":"district","upazila":"upazila","mouza":"mouza","khatian_no":"khatian_no","owner_name":"owner_name"}' WHERE slug = 'land-dakhila-finder'`
        )
        .run()
      await db
        .prepare(`UPDATE services SET field_mapping = '{"nid_number":"nid_number","dob":"dob"}' WHERE slug = 'nid-server-copy' AND (field_mapping IS NULL OR field_mapping = '')`)
        .run()
      await db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('bdris_api_key', '2f5b625b1c1864256f418c8c00ad5307')`).run()

      servicesInitialized = true
    } catch (err) {
      console.error('ensureDefaultServices error:', err)
    }
  },

  /** All active services (optionally filtered by category slug / search). */
  async listServices(env: Bindings, opts: { category?: string; q?: string } = {}) {
    await this.ensureDefaultServices(env.DB)

    let query = `
    SELECT s.id, s.name_bn, s.name_en, s.slug, s.description_bn, s.icon, s.price,
           s.avg_delivery_minutes, s.requires_captcha, s.is_featured, s.fulfillment_mode,
           s.total_orders, s.success_orders, c.slug as category_slug, c.name_bn as category_name_bn
    FROM services s
    LEFT JOIN service_categories c ON c.id = s.category_id
    WHERE s.status = 'active'
  `
    const params: any[] = []
    if (opts.category) {
      query += ' AND c.slug = ?'
      params.push(opts.category)
    }
    if (opts.q) {
      query += ' AND (s.name_bn LIKE ? OR s.name_en LIKE ?)'
      params.push(`%${opts.q}%`, `%${opts.q}%`)
    }
    query += ' ORDER BY s.is_featured DESC, s.sort_order ASC'

    const { results } = await env.DB.prepare(query).bind(...params).all()

    const categories = await env.DB.prepare(
      `SELECT id, name_bn, name_en, slug, icon FROM service_categories WHERE status = 'active' ORDER BY sort_order ASC`
    ).all()

    return { services: results, categories: categories.results }
  },

  /** One service by slug, with its form_schema parsed for dynamic rendering. */
  async getServiceBySlug(env: Bindings, slugParam: string) {
    await this.ensureDefaultServices(env.DB)
    const slug = slugParam === 'nibandan-pdf-create' ? 'nid-create' : slugParam
    const service = await env.DB.prepare(
      `SELECT s.id, s.name_bn, s.name_en, s.slug, s.description_bn, s.icon, s.price,
              s.form_schema, s.avg_delivery_minutes, s.requires_captcha, s.fulfillment_mode,
              s.total_orders, s.success_orders, c.name_bn as category_name_bn
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.slug = ? AND s.status = 'active'`
    )
      .bind(slug)
      .first<any>()

    if (!service) {
      throw notFound('সার্ভিসটি খুঁজে পাওয়া যায়নি।')
    }

    let formSchema = []
    try {
      formSchema = JSON.parse(service.form_schema)
    } catch {
      formSchema = []
    }

    return { ...service, form_schema: formSchema }
  },

  /**
   * Server-side proxy for the SkSeba NID analysis API — keeps the
   * third-party key off the client. Returns the parsed JSON payload
   * verbatim; transport/parse problems throw ApiErrors carrying the
   * endpoint's own `{ status:'error' }` shape so the route can relay
   * it unchanged.
   */
  async analyzeNidPdf(env: Bindings, pdfFile: File | null, referer?: string): Promise<Record<string, unknown>> {
    if (!pdfFile || typeof pdfFile.name !== 'string') {
      throw new ApiError(400, 'পিডিএফ ফাইল আপলোড করা প্রয়োজন।', { status: 'error' })
    }

    try {
      const rawKey = String(
        process.env.SKSEBA_API_KEY || (env as any)?.SKSEBA_API_KEY || '2f5b625b1c1864256f418c8c00ad5307'
      )
      const apiKey = rawKey.match(/[a-f0-9]{32}/i)?.[0] || '2f5b625b1c1864256f418c8c00ad5307'
      const apiUrl = 'https://core.skseba.shop/api/v2/nid/analyze'

      const forwardForm = new FormData()
      forwardForm.append('key', apiKey)
      forwardForm.append('pdf', pdfFile, pdfFile.name || 'nid_slip.pdf')

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: forwardForm,
        headers: { Referer: referer || 'https://core.skseba.shop' },
      })

      const text = await response.text()
      try {
        return JSON.parse(text)
      } catch {
        throw new ApiError(500, 'API থেকে অপ্রত্যাশিত রেসপন্স এসেছে: ' + text.slice(0, 200), { status: 'error' })
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err
      console.error('NID Analyze Proxy Error:', err)
      throw new ApiError(500, 'সার্ভার সংযোগে ত্রুটি: ' + (err.message || String(err)), { status: 'error' })
    }
  },

  /**
   * BDRIS step 1 (pre-order, for the AUTO designer) — starts the govt
   * lookup and returns the session id + captcha image as a base64 data
   * URI so the service page can show it inline. Stateless: the client
   * carries `session_id` forward to bdrisVerify.
   */
  async bdrisStart(env: Bindings, brn: string, dob: string) {
    const cleanBrn = String(brn || '').trim()
    const cleanDob = String(dob || '').trim()
    if (!/^\d{13,17}$/.test(cleanBrn)) throw new ApiError(400, 'সঠিক জন্ম নিবন্ধন নম্বর দিন (১৩–১৭ ডিজিট)।')
    if (!cleanDob) throw new ApiError(400, 'জন্ম তারিখ দিন।')

    const apiKey = await getBdrisApiKey(env.DB, env)
    const started = await bdrisStartCaptcha(apiKey, cleanBrn, cleanDob)
    if (!started.ok || !started.sessionId) {
      throw new ApiError(400, started.error || 'সরকারি সার্ভারে সংযোগ করা যায়নি।')
    }

    let captchaImage: string | null = null
    if (started.captchaUrl) {
      const img = await fetchCaptchaImage(started.captchaUrl)
      if (img) {
        const bytes = new Uint8Array(img.bytes)
        let bin = ''
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        captchaImage = `data:${img.contentType || 'image/png'};base64,${btoa(bin)}`
      }
    }
    return { session_id: started.sessionId, captcha_image: captchaImage }
  },

  /**
   * BDRIS step 2 (pre-order) — verifies the solved captcha and returns
   * the OFFICIAL record. The designer auto-fills the certificate form
   * from this data — the platform never invents any of it.
   */
  async bdrisVerify(env: Bindings, sessionId: string, captcha: string) {
    const sid = String(sessionId || '').trim()
    const code = String(captcha || '').trim()
    if (!sid) throw new ApiError(400, 'সেশন পাওয়া যায়নি — আবার শুরু করুন।')
    if (!code) throw new ApiError(400, 'ক্যাপচা কোডটি লিখুন।')

    const apiKey = await getBdrisApiKey(env.DB, env)
    const result = await bdrisVerify(apiKey, sid, code)
    if (!result.ok) {
      throw new ApiError(400, result.error || 'যাচাই ব্যর্থ হয়েছে।', { captcha_issue: Boolean(result.captchaIssue) })
    }
    return { record: result.data }
  },
}
