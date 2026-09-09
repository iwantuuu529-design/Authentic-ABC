// ============================================================
// CatalogService (frontend) — public service catalog + the NID
// analysis proxy call.
// ============================================================

const CatalogService = {
  /** GET /api/services — active services + categories, optional filters. */
  async list({ category, q } = {}) {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    const qsStr = params.toString()
    const res = await API.get(`/services${qsStr ? `?${qsStr}` : ''}`)
    return { services: res.services || [], categories: res.categories || [] }
  },

  /** GET /api/services/:slug — service detail incl. parsed form_schema. */
  async getBySlug(slug) {
    const res = await API.get(`/services/${encodeURIComponent(slug)}`)
    return res.service
  },

  /**
   * POST /api/services/nid-analyze — uploads the PDF to our own proxy,
   * which forwards it to the SkSeba analysis API (key stays server-side).
   */
  async analyzeNidPdf(pdfFile) {
    const fd = new FormData()
    fd.append('pdf', pdfFile, pdfFile.name || 'nid_slip.pdf')
    return API.postForm('/services/nid-analyze', fd)
  },

  /** POST /api/services/bdris/start — BDRIS step 1 (BRN + DOB -> captcha). */
  async bdrisStart(brn, dob) {
    return API.post('/services/bdris/start', { brn, dob })
  },

  /** POST /api/services/bdris/verify — BDRIS step 2 (solved captcha -> official record). */
  async bdrisVerify(sessionId, captcha) {
    return API.post('/services/bdris/verify', { session_id: sessionId, captcha })
  },
}
