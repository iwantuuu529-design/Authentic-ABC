// ============================================================
// AdminService (frontend) — ONE module owns every /api/admin/*
// call, grouped by domain. The admin pages never touch the raw
// API client directly.
// ============================================================

const AdminService = {
  // ------------------------- DASHBOARD -------------------------
  dashboard: {
    /** GET /api/admin/dashboard — platform KPIs + trends. */
    stats() {
      return API.get('/admin/dashboard')
    },
  },

  // ------------------------- USERS -------------------------
  users: {
    list({ q, status, page } = {}) {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      if (page) params.set('page', String(page))
      return API.get(`/admin/users?${params.toString()}`)
    },
    get(id) {
      return API.get(`/admin/users/${id}`)
    },
    /** Approve / suspend / activate / ban. */
    setStatus(id, status) {
      return API.put(`/admin/users/${id}/status`, { status })
    },
    /** Manual credit (positive) / debit (negative) with reason. */
    adjustBalance(id, amount, reason) {
      return API.post(`/admin/users/${id}/adjust-balance`, { amount, reason })
    },
    setKyc(id, status) {
      return API.put(`/admin/users/${id}/kyc`, { status })
    },
    remove(id) {
      return API.del(`/admin/users/${id}`)
    },
  },

  // ------------------------- ORDERS -------------------------
  orders: {
    list({ status, service_id, q, page } = {}) {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (service_id) params.set('service_id', String(service_id))
      if (q) params.set('q', q)
      if (page) params.set('page', String(page))
      return API.get(`/admin/orders?${params.toString()}`)
    },
    get(id) {
      return API.get(`/admin/orders/${id}`)
    },
    /**
     * Approve with result text / JSON and optional result file.
     * Accepts either a ready FormData (approve-form element) or an
     * explicit { note, resultText, resultFile } object.
     */
    approve(id, input = {}) {
      let fd
      if (input instanceof FormData) {
        fd = input
      } else {
        fd = new FormData()
        fd.append('note', input.note || '')
        if (input.resultText !== null && input.resultText !== undefined) fd.append('result_text', String(input.resultText))
        if (input.resultFile) fd.append('result_file', input.resultFile, input.resultFile.name)
      }
      return API.putForm(`/admin/orders/${id}/approve`, fd)
    },
    reject(id, reason) {
      return API.put(`/admin/orders/${id}/reject`, { reason })
    },
    setNote(id, note) {
      return API.put(`/admin/orders/${id}/note`, { note })
    },
    /** URL to stream a user-uploaded form file for review. */
    uploadFileUrl(id, fieldName) {
      return `/api/admin/orders/${id}/upload/${encodeURIComponent(fieldName)}`
    },
  },

  // ------------------------- RECHARGE REQUESTS -------------------------
  recharge: {
    list({ status = 'pending', page = 1 } = {}) {
      return API.get(`/admin/recharge-requests?status=${status}&page=${page}`)
    },
    proofUrl(id) {
      return `/api/admin/recharge-requests/${id}/proof`
    },
    approve(id) {
      return API.put(`/admin/recharge-requests/${id}/approve`)
    },
    reject(id, reason) {
      return API.put(`/admin/recharge-requests/${id}/reject`, { reason })
    },
  },

  // ------------------------- SERVICES / CATEGORIES -------------------------
  services: {
    list() {
      return API.get('/admin/services')
    },
    create(payload) {
      return API.post('/admin/services', payload)
    },
    update(id, payload) {
      return API.put(`/admin/services/${id}`, payload)
    },
    updateRate(id, price, costPrice) {
      const body = { price }
      if (costPrice !== undefined && costPrice !== null && costPrice !== '') body.cost_price = costPrice
      return API.patch(`/admin/services/${id}/rate`, body)
    },
    remove(id) {
      return API.del(`/admin/services/${id}`)
    },
    listCategories() {
      return API.get('/admin/services/categories')
    },
    createCategory(payload) {
      return API.post('/admin/services/categories', payload)
    },
  },

  // ------------------------- API PROVIDERS -------------------------
  providers: {
    list() {
      return API.get('/admin/api-providers')
    },
    create(payload) {
      return API.post('/admin/api-providers', payload)
    },
    update(id, payload) {
      return API.put(`/admin/api-providers/${id}`, payload)
    },
    remove(id) {
      return API.del(`/admin/api-providers/${id}`)
    },
    /** Dry-run test call with sample data. */
    test(id, sampleData) {
      return API.post(`/admin/api-providers/${id}/test`, { sample_data: sampleData || {} })
    },
  },

  // ------------------------- COUPONS -------------------------
  coupons: {
    list() {
      return API.get('/admin/coupons')
    },
    create(payload) {
      return API.post('/admin/coupons', payload)
    },
    toggle(id, status) {
      return API.put(`/admin/coupons/${id}`, { status })
    },
    remove(id) {
      return API.del(`/admin/coupons/${id}`)
    },
  },

  // ------------------------- SUPPORT -------------------------
  support: {
    listTickets(status) {
      return API.get(`/admin/support/tickets${status ? `?status=${status}` : ''}`)
    },
    getTicket(id) {
      return API.get(`/admin/support/tickets/${id}`)
    },
    reply(id, message) {
      return API.post(`/admin/support/tickets/${id}/reply`, { message })
    },
    setStatus(id, status) {
      return API.put(`/admin/support/tickets/${id}/status`, { status })
    },
  },

  // ------------------------- SETTINGS -------------------------
  settings: {
    getAll() {
      return API.get('/admin/settings')
    },
    update(payload) {
      return API.put('/admin/settings', payload)
    },
    listPaymentMethods() {
      return API.get('/admin/settings/payment-methods')
    },
    createPaymentMethod(payload) {
      return API.post('/admin/settings/payment-methods', payload)
    },
    updatePaymentMethod(id, payload) {
      return API.put(`/admin/settings/payment-methods/${id}`, payload)
    },
    deletePaymentMethod(id) {
      return API.del(`/admin/settings/payment-methods/${id}`)
    },
    listPaymentGateways() {
      return API.get('/admin/settings/payment-gateways')
    },
    updatePaymentGateway(id, payload) {
      return API.put(`/admin/settings/payment-gateways/${id}`, payload)
    },
  },

  // ------------------------- STORAGE -------------------------
  storage: {
    usage() {
      return API.get('/admin/storage/usage')
    },
    purgeOrphaned() {
      return API.del('/admin/storage/orphaned')
    },
  },
}
