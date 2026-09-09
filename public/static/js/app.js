// ============================================================
// App bootstrap: verify session on load (keeps localStorage user in sync)
// ============================================================
;(async function bootstrap() {
  const stored = getStoredUser()
  if (stored) {
    try {
      const user = await AuthService.me()
      setStoredUser(user)
    } catch {
      localStorage.removeItem('df_user')
    }
  }

  // Global, route-independent UI: Live Notice ticker + Promo/Offer card.
  // Both are hidden by default and only appear when admin-configured, so
  // it's safe to run this on every page (landing, auth, dashboard, admin).
  syncLiveNoticeBar()
  syncPromoCard()
})()
