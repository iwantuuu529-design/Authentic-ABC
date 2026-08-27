// ============================================================
// Minimal client-side router (no framework, hash-free SPA)
// ============================================================

const routes = []

function addRoute(pattern, handler, opts = {}) {
  const paramNames = []
  const regexStr = pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1))
    return '([^/]+)'
  })
  routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler, opts })
}

function matchRoute(path) {
  for (const route of routes) {
    const match = path.match(route.regex)
    if (match) {
      const params = {}
      route.paramNames.forEach((name, i) => { params[name] = match[i + 1] })
      return { handler: route.handler, params, opts: route.opts }
    }
  }
  return null
}

async function navigate(path, replace = false) {
  if (replace) history.replaceState({}, '', path)
  else history.pushState({}, '', path)
  await renderRoute()
}

async function renderRoute() {
  const path = window.location.pathname
  const match = matchRoute(path)
  const user = getStoredUser()

  if (!match) {
    qs('#app').innerHTML = notFoundPage()
    return
  }

  if (match.opts.authRequired && !user) {
    return navigate('/login', true)
  }
  if (match.opts.adminRequired && (!user || (user.role !== 'admin' && user.role !== 'staff'))) {
    return navigate('/dashboard', true)
  }
  if (match.opts.guestOnly && user) {
    return navigate(match.opts.adminRequired === false && (user.role === 'admin' || user.role === 'staff') ? '/admin' : '/dashboard', true)
  }

  try {
    await match.handler(match.params)
  } catch (err) {
    console.error('Route error:', err)
    showToast(getErrorMessage(err), 'error')
  }

  // Re-bind global effects after each route render
  initPageEffects()
  qsa('a[data-link]').forEach((a) => {
    if (a._linkBound) return
    a._linkBound = true
    a.addEventListener('click', (e) => {
      e.preventDefault()
      const href = a.getAttribute('href')
      if (href !== window.location.pathname) navigate(href)
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function notFoundPage() {
  return `
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center page-enter">
      <p class="text-8xl font-black text-gradient mb-4">৪০৪</p>
      <h1 class="text-2xl font-bold mb-2">পেজটি খুঁজে পাওয়া যায়নি</h1>
      <p class="text-slate-400 mb-6">আপনি যে পেজটি খুঁজছেন তা মুছে ফেলা হয়েছে বা স্থানান্তরিত হয়েছে।</p>
      <a href="/" data-link class="btn-glow inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 px-6 py-3 rounded-xl font-semibold"><i class="fa-solid fa-house"></i>হোমে ফিরুন</a>
    </div>
  </div>`
}

window.addEventListener('popstate', renderRoute)

document.addEventListener('DOMContentLoaded', () => {
  initCursorGlow()

  // Public
  addRoute('/', renderLandingPage)
  addRoute('/login', renderLoginPage, { guestOnly: true })
  addRoute('/register', renderRegisterPage, { guestOnly: true })

  // User dashboard
  addRoute('/dashboard', renderDashboardHome, { authRequired: true })
  addRoute('/dashboard/services', renderServicesPage, { authRequired: true })
  addRoute('/dashboard/services/:slug', renderServiceOrderPage, { authRequired: true })
  addRoute('/dashboard/orders', renderOrdersPage, { authRequired: true })
  addRoute('/dashboard/orders/:id', renderOrderDetailPage, { authRequired: true })
  addRoute('/dashboard/wallet', renderWalletPage, { authRequired: true })
  addRoute('/dashboard/reports', renderReportsPage, { authRequired: true })
  addRoute('/dashboard/referral', renderReferralPage, { authRequired: true })
  addRoute('/dashboard/support', renderSupportPage, { authRequired: true })
  addRoute('/dashboard/support/:id', renderSupportDetailPage, { authRequired: true })
  addRoute('/dashboard/profile', renderProfilePage, { authRequired: true })

  // Admin
  addRoute('/admin', renderAdminDashboard, { authRequired: true, adminRequired: true })
  addRoute('/admin/orders', renderAdminOrders, { authRequired: true, adminRequired: true })
  addRoute('/admin/orders/:id', renderAdminOrderDetail, { authRequired: true, adminRequired: true })
  addRoute('/admin/recharge', renderAdminRecharge, { authRequired: true, adminRequired: true })
  addRoute('/admin/services', renderAdminServices, { authRequired: true, adminRequired: true })
  addRoute('/admin/providers', renderAdminProviders, { authRequired: true, adminRequired: true })
  addRoute('/admin/users', renderAdminUsers, { authRequired: true, adminRequired: true })
  addRoute('/admin/users/:id', renderAdminUserDetail, { authRequired: true, adminRequired: true })
  addRoute('/admin/coupons', renderAdminCoupons, { authRequired: true, adminRequired: true })
  addRoute('/admin/support', renderAdminSupport, { authRequired: true, adminRequired: true })
  addRoute('/admin/support/:id', renderAdminSupportDetail, { authRequired: true, adminRequired: true })
  addRoute('/admin/settings', renderAdminSettings, { authRequired: true, adminRequired: true })

  renderRoute()
})
