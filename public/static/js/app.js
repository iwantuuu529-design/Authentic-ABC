// ============================================================
// App bootstrap: verify session on load (keeps localStorage user in sync)
// ============================================================
;(async function bootstrap() {
  const stored = getStoredUser()
  if (stored) {
    try {
      const res = await API.get('/auth/me')
      setStoredUser(res.user)
    } catch {
      localStorage.removeItem('df_user')
    }
  }
})()
