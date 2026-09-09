// ============================================================
// Public service catalog routes — thin adapters over CatalogService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authOptional, authRequired } from '../middleware/auth'
import { CatalogService } from '../services'

const services = new Hono<AppEnv>()

// POST /api/services/bdris/start — BDRIS step 1 for the AUTO designer:
// user gives BRN + DOB, we return session id + captcha image (data URI).
services.post('/bdris/start', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const out = await CatalogService.bdrisStart(c.env, String(body?.brn || ''), String(body?.dob || ''))
  return c.json({ success: true, ...out })
})

// POST /api/services/bdris/verify — BDRIS step 2: returns the official
// record used to auto-fill the certificate form.
services.post('/bdris/verify', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const out = await CatalogService.bdrisVerify(c.env, String(body?.session_id || ''), String(body?.captcha || ''))
  return c.json({ success: true, ...out })
})

// POST /api/services/nid-analyze — Proxy to SkSeba Real NID Analysis API
// (keeps the third-party key server-side; returns the provider JSON verbatim)
services.post('/nid-analyze', async (c) => {
  const formData = await c.req.formData()
  const referer = c.req.header('referer') || c.req.header('origin') || undefined
  const data = await CatalogService.analyzeNidPdf(c.env, formData.get('pdf') as File | null, referer)
  return c.json(data)
})

// GET /api/services — list all active services with categories
services.get('/', authOptional, async (c) => {
  const result = await CatalogService.listServices(c.env, {
    category: c.req.query('category'),
    q: c.req.query('q'),
  })
  return c.json({ success: true, ...result })
})

// GET /api/services/:slug — service detail incl. form_schema for dynamic form rendering
services.get('/:slug', async (c) => {
  const service = await CatalogService.getServiceBySlug(c.env, c.req.param('slug'))
  return c.json({ success: true, service })
})

export default services
