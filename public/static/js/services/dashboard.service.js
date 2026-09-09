// ============================================================
// DashboardService (frontend) — aggregated home-screen data.
// ============================================================

const DashboardService = {
  /** GET /api/dashboard/summary */
  async summary() {
    return API.get('/dashboard/summary')
  },
}

// ============================================================
// Engagement services: notifications, referral, reports, misc.
// ============================================================

const NotificationService = {
  /** GET /api/notifications */
  async list() {
    return API.get('/notifications')
  },

  /** POST /api/notifications/read-all */
  async markAllRead() {
    return API.post('/notifications/read-all')
  },

  /** POST /api/notifications/:id/read */
  async markRead(id) {
    return API.post(`/notifications/${id}/read`)
  },
}

const ReferralService = {
  /** GET /api/referral */
  async summary() {
    return API.get('/referral')
  },
}

const ReportService = {
  /** GET /api/reports/overview */
  async overview() {
    return API.get('/reports/overview')
  },
}

const MiscService = {
  /** GET /api/captcha */
  async captcha() {
    return API.get('/captcha')
  },

  /** GET /api/settings — public site settings (site name, WhatsApp, promos…). */
  async publicSettings() {
    const res = await API.get('/settings')
    return res.settings || {}
  },
}
