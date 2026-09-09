// ============================================================
// Public service catalog routes — thin adapters over CatalogService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authOptional } from '../middleware/auth'
import { CatalogService } from '../services'

const services = new Hono<AppEnv>()

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
