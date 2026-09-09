// ============================================================
// AuthService (frontend) — every auth API call + session storage
// rules live here. Pages never call the raw API for auth.
// ============================================================

const AuthService = {
  /** GET /api/auth/me — verifies the session & refreshes the stored user. */
  async me() {
    const res = await API.get('/auth/me')
    return res.user
  },

  /**
   * POST /api/auth/login — on success the user is cached locally so
   * the router can do instant client-side auth checks.
   */
  async login(payload) {
    const res = await API.post('/auth/login', payload)
    if (res.user) setStoredUser(res.user)
    return res
  },

  /**
   * POST /api/auth/register — new accounts are created `pending`;
   * no session is issued until an admin approves them.
   */
  async register(payload) {
    return API.post('/auth/register', payload)
  },

  /** POST /api/auth/logout — clears both server cookie and local cache. */
  async logout() {
    try {
      await API.post('/auth/logout')
    } catch {
      /* even if the network call fails we must clear the local session */
    }
    localStorage.removeItem('df_user')
  },

  /** PUT /api/auth/profile */
  async updateProfile(payload) {
    return API.put('/auth/profile', payload)
  },

  /** POST /api/auth/change-password */
  async changePassword(payload) {
    return API.post('/auth/change-password', payload)
  },

  /** Refreshes the cached balance after wallet-changing actions. */
  async refreshStoredUser() {
    try {
      const user = await this.me()
      setStoredUser(user)
      return user
    } catch {
      return getStoredUser()
    }
  },
}
