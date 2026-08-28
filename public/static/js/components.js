// ============================================================
// Reusable UI building blocks
// ============================================================

const USER_NAV = [
  { path: '/dashboard', icon: 'fa-grid-2', label: 'ড্যাশবোর্ড' },
  { path: '/dashboard/services', icon: 'fa-shop', label: 'সকল সার্ভিস' },
  { path: '/dashboard/orders', icon: 'fa-receipt', label: 'আমার অর্ডার' },
  { path: '/dashboard/wallet', icon: 'fa-wallet', label: 'ওয়ালেট' },
  { path: '/dashboard/reports', icon: 'fa-chart-pie', label: 'রিপোর্ট' },
  { path: '/dashboard/referral', icon: 'fa-user-plus', label: 'রেফারেল' },
  { path: '/dashboard/support', icon: 'fa-headset', label: 'সাপোর্ট' },
  { path: '/dashboard/profile', icon: 'fa-user-gear', label: 'প্রোফাইল' },
]

const ADMIN_NAV = [
  { path: '/admin', icon: 'fa-chart-line', label: 'ওভারভিউ' },
  { path: '/admin/orders', icon: 'fa-receipt', label: 'অর্ডার ম্যানেজমেন্ট' },
  { path: '/admin/recharge', icon: 'fa-money-bill-transfer', label: 'রিচার্জ রিকুয়েস্ট' },
  { path: '/admin/services', icon: 'fa-cubes', label: 'সার্ভিস ম্যানেজমেন্ট' },
  { path: '/admin/providers', icon: 'fa-plug', label: 'API প্রোভাইডার' },
  { path: '/admin/users', icon: 'fa-users', label: 'ইউজার ম্যানেজমেন্ট' },
  { path: '/admin/coupons', icon: 'fa-ticket', label: 'কুপন' },
  { path: '/admin/support', icon: 'fa-headset', label: 'সাপোর্ট টিকেট' },
  { path: '/admin/settings', icon: 'fa-gear', label: 'সেটিংস' },
]

function iconAvatar(name, size = 40) {
  const initial = (name || 'U').trim().charAt(0).toUpperCase()
  const colors = ['from-brand-400 to-brand-700', 'from-violet-400 to-violet-700', 'from-sky-400 to-sky-700', 'from-amber-400 to-amber-700']
  const color = colors[(name || '').charCodeAt(0) % colors.length]
  return `<div class="rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white shrink-0" style="width:${size}px;height:${size}px;font-size:${size * 0.42}px">${initial}</div>`
}

function renderTopbar(user, isAdmin = false) {
  return `
  <header class="sticky top-0 z-40 glass-strong border-b ${isAdmin ? 'border-violet-500/20 bg-violet-500/[0.03]' : 'border-white/5'}">
    <div class="flex items-center justify-between px-4 lg:px-6 h-16">
      <div class="flex items-center gap-3">
        <button id="sidebar-toggle" class="lg:hidden w-9 h-9 rounded-lg glass flex items-center justify-center text-slate-300">
          <i class="fa-solid fa-bars"></i>
        </button>
        ${isAdmin ? `
        <span class="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-bold ring-1 ring-violet-500/30 uppercase tracking-wide">
          <i class="fa-solid fa-shield-halved"></i> Admin Panel
        </span>` : `
        <div class="hidden md:flex items-center gap-2 glass rounded-full px-4 py-2 w-72">
          <i class="fa-solid fa-magnifying-glass text-slate-500 text-sm"></i>
          <input id="topbar-search" type="text" placeholder="সার্ভিস খুঁজুন..." class="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
        </div>`}
      </div>
      <div class="flex items-center gap-3">
        ${!isAdmin ? `
        <a href="/dashboard/wallet" data-link class="hidden sm:flex items-center gap-2 glass rounded-full px-4 py-2 btn-glow">
          <i class="fa-solid fa-wallet text-brand-400"></i>
          <span id="topbar-balance" class="font-bold text-sm count-up">${formatMoney(user?.balance || 0)}</span>
        </a>` : `
        <span class="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300 text-xs font-semibold ring-1 ring-amber-500/25">
          <i class="fa-solid fa-triangle-exclamation"></i> এখানে করা পরিবর্তন সরাসরি প্ল্যাটফর্মে প্রভাব ফেলে
        </span>`}
        <div class="relative">
          <button id="notif-btn" class="relative w-10 h-10 rounded-full glass flex items-center justify-center text-slate-300 ${isAdmin ? 'hover:text-violet-400' : 'hover:text-brand-400'} transition-colors">
            <i class="fa-solid fa-bell"></i>
            <span id="notif-dot" class="hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-ink-900"></span>
          </button>
          <div id="notif-dropdown" class="hidden absolute right-0 mt-3 w-80 glass-strong rounded-2xl shadow-2xl overflow-hidden animate-pop-in"></div>
        </div>
        <div class="relative">
          <button id="user-menu-btn" class="flex items-center gap-2">
            ${iconAvatar(user?.name, 36)}
            ${isAdmin ? `<span class="hidden lg:inline-flex items-center gap-1 text-xs font-semibold text-violet-300"><i class="fa-solid fa-chevron-down text-[10px]"></i></span>` : ''}
          </button>
          <div id="user-dropdown" class="hidden absolute right-0 mt-3 w-56 glass-strong rounded-2xl shadow-2xl overflow-hidden animate-pop-in p-2">
            <div class="px-3 py-2.5 border-b border-white/5 mb-1">
              <p class="font-semibold text-sm truncate">${escapeHtml(user?.name || '')}</p>
              <p class="text-xs ${isAdmin ? 'text-violet-400' : 'text-slate-400'} truncate">${isAdmin ? '<i class="fa-solid fa-shield-halved mr-1"></i>অ্যাডমিন অ্যাকাউন্ট' : escapeHtml(user?.phone || '')}</p>
            </div>
            <a href="/dashboard/profile" data-link class="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 text-sm"><i class="fa-solid fa-user w-4 text-slate-400"></i>প্রোফাইল (নাম/ইমেইল/পাসওয়ার্ড)</a>
            ${user?.role === 'admin' || user?.role === 'staff' ? `<a href="${isAdmin ? '/dashboard' : '/admin'}" data-link class="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 text-sm"><i class="fa-solid fa-arrows-turn-to-dots w-4 text-slate-400"></i>${isAdmin ? 'ইউজার প্যানেল' : 'এডমিন প্যানেল'}</a>` : ''}
            <button id="logout-btn" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-sm text-rose-400"><i class="fa-solid fa-right-from-bracket w-4"></i>লগআউট</button>
          </div>
        </div>
      </div>
    </div>
  </header>`
}

function renderSidebar(navItems, activePath, isAdmin = false) {
  const accent = isAdmin ? 'violet' : 'brand'
  const items = navItems.map((item) => {
    const isExact = activePath === item.path
    return `
    <a href="${item.path}" data-link class="nav-link ${isExact ? 'active' : ''} ${isAdmin ? 'admin-nav-link' : ''} flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/5 ${isExact ? `bg-white/[0.06] text-${accent}-400` : 'text-slate-400'}">
      <i class="fa-solid ${item.icon} w-5 text-center"></i>
      <span>${item.label}</span>
    </a>`
  }).join('')

  return `
  <aside id="sidebar" class="fixed lg:sticky top-0 left-0 h-screen w-72 glass-strong border-r ${isAdmin ? 'border-violet-500/20' : 'border-white/5'} flex flex-col z-50 -translate-x-full lg:translate-x-0 transition-transform duration-300">
    <div class="flex items-center gap-3 px-6 h-16 border-b ${isAdmin ? 'border-violet-500/20' : 'border-white/5'}">
      <img src="/static/img/logo.png" alt="ABC Authentic" class="w-9 h-9 object-contain drop-shadow-[0_2px_10px_rgba(23,184,129,0.35)]" />
      <span class="font-extrabold text-lg tracking-tight">ABC<span class="text-${accent}-400">Authentic</span></span>
      <button id="sidebar-close" class="lg:hidden ml-auto text-slate-400"><i class="fa-solid fa-xmark"></i></button>
    </div>
    ${isAdmin ? `
    <div class="mx-4 mt-4 px-3 py-2 rounded-xl bg-violet-500/10 ring-1 ring-violet-500/30 flex items-center gap-2">
      <span class="relative flex w-2 h-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full w-2 h-2 bg-violet-400"></span>
      </span>
      <span class="text-[11px] font-bold tracking-wider text-violet-300 uppercase">Admin Mode</span>
    </div>` : ''}
    <nav class="flex-1 overflow-y-auto p-4 space-y-1">${items}</nav>
    <div class="p-4 border-t ${isAdmin ? 'border-violet-500/20' : 'border-white/5'}">
      <div class="glass rounded-2xl p-4 text-center">
        <i class="fa-solid ${isAdmin ? 'fa-shield-halved text-violet-400' : 'fa-headset text-brand-400'} text-xl mb-2"></i>
        <p class="text-xs text-slate-400 mb-2">${isAdmin ? 'অ্যাডমিন হিসেবে আপনি লগইন করা আছেন' : 'সাহায্য প্রয়োজন?'}</p>
        ${isAdmin
          ? `<a href="/dashboard" data-link class="text-xs font-semibold text-violet-400 hover:underline">ইউজার প্যানেলে যান</a>`
          : `<a href="/dashboard/support" data-link class="text-xs font-semibold text-brand-400 hover:underline">সাপোর্ট টিকেট খুলুন</a>`}
      </div>
    </div>
  </aside>
  <div id="sidebar-overlay" class="hidden fixed inset-0 bg-black/60 z-40 lg:hidden"></div>`
}

function bindShellEvents() {
  const sidebar = qs('#sidebar')
  const overlay = qs('#sidebar-overlay')
  qs('#sidebar-toggle')?.addEventListener('click', () => {
    sidebar?.classList.remove('-translate-x-full')
    overlay?.classList.remove('hidden')
  })
  const closeSidebar = () => {
    sidebar?.classList.add('-translate-x-full')
    overlay?.classList.add('hidden')
  }
  qs('#sidebar-close')?.addEventListener('click', closeSidebar)
  overlay?.addEventListener('click', closeSidebar)
  qsa('#sidebar a[data-link]').forEach((a) => a.addEventListener('click', closeSidebar))

  qs('#user-menu-btn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    qs('#user-dropdown')?.classList.toggle('hidden')
    qs('#notif-dropdown')?.classList.add('hidden')
  })
  qs('#notif-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    const dd = qs('#notif-dropdown')
    qs('#user-dropdown')?.classList.add('hidden')
    dd?.classList.toggle('hidden')
    if (dd && !dd.classList.contains('hidden')) {
      await loadNotifDropdown(dd)
    }
  })
  document.addEventListener('click', () => {
    qs('#user-dropdown')?.classList.add('hidden')
    qs('#notif-dropdown')?.classList.add('hidden')
  })
  qs('#logout-btn')?.addEventListener('click', async () => {
    try { await API.post('/auth/logout') } catch {}
    localStorage.removeItem('df_user')
    navigate('/login')
  })

  refreshNotifDot()
}

async function refreshNotifDot() {
  try {
    const res = await API.get('/notifications')
    const dot = qs('#notif-dot')
    if (dot) dot.classList.toggle('hidden', !(res.unread_count > 0))
  } catch {}
}

async function loadNotifDropdown(container) {
  container.innerHTML = `<div class="p-6 text-center text-slate-500 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>লোড হচ্ছে...</div>`
  try {
    const res = await API.get('/notifications')
    if (!res.notifications.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500 text-sm"><i class="fa-regular fa-bell-slash text-2xl mb-2 block"></i>কোনো নোটিফিকেশন নেই</div>`
      return
    }
    container.innerHTML = `
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span class="font-semibold text-sm">নোটিফিকেশন</span>
        <button id="mark-all-read" class="text-xs text-brand-400 hover:underline">সব পঠিত করুন</button>
      </div>
      <div class="max-h-96 overflow-y-auto">
        ${res.notifications.map((n) => `
          <div class="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 ${!n.is_read ? 'bg-brand-500/5' : ''}">
            <div class="flex items-start gap-2.5">
              <i class="fa-solid ${n.type === 'success' ? 'fa-circle-check text-brand-400' : n.type === 'error' ? 'fa-circle-xmark text-rose-400' : n.type === 'warning' ? 'fa-triangle-exclamation text-amber-400' : 'fa-circle-info text-sky-400'} mt-0.5"></i>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">${escapeHtml(n.title)}</p>
                <p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(n.message)}</p>
                <p class="text-[10px] text-slate-500 mt-1">${timeAgo(n.created_at)}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`
    qs('#mark-all-read')?.addEventListener('click', async (e) => {
      e.stopPropagation()
      await API.post('/notifications/read-all')
      refreshNotifDot()
      loadNotifDropdown(container)
    })
  } catch {
    container.innerHTML = `<div class="p-6 text-center text-rose-400 text-sm">লোড করা যায়নি</div>`
  }
}

function dashboardShell(navItems, activePath, isAdmin = false) {
  const user = getStoredUser()
  return `
  <div class="flex ${isAdmin ? 'admin-mode' : ''}">
    ${isAdmin ? `<div class="fixed top-0 left-0 right-0 h-[3px] z-[60] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 bg-[length:200%_100%] animate-shimmer"></div>` : ''}
    ${renderSidebar(navItems, activePath, isAdmin)}
    <div class="flex-1 min-w-0">
      ${renderTopbar(user, isAdmin)}
      <main id="page-content" class="p-4 lg:p-6 max-w-[1600px] mx-auto"></main>
    </div>
  </div>
  ${syncWhatsappFloatButton(isAdmin)}`
}

// ------------------------------------------------------------
// Persistent WhatsApp contact button — user dashboard only
// Lives OUTSIDE the SPA-rendered #app (see src/index.tsx body-level
// anchor) so page-enter's CSS transform never re-parents it into a
// new containing block — this keeps it truly fixed to the viewport
// even while page content scrolls/animates in.
// ------------------------------------------------------------
let _whatsappNumberCache = null

function syncWhatsappFloatButton(isAdmin) {
  const btn = document.getElementById('whatsapp-float-btn')
  if (!btn) return ''
  if (isAdmin) {
    btn.classList.add('hidden')
    return ''
  }
  btn.classList.remove('hidden')
  resolveWhatsappNumber().then((digits) => {
    if (digits) btn.href = `https://wa.me/${digits}`
  })
  return ''
}

async function resolveWhatsappNumber() {
  try {
    if (_whatsappNumberCache === null) {
      const res = await API.get('/settings')
      _whatsappNumberCache = (res.settings && res.settings.support_whatsapp) || ''
    }
    return String(_whatsappNumberCache || '').replace(/[^0-9]/g, '')
  } catch {
    return ''
  }
}

// ------------------------------------------------------------
// Live Notice ticker + Promo/Offer popup card — truly global,
// body-level elements (see src/index.tsx). Both are OFF by default
// and only appear when the admin has explicitly enabled + filled
// them in via Admin → সেটিংস → নোটিস ও অফার. Both read from the
// same public /settings endpoint the WhatsApp button already uses,
// so a single fetch (cached) serves all three features.
// ------------------------------------------------------------
let _settingsCache = null

async function getPublicSettings() {
  try {
    if (_settingsCache === null) {
      const res = await API.get('/settings')
      _settingsCache = res.settings || {}
    }
    return _settingsCache
  } catch {
    return {}
  }
}

function isTruthySetting(v) {
  return v === '1' || v === 1 || v === true || v === 'true'
}

async function syncLiveNoticeBar() {
  const bar = document.getElementById('live-notice-bar')
  if (!bar) return
  // Marketing notice is customer-facing only — never show it inside the admin panel.
  const u = getStoredUser()
  if (u && (u.role === 'admin' || u.role === 'staff')) {
    bar.classList.add('hidden')
    return
  }
  const s = await getPublicSettings()
  const text = String(s.live_notice_text || '').trim()
  if (!isTruthySetting(s.live_notice_enabled) || !text) {
    bar.classList.add('hidden')
    return
  }
  const a = document.getElementById('live-notice-text-a')
  const b = document.getElementById('live-notice-text-b')
  if (a) a.textContent = text
  if (b) b.textContent = text
  const track = document.getElementById('live-notice-track')
  if (track) {
    // Longer text needs a slower scroll so it stays readable.
    const duration = Math.max(14, Math.min(45, text.length / 6 + 10))
    track.style.setProperty('--notice-duration', `${duration}s`)
  }
  bar.classList.remove('hidden')
}

async function syncPromoCard() {
  const modal = document.getElementById('promo-card-modal')
  if (!modal) return
  // Promotional offer popup is customer-facing only — never show it to admin/staff.
  const u = getStoredUser()
  if (u && (u.role === 'admin' || u.role === 'staff')) {
    modal.classList.add('hidden')
    return
  }
  const s = await getPublicSettings()
  const title = String(s.promo_card_title || '').trim()
  if (!isTruthySetting(s.promo_card_enabled) || !title) {
    modal.classList.add('hidden')
    return
  }
  // Re-show a NEW/changed promo even if an older one was dismissed —
  // the dismiss flag is keyed to the actual content, not just a boolean.
  const fingerprint = [title, s.promo_card_desc, s.promo_card_cta_url].join('|')
  if (localStorage.getItem('df_promo_dismissed') === fingerprint) {
    modal.classList.add('hidden')
    return
  }

  const badge = document.getElementById('promo-card-badge')
  const desc = document.getElementById('promo-card-desc')
  const cta = document.getElementById('promo-card-cta')
  const badgeText = String(s.promo_card_badge || 'অফার').trim()
  if (badge) badge.innerHTML = `<i class="fa-solid fa-star"></i> ${escapeHtml(badgeText)}`
  const titleEl = document.getElementById('promo-card-title')
  if (titleEl) titleEl.textContent = title
  if (desc) desc.textContent = String(s.promo_card_desc || '')
  const ctaUrl = String(s.promo_card_cta_url || '').trim()
  const ctaLabel = String(s.promo_card_cta_label || 'বিস্তারিত দেখুন').trim()
  if (cta) {
    if (ctaUrl) {
      cta.href = ctaUrl
      cta.classList.remove('hidden')
      cta.innerHTML = `${escapeHtml(ctaLabel)} <i class="fa-solid fa-arrow-right"></i>`
    } else {
      cta.classList.add('hidden')
    }
  }

  modal.classList.remove('hidden')
  const closeBtn = document.getElementById('promo-card-close')
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1'
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden')
      localStorage.setItem('df_promo_dismissed', fingerprint)
    })
  }
}

// ---------- Small UI atoms ----------

function skeletonCard(h = 'h-28') {
  return `<div class="glass rounded-2xl ${h} skeleton"></div>`
}

function emptyState(icon, title, subtitle, actionHtml = '') {
  return `
  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div class="w-20 h-20 rounded-full glass flex items-center justify-center mb-4 animate-float-slow">
      <i class="fa-solid ${icon} text-3xl text-slate-500"></i>
    </div>
    <h3 class="font-bold text-lg mb-1">${escapeHtml(title)}</h3>
    <p class="text-slate-400 text-sm max-w-sm mb-4">${escapeHtml(subtitle)}</p>
    ${actionHtml}
  </div>`
}

function statCard({ icon, label, value, sub, gradient, id }) {
  return `
  <div class="spot-card glass rounded-2xl p-5 relative overflow-hidden group">
    <div class="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br ${gradient} opacity-[0.12] blur-2xl group-hover:opacity-20 transition-opacity duration-500"></div>
    <div class="flex items-center justify-between mb-3.5">
      <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
        <i class="fa-solid ${icon} text-white text-[15px]"></i>
      </div>
    </div>
    <p class="text-slate-400 text-xs font-medium mb-1 tracking-wide">${label}</p>
    <p id="${id || ''}" class="text-2xl font-extrabold count-up tabular-nums">${value}</p>
    ${sub ? `<p class="text-xs text-slate-500 mt-1">${sub}</p>` : ''}
  </div>`
}

function pagination(currentPage, totalPages, onPageAttr = 'data-page') {
  if (totalPages <= 1) return ''
  let pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i)
    else if (pages[pages.length - 1] !== '...') pages.push('...')
  }
  return `
  <div class="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
    <button ${onPageAttr}="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''} class="page-btn w-9 h-9 rounded-lg glass flex items-center justify-center text-sm disabled:opacity-30"><i class="fa-solid fa-chevron-left text-xs"></i></button>
    ${pages.map((p) => p === '...'
      ? `<span class="w-9 h-9 flex items-center justify-center text-slate-500">…</span>`
      : `<button ${onPageAttr}="${p}" class="page-btn w-9 h-9 rounded-lg text-sm font-semibold ${p === currentPage ? 'bg-brand-500 text-white' : 'glass text-slate-300 hover:bg-white/10'}">${toBnDigits(p)}</button>`
    ).join('')}
    <button ${onPageAttr}="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''} class="page-btn w-9 h-9 rounded-lg glass flex items-center justify-center text-sm disabled:opacity-30"><i class="fa-solid fa-chevron-right text-xs"></i></button>
  </div>`
}

// ---------- Modal ----------
function openModal(innerHtml, { maxWidth = 'max-w-lg' } = {}) {
  closeModal()
  const backdrop = document.createElement('div')
  backdrop.id = 'app-modal'
  backdrop.className = 'modal-backdrop fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'
  backdrop.innerHTML = `<div class="modal-panel glass-strong rounded-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto">${innerHtml}</div>`
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal() })
  document.body.appendChild(backdrop)
  initPageEffects(backdrop)
  return backdrop
}
function closeModal() {
  qs('#app-modal')?.remove()
}

function confirmDialog(title, message, confirmLabel = 'নিশ্চিত করুন', danger = false) {
  return new Promise((resolve) => {
    const modal = openModal(`
      <div class="p-6">
        <div class="w-14 h-14 rounded-full ${danger ? 'bg-rose-500/15' : 'bg-brand-500/15'} flex items-center justify-center mb-4">
          <i class="fa-solid ${danger ? 'fa-triangle-exclamation text-rose-400' : 'fa-circle-question text-brand-400'} text-xl"></i>
        </div>
        <h3 class="font-bold text-lg mb-2">${escapeHtml(title)}</h3>
        <p class="text-slate-400 text-sm mb-6">${escapeHtml(message)}</p>
        <div class="flex gap-3">
          <button id="confirm-cancel" class="flex-1 btn-glow py-2.5 rounded-xl glass font-semibold text-sm">বাতিল</button>
          <button id="confirm-ok" class="flex-1 btn-glow py-2.5 rounded-xl ${danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-brand-500 hover:bg-brand-600'} font-semibold text-sm">${confirmLabel}</button>
        </div>
      </div>`, { maxWidth: 'max-w-sm' })
    qs('#confirm-cancel', modal).onclick = () => { closeModal(); resolve(false) }
    qs('#confirm-ok', modal).onclick = () => { closeModal(); resolve(true) }
  })
}

function promptDialog(title, label, danger = false) {
  return new Promise((resolve) => {
    const modal = openModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-4">${escapeHtml(title)}</h3>
        <textarea id="prompt-input" rows="3" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" placeholder="${escapeHtml(label)}"></textarea>
        <div class="flex gap-3 mt-4">
          <button id="prompt-cancel" class="flex-1 btn-glow py-2.5 rounded-xl glass font-semibold text-sm">বাতিল</button>
          <button id="prompt-ok" class="flex-1 btn-glow py-2.5 rounded-xl ${danger ? 'bg-rose-500' : 'bg-brand-500'} font-semibold text-sm">নিশ্চিত করুন</button>
        </div>
      </div>`, { maxWidth: 'max-w-md' })
    qs('#prompt-cancel', modal).onclick = () => { closeModal(); resolve(null) }
    qs('#prompt-ok', modal).onclick = () => { closeModal(); resolve(qs('#prompt-input', modal).value) }
  })
}

// ---------- Dynamic form field renderer (drives every service's order form) ----------
// NOTE: field.name (the raw admin-defined key, possibly containing spaces or
// slashes) is always used as the actual `name`/form_data key so submitted
// data keeps the exact key the admin configured. For DOM ids/classes we use
// fieldDomId() to derive a CSS-selector-safe token, since raw names with
// spaces or "/" break querySelector (e.g. "#dropzone-Father/Mother Docs").
function renderFormField(field) {
  const req = field.required ? '<span class="text-rose-400">*</span>' : ''
  const domId = fieldDomId(field.name)
  const common = `id="field-${domId}" name="${escapeHtml(field.name)}" data-field-name="${escapeHtml(field.name)}" ${field.required ? 'required' : ''} class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow placeholder:text-slate-500"`
  let inputHtml = ''
  switch (field.type) {
    case 'textarea':
      inputHtml = `<textarea ${common} rows="4" placeholder="${escapeHtml(field.placeholder || '')}"></textarea>`
      break
    case 'select':
      inputHtml = `<select ${common}><option value="">নির্বাচন করুন</option>${(field.options || []).map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}</select>`
      break
    case 'date':
      inputHtml = `<input type="date" ${common} />`
      break
    case 'number':
      inputHtml = `<input type="number" ${common} placeholder="${escapeHtml(field.placeholder || '')}" />`
      break
    case 'file':
      inputHtml = `
        <label for="field-${domId}" class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-xl px-4 py-6 cursor-pointer hover:border-brand-400/50 hover:bg-white/[0.02] transition-colors" id="dropzone-${domId}">
          <i class="fa-solid fa-cloud-arrow-up text-2xl text-slate-500"></i>
          <span class="text-xs text-slate-400 text-center file-label-${domId}">ফাইল নির্বাচন করুন অথবা এখানে টেনে আনুন</span>
        </label>
        <input type="file" id="field-${domId}" name="${escapeHtml(field.name)}" data-field-name="${escapeHtml(field.name)}" ${field.required ? 'required' : ''} accept="${field.accept || '*'}" class="hidden" />`
      break
    default:
      inputHtml = `<input type="text" ${common} placeholder="${escapeHtml(field.placeholder || '')}" />`
  }
  return `
  <div class="form-field" data-field-type="${field.type}" data-field-name="${escapeHtml(field.name)}">
    <label class="block text-sm font-medium text-slate-300 mb-2">${escapeHtml(field.label_bn)} ${req}</label>
    ${inputHtml}
  </div>`
}

function bindFileDropzones(container) {
  qsa('input[type=file]', container).forEach((input) => {
    const domId = fieldDomId(input.dataset.fieldName || input.name)
    input.addEventListener('change', () => {
      const label = qs(`.file-label-${domId}`, container)
      if (label && input.files[0]) label.textContent = input.files[0].name
    })
    const dz = qs(`#dropzone-${domId}`, container)
    if (!dz) return
    ;['dragover', 'dragleave', 'drop'].forEach((evt) => {
      dz.addEventListener(evt, (e) => e.preventDefault())
    })
    dz.addEventListener('dragover', () => dz.classList.add('border-brand-400'))
    dz.addEventListener('dragleave', () => dz.classList.remove('border-brand-400'))
    dz.addEventListener('drop', (e) => {
      dz.classList.remove('border-brand-400')
      if (e.dataTransfer.files[0]) {
        input.files = e.dataTransfer.files
        input.dispatchEvent(new Event('change'))
      }
    })
  })
}

// ---------- Captcha widget ----------
async function loadCaptcha(container) {
  container.innerHTML = `<div class="glass rounded-xl p-4 flex items-center gap-3"><i class="fa-solid fa-spinner fa-spin text-brand-400"></i><span class="text-sm text-slate-400">ক্যাপচা লোড হচ্ছে...</span></div>`
  try {
    const res = await API.get('/captcha')
    container.dataset.token = res.token
    container.innerHTML = `
      <div class="glass rounded-xl p-4">
        <label class="block text-sm font-medium text-slate-300 mb-2">
          <i class="fa-solid fa-shield-halved text-brand-400 mr-1"></i> নিরাপত্তা যাচাই: <span class="text-brand-400 font-bold">${res.question}</span>
        </label>
        <div class="flex gap-2">
          <input type="text" id="captcha-answer-input" placeholder="উত্তর লিখুন" class="flex-1 glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          <button type="button" id="captcha-refresh" class="w-11 h-11 rounded-xl glass flex items-center justify-center hover:text-brand-400 btn-glow"><i class="fa-solid fa-rotate"></i></button>
        </div>
      </div>`
    qs('#captcha-refresh', container).addEventListener('click', () => loadCaptcha(container))
  } catch {
    container.innerHTML = `<div class="text-rose-400 text-sm">ক্যাপচা লোড করা যায়নি</div>`
  }
}

// ---------- Auth storage ----------
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('df_user') || 'null') } catch { return null }
}
function setStoredUser(user) {
  localStorage.setItem('df_user', JSON.stringify(user))
}
