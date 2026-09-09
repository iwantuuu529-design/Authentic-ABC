// ============================================================
// SupportService (frontend) — user-side ticket flows.
// ============================================================

const SupportService = {
  /** GET /api/support/tickets */
  async listTickets() {
    return API.get('/support/tickets')
  },

  /** POST /api/support/tickets */
  async createTicket({ subject, message, category, order_id }) {
    return API.post('/support/tickets', { subject, message, category, order_id })
  },

  /** GET /api/support/tickets/:id */
  async getTicket(id) {
    return API.get(`/support/tickets/${id}`)
  },

  /** POST /api/support/tickets/:id/reply */
  async reply(id, message) {
    return API.post(`/support/tickets/${id}/reply`, { message })
  },
}
