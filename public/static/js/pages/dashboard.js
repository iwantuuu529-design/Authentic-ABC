// ============================================================
// User Dashboard Home — bento stats, usage ring, recent activity
// ============================================================

async function renderDashboardHome() {
  const user = getStoredUser()
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">স্বাগতম, ${escapeHtml(user?.name || '')} 👋</h1>
      <p class="text-slate-400 text-sm mt-1">আপনার অ্যাকাউন্টের সার্বিক অবস্থা দেখুন</p>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${Array(4).fill(0).map(() => skeletonCard('h-32')).join('')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        ${skeletonCard('h-80')}
      </div>
      <div>${skeletonCard('h-80')}</div>
    </div>`

  let data
  try {
    data = await API.get('/dashboard/summary')
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'তথ্য লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const stats = data.order_stats || {}
  const usagePct = data.usage_percent || 0
  const ringCirc = 2 * Math.PI * 42
  const ringOffset = ringCirc - (usagePct / 100) * ringCirc

  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">স্বাগতম, ${escapeHtml(user?.name || '')} 👋</h1>
        <p class="text-slate-400 text-sm mt-1">আপনার অ্যাকাউন্টের সার্বিক অবস্থা দেখুন</p>
      </div>
      <a href="/dashboard/services" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2">
        <i class="fa-solid fa-plus"></i> নতুন অর্ডার
      </a>
    </div>

    <!-- Bento stat grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${statCard({ icon: 'fa-wallet', label: 'বর্তমান ব্যালেন্স', value: '', sub: 'ওয়ালেটে রিচার্জ করুন', gradient: 'from-brand-400 to-brand-600', id: 'stat-balance' })}
      ${statCard({ icon: 'fa-money-bill-trend-up', label: 'মোট রিচার্জ', value: '', gradient: 'from-sky-400 to-sky-600', id: 'stat-recharge' })}
      ${statCard({ icon: 'fa-receipt', label: 'মোট খরচ', value: '', gradient: 'from-violet-400 to-violet-600', id: 'stat-spent' })}
      ${statCard({ icon: 'fa-box-open', label: 'মোট অর্ডার', value: '', gradient: 'from-amber-400 to-amber-600', id: 'stat-orders' })}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Orders -->
      <div class="lg:col-span-2 glass rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold">সাম্প্রতিক অর্ডার</h3>
          <a href="/dashboard/orders" data-link class="text-xs font-semibold text-brand-400 hover:underline">সব দেখুন</a>
        </div>
        <div id="recent-orders-list" class="space-y-2">
          ${data.recent_orders && data.recent_orders.length ? data.recent_orders.map((o) => `
            <a href="/dashboard/orders/${o.id}" data-link class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div class="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                <i class="fa-solid ${o.service_icon || 'fa-file-lines'} text-brand-400"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">${escapeHtml(o.service_name)}</p>
                <p class="text-xs text-slate-500">${o.order_no} • ${timeAgo(o.created_at)}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-bold">${formatMoney(o.price)}</p>
                ${statusBadge(o.status)}
              </div>
            </a>`).join('') : emptyState('fa-inbox', 'কোনো অর্ডার নেই', 'আপনার প্রথম সার্ভিস অর্ডার করুন', `<a href="/dashboard/services" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সার্ভিস দেখুন</a>`)}
        </div>
      </div>

      <!-- Usage ring + recent transactions -->
      <div class="space-y-6">
        <div class="glass rounded-2xl p-5 text-center">
          <h3 class="font-bold mb-4 text-left">ব্যবহারের হার</h3>
          <div class="relative inline-flex items-center justify-center">
            <svg width="110" height="110" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke-width="8" class="ring-track"></circle>
              <circle id="usage-ring" cx="50" cy="50" r="42" fill="none" stroke-width="8" class="ring-progress" stroke="url(#ringGrad)"
                stroke-dasharray="${ringCirc}" stroke-dashoffset="${ringCirc}" transform="rotate(-90 50 50)"></circle>
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#3ed49c" />
                  <stop offset="100%" stop-color="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <span class="absolute text-xl font-extrabold">${toBnDigits(usagePct)}%</span>
          </div>
          <p class="text-xs text-slate-400 mt-3">রিচার্জের তুলনায় খরচের হার</p>
        </div>

        <div class="glass rounded-2xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-sm">অর্ডার সারাংশ</h3>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-brand-500/10 rounded-xl py-3">
              <p class="text-lg font-extrabold text-brand-400">${toBnDigits(stats.completed || 0)}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">সম্পন্ন</p>
            </div>
            <div class="bg-amber-500/10 rounded-xl py-3">
              <p class="text-lg font-extrabold text-amber-400">${toBnDigits(stats.pending || 0)}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">পেন্ডিং</p>
            </div>
            <div class="bg-rose-500/10 rounded-xl py-3">
              <p class="text-lg font-extrabold text-rose-400">${toBnDigits(stats.failed || 0)}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">ব্যর্থ</p>
            </div>
          </div>
        </div>

        <div class="glass rounded-2xl p-5">
          <h3 class="font-bold text-sm mb-3">সাম্প্রতিক লেনদেন</h3>
          <div class="space-y-2.5">
            ${data.recent_transactions && data.recent_transactions.length ? data.recent_transactions.map((t) => `
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <i class="fa-solid ${t.amount > 0 ? 'fa-arrow-down text-brand-400' : 'fa-arrow-up text-rose-400'}"></i>
                  <span class="text-slate-400 truncate">${escapeHtml(t.description || t.type)}</span>
                </div>
                <span class="font-bold ${t.amount > 0 ? 'text-brand-400' : 'text-rose-400'} shrink-0">${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)}</span>
              </div>`).join('') : `<p class="text-xs text-slate-500 text-center py-4">কোনো লেনদেন নেই</p>`}
          </div>
        </div>
      </div>
    </div>
  `

  // Animate stat numbers
  animateCount(qs('#stat-balance'), data.balance || 0, 900, (n) => formatMoney(n))
  animateCount(qs('#stat-recharge'), data.total_recharge || 0, 900, (n) => formatMoney(n))
  animateCount(qs('#stat-spent'), data.total_spent || 0, 900, (n) => formatMoney(n))
  animateCount(qs('#stat-orders'), stats.total || 0, 900, (n) => toBnDigits(Math.round(n)))

  // Animate usage ring
  requestAnimationFrame(() => {
    const ring = qs('#usage-ring')
    if (ring) ring.style.strokeDashoffset = String(ringOffset)
  })
}
