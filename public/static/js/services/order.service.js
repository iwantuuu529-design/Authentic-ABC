// ============================================================
// OrderService (frontend) — order listing, detail, submission
// and file URLs. Submission builds the multipart payload (dynamic
// form fields + captcha) in one place.
// ============================================================

const OrderService = {
  /** GET /api/orders — paginated + optional status filter. */
  async list({ status, page } = {}) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (page) params.set('page', String(page))
    const qsStr = params.toString()
    return API.get(`/orders${qsStr ? `?${qsStr}` : ''}`)
  },

  /** GET /api/orders/:id — detail with timeline logs. */
  async get(id) {
    return API.get(`/orders/${id}`)
  },

  /**
   * POST /api/orders — submits the order as multipart/form-data so
   * file fields travel alongside scalar values. `fields` is a map of
   * form field name -> value (string) or File.
   */
  async create(serviceSlug, fields, { captchaToken = '', captchaAnswer = '' } = {}) {
    const fd = new FormData()
    fd.append('service_slug', serviceSlug)
    if (captchaToken) fd.append('captcha_token', captchaToken)
    if (captchaAnswer) fd.append('captcha_answer', captchaAnswer)
    for (const [key, value] of Object.entries(fields || {})) {
      if (value === null || value === undefined) continue
      if (value instanceof File) fd.append(key, value, value.name)
      else fd.append(key, String(value))
    }
    return API.postForm('/orders', fd)
  },

  /**
   * POST /api/orders (JSON variant) — used when the service form has no
   * file fields, so no multipart boundary overhead is needed.
   */
  async createJson(serviceSlug, formData, { captchaToken = '', captchaAnswer = '' } = {}) {
    const payload = { service_slug: serviceSlug, form_data: formData || {} }
    if (captchaToken) payload.captcha_token = captchaToken
    if (captchaAnswer) payload.captcha_answer = captchaAnswer
    return API.post('/orders', payload)
  },

  /** Submits a fully-prepared FormData (advanced flows like the NID designer). */
  async createRaw(fd) {
    return API.postForm('/orders', fd)
  },

  /** URL for an order's admin-attached result file (auth cookie secures it). */
  resultFileUrl(id) {
    return `/api/orders/${id}/result-file`
  },

  /** URL for a user-uploaded form file (e.g. NID scan preview). */
  uploadFileUrl(id, fieldName) {
    return `/api/orders/${id}/upload/${encodeURIComponent(fieldName)}`
  },
}
