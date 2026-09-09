// ============================================================
// Admin Panel — dashboard, orders, recharge, services, providers,
// users, coupons, support, settings
// ============================================================

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'টেক্সট' },
  { value: 'number', label: 'নম্বর' },
  { value: 'textarea', label: 'টেক্সটএরিয়া' },
  { value: 'select', label: 'সিলেক্ট (ড্রপডাউন)' },
  { value: 'date', label: 'তারিখ' },
  { value: 'file', label: 'ফাইল আপলোড' },
]

const FULFILLMENT_MODE_LABELS = {
  auto: { label: 'অটো সার্ভিস (তাত্ক্ষণিক)', color: 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30' },
  manual: { label: 'ম্যানুয়াল', color: 'text-amber-400 bg-amber-500/10' },
  api: { label: 'অটো (API)', color: 'text-brand-400 bg-brand-500/10' },
  hybrid: { label: 'হাইব্রিড', color: 'text-violet-400 bg-violet-500/10' },
}

const AUTH_TYPE_OPTIONS = ['header', 'query', 'bearer', 'basic', 'none']
const HTTP_METHOD_OPTIONS = ['GET', 'POST']

function adminSectionHeader(title, subtitle, actionHtml = '') {
  return `
  <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-extrabold">${title}</h1>
      ${subtitle ? `<p class="text-slate-400 text-sm mt-1">${subtitle}</p>` : ''}
    </div>
    ${actionHtml}
  </div>`
}

function adminTableWrap(innerHtml) {
  return `<div class="glass rounded-2xl overflow-hidden"><div class="overflow-x-auto">${innerHtml}</div></div>`
}

// ------------------------------------------------------------
// 1. Admin Dashboard — overview stats, revenue chart, top services, recent orders
// ------------------------------------------------------------
let _adminCharts = {}
function destroyAdminCharts() {
  Object.values(_adminCharts).forEach((c) => { try { c.destroy() } catch {} })
  _adminCharts = {}
}

async function renderAdminDashboard() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin', true)}</div>`
  bindShellEvents()
  destroyAdminCharts()

  const content = qs('#page-content')
  content.innerHTML = `
    ${adminSectionHeader('এডমিন ওভারভিউ', 'পুরো প্ল্যাটফর্মের সার্বিক পরিসংখ্যান')}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${Array(8).fill(0).map(() => skeletonCard('h-28')).join('')}
    </div>
  `

  let data
  try {
    data = await AdminService.dashboard.stats()
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'তথ্য লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const s = data.stats || {}
  const daily = data.daily_revenue || []
  const topServices = data.top_services || []
  const recentOrders = data.recent_orders || []

  content.innerHTML = `
    ${adminSectionHeader('এডমিন ওভারভিউ', 'পুরো প্ল্যাটফর্মের সার্বিক পরিসংখ্যান')}

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${statCard({ icon: 'fa-users', label: 'মোট ইউজার', value: '', gradient: 'from-brand-400 to-brand-600', id: 'ad-total-users' })}
      ${statCard({ icon: 'fa-user-check', label: 'সক্রিয় ইউজার', value: '', gradient: 'from-sky-400 to-sky-600', id: 'ad-active-users' })}
      ${statCard({ icon: 'fa-sack-dollar', label: 'মোট আয়', value: '', gradient: 'from-violet-400 to-violet-600', id: 'ad-total-revenue' })}
      ${statCard({ icon: 'fa-chart-line', label: 'আজকের আয়', value: '', gradient: 'from-amber-400 to-amber-600', id: 'ad-today-revenue' })}
      ${statCard({ icon: 'fa-hourglass-half', label: 'পেন্ডিং অর্ডার', value: toBnDigits(s.pending_orders || 0), gradient: 'from-rose-400 to-rose-600' })}
      ${statCard({ icon: 'fa-money-bill-transfer', label: 'পেন্ডিং রিচার্জ', value: toBnDigits(s.pending_recharge_count || 0), sub: formatMoney(s.pending_recharge_amount || 0), gradient: 'from-pink-400 to-pink-600' })}
      ${statCard({ icon: 'fa-wallet', label: 'ওয়ালেট দায় (Liability)', value: '', gradient: 'from-teal-400 to-teal-600', id: 'ad-wallet-liability' })}
      ${statCard({ icon: 'fa-headset', label: 'ওপেন টিকেট', value: toBnDigits(s.open_tickets || 0), gradient: 'from-indigo-400 to-indigo-600' })}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2 glass rounded-2xl p-6">
        <h3 class="font-bold mb-4"><i class="fa-solid fa-chart-area text-brand-400 mr-2"></i>দৈনিক আয়ের ধারা (১৪ দিন)</h3>
        ${daily.length ? `<canvas id="chart-admin-revenue" height="230"></canvas>` : `<p class="text-sm text-slate-500 text-center py-16">কোনো আয়ের তথ্য নেই</p>`}
      </div>
      <div class="glass rounded-2xl p-6">
        <h3 class="font-bold mb-4"><i class="fa-solid fa-trophy text-amber-400 mr-2"></i>টপ সার্ভিস</h3>
        <div class="space-y-3">
          ${topServices.length ? topServices.map((sv, i) => `
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">${toBnDigits(i + 1)}</div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">${escapeHtml(sv.name_bn)}</p>
                <p class="text-[11px] text-slate-500">${toBnDigits(sv.total_orders || 0)}টি অর্ডার • ${toBnDigits(sv.success_orders || 0)}টি সফল</p>
              </div>
              <p class="text-xs font-bold text-brand-400 shrink-0">${formatMoney(sv.revenue || 0)}</p>
            </div>`).join('') : `<p class="text-sm text-slate-500">কোনো সার্ভিস অর্ডার হয়নি</p>`}
        </div>
      </div>
    </div>

    <div class="glass rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold"><i class="fa-solid fa-receipt text-sky-400 mr-2"></i>সাম্প্রতিক অর্ডার</h3>
        <a href="/admin/orders" data-link class="text-xs text-brand-400 hover:underline">সব দেখুন →</a>
      </div>
      ${recentOrders.length ? adminTableWrap(`
        <table class="w-full text-sm">
          <thead><tr class="border-b border-white/5 text-slate-400 text-xs">
            <th class="text-left px-4 py-3 font-medium">অর্ডার নং</th>
            <th class="text-left px-4 py-3 font-medium">ইউজার</th>
            <th class="text-left px-4 py-3 font-medium">সার্ভিস</th>
            <th class="text-left px-4 py-3 font-medium">মূল্য</th>
            <th class="text-left px-4 py-3 font-medium">অবস্থা</th>
            <th class="text-left px-4 py-3 font-medium">সময়</th>
          </tr></thead>
          <tbody>
            ${recentOrders.map((o) => `
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer" onclick="navigate('/admin/orders/${o.id}')">
                <td class="px-4 py-3 font-mono text-xs">${o.order_no}</td>
                <td class="px-4 py-3">${escapeHtml(o.user_name)}</td>
                <td class="px-4 py-3">${escapeHtml(o.service_name)}</td>
                <td class="px-4 py-3 font-bold">${formatMoney(o.price)}</td>
                <td class="px-4 py-3">${statusBadge(o.status)}</td>
                <td class="px-4 py-3 text-xs text-slate-400">${timeAgo(o.created_at)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`) : emptyState('fa-inbox', 'কোনো অর্ডার নেই', 'এখনো কোনো অর্ডার আসেনি।')}
    </div>
  `

  animateCount(qs('#ad-total-users'), s.total_users || 0, 800, (n) => toBnDigits(Math.round(n)))
  animateCount(qs('#ad-active-users'), s.active_users || 0, 800, (n) => toBnDigits(Math.round(n)))
  animateCount(qs('#ad-total-revenue'), s.total_revenue || 0, 900, (n) => formatMoney(n))
  animateCount(qs('#ad-today-revenue'), s.today_revenue || 0, 900, (n) => formatMoney(n))
  animateCount(qs('#ad-wallet-liability'), s.total_wallet_liability || 0, 900, (n) => formatMoney(n))

  await loadChartJs()
  Chart.defaults.color = '#94a3b8'
  Chart.defaults.font.family = "'Hind Siliguri', 'Manrope', sans-serif"
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'

  if (daily.length && qs('#chart-admin-revenue')) {
    const ctx = qs('#chart-admin-revenue').getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 0, 230)
    gradient.addColorStop(0, 'rgba(139,92,246,0.35)')
    gradient.addColorStop(1, 'rgba(139,92,246,0)')
    _adminCharts.revenue = new Chart(ctx, {
      type: 'line',
      data: {
        labels: daily.map((d) => dayjs(d.day).format('DD MMM')),
        datasets: [{
          label: 'আয় (৳)',
          data: daily.map((d) => d.total),
          borderColor: '#8b5cf6',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#0a0e14',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => '৳' + c.parsed.y.toLocaleString() } } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } },
        },
      },
    })
  }
}

// ------------------------------------------------------------
// 2. Admin Orders — list (filter/search/pagination) + detail (approve/reject/note)
// ------------------------------------------------------------
async function renderAdminOrders() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/orders', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  let activeStatus = ''
  let currentPage = 1
  let searchQuery = ''

  content.innerHTML = `
    ${adminSectionHeader('অর্ডার ম্যানেজমেন্ট', 'সকল ইউজারের অর্ডার দেখুন ও প্রসেস করুন')}
    <div class="flex flex-wrap gap-3 mb-5 items-center justify-between">
      <div class="flex flex-wrap gap-2" id="admin-order-filters">
        ${ORDER_STATUS_FILTERS.map((s) => `<button data-status="${s.key}" class="status-filter-btn btn-glow px-4 py-2 rounded-full text-xs font-semibold ${s.key === '' ? 'bg-brand-500 text-white' : 'glass text-slate-300'}">${s.label}</button>`).join('')}
      </div>
      <div class="glass rounded-xl px-3 py-2 flex items-center gap-2 w-full sm:w-72">
        <i class="fa-solid fa-magnifying-glass text-slate-500 text-sm"></i>
        <input id="admin-order-search" type="text" placeholder="অর্ডার নং, নাম বা ফোন খুঁজুন..." class="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
      </div>
    </div>
    <div id="admin-orders-list">${Array(6).fill(0).map(() => skeletonCard('h-16')).join('')}</div>
    <div id="admin-orders-pagination"></div>
  `

  async function loadOrders() {
    const listEl = qs('#admin-orders-list')
    const pagEl = qs('#admin-orders-pagination')
    listEl.innerHTML = Array(6).fill(0).map(() => skeletonCard('h-16')).join('')
    pagEl.innerHTML = ''

    let data
    try {
      data = await AdminService.orders.list({ status: activeStatus, q: searchQuery, page: currentPage })
    } catch (err) {
      listEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }

    const list = data.orders || []
    if (!list.length) {
      listEl.innerHTML = emptyState('fa-inbox', 'কোনো অর্ডার নেই', 'এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।')
      return
    }

    listEl.innerHTML = adminTableWrap(`
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/5 text-slate-400 text-xs">
          <th class="text-left px-4 py-3 font-medium">অর্ডার নং</th>
          <th class="text-left px-4 py-3 font-medium">ইউজার</th>
          <th class="text-left px-4 py-3 font-medium">সার্ভিস</th>
          <th class="text-left px-4 py-3 font-medium">মূল্য</th>
          <th class="text-left px-4 py-3 font-medium">মোড</th>
          <th class="text-left px-4 py-3 font-medium">অবস্থা</th>
          <th class="text-left px-4 py-3 font-medium">সময়</th>
          <th class="text-left px-4 py-3 font-medium"></th>
        </tr></thead>
        <tbody>
          ${list.map((o) => `
            <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 font-mono text-xs">${o.order_no}</td>
              <td class="px-4 py-3">
                <p class="font-medium">${escapeHtml(o.user_name)}</p>
                <p class="text-[11px] text-slate-500">${escapeHtml(o.user_phone)}</p>
              </td>
              <td class="px-4 py-3">
                <i class="fa-solid ${o.service_icon || 'fa-file-lines'} text-brand-400 mr-1.5"></i>${escapeHtml(o.service_name)}
              </td>
              <td class="px-4 py-3 font-bold">${formatMoney(o.price)}</td>
              <td class="px-4 py-3"><span class="text-[11px] px-2 py-0.5 rounded-full ${(FULFILLMENT_MODE_LABELS[o.fulfillment_mode] || {}).color || 'text-slate-400 bg-white/5'}">${(FULFILLMENT_MODE_LABELS[o.fulfillment_mode] || {}).label || o.fulfillment_mode}</span></td>
              <td class="px-4 py-3">${statusBadge(o.status)}</td>
              <td class="px-4 py-3 text-xs text-slate-400">${timeAgo(o.created_at)}</td>
              <td class="px-4 py-3"><a href="/admin/orders/${o.id}" data-link class="text-brand-400 hover:underline text-xs font-semibold">বিস্তারিত →</a></td>
            </tr>`).join('')}
        </tbody>
      </table>`)

    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20)))
    pagEl.innerHTML = pagination(currentPage, totalPages, 'data-page')
    qsa('.page-btn', pagEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10)
        if (!p || p < 1 || p > totalPages) return
        currentPage = p
        loadOrders()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    })
  }

  qsa('.status-filter-btn', qs('#admin-order-filters')).forEach((btn) => {
    btn.addEventListener('click', () => {
      activeStatus = btn.dataset.status
      currentPage = 1
      qsa('.status-filter-btn', qs('#admin-order-filters')).forEach((b) => {
        b.classList.remove('bg-brand-500', 'text-white')
        b.classList.add('glass', 'text-slate-300')
      })
      btn.classList.remove('glass', 'text-slate-300')
      btn.classList.add('bg-brand-500', 'text-white')
      loadOrders()
    })
  })

  qs('#admin-order-search').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.trim()
    currentPage = 1
    loadOrders()
  }, 400))

  loadOrders()
}

async function renderAdminOrderDetail(params) {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/orders', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `<div class="max-w-5xl mx-auto space-y-6">${skeletonCard('h-32')}${skeletonCard('h-64')}</div>`

  async function load() {
    let data
    try {
      data = await AdminService.orders.get(params.id)
    } catch (err) {
      content.innerHTML = emptyState('fa-triangle-exclamation', 'অর্ডার পাওয়া যায়নি', getErrorMessage(err), `<a href="/admin/orders" data-link class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সব অর্ডার</a>`)
      return
    }

    const order = data.order
    const logs = data.logs || []
    const formEntries = Object.entries(order.form_data || {}).filter(([k]) => k !== 'captcha_token' && k !== 'captcha_answer')
    // Map field name -> schema type so uploaded documents (NID scans, photos,
    // etc.) render as a downloadable/viewable link instead of a raw R2 object
    // key string. Without this, the admin could see the file name but had no
    // way to actually open the user's uploaded document.
    const fieldTypeByName = {}
    ;(order.form_schema || []).forEach((f) => { fieldTypeByName[f.name] = f.type })
    const canAct = !['completed', 'rejected', 'refunded'].includes(order.status)

    // BDRIS interactive lookup: admin can solve the pending captcha here
    let bdrisPending = false
    try {
      const raw = order.api_raw_response ? JSON.parse(order.api_raw_response) : null
      bdrisPending = Boolean(order.status === 'processing' && raw?.bdris?.session_id && raw?.bdris?.captcha_url && !raw?.bdris?.failed)
    } catch {}

    content.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6">
        <a href="/admin/orders" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5"><i class="fa-solid fa-arrow-left"></i> সব অর্ডার</a>

        <div class="glass rounded-2xl p-6 flex flex-wrap items-center gap-4 justify-between">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400/20 to-violet-500/20 flex items-center justify-center shrink-0">
              <i class="fa-solid fa-file-lines text-brand-400 text-xl"></i>
            </div>
            <div>
              <h1 class="text-lg font-extrabold">${escapeHtml(order.service_name)}</h1>
              <p class="text-slate-400 text-xs mt-0.5">${order.order_no} • ${escapeHtml(order.user_name)} (${escapeHtml(order.user_phone)}) • ${formatDate(order.created_at)}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xl font-extrabold text-brand-400">${formatMoney(order.price)}</span>
            ${statusBadge(order.status)}
          </div>
        </div>

        ${canAct ? `
        <div class="glass rounded-2xl p-6 flex flex-wrap gap-3">
          <button id="ao-approve-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-circle-check"></i> সম্পন্ন করুন</button>
          <button id="ao-reject-btn" class="btn-glow bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-circle-xmark"></i> বাতিল করুন</button>
          <button id="ao-note-btn" class="btn-glow glass text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-note-sticky"></i> নোট যোগ করুন</button>
        </div>` : ''}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="glass rounded-2xl p-6">
              <h3 class="font-bold mb-4"><i class="fa-solid fa-file-lines text-brand-400 mr-2"></i>জমাকৃত তথ্য</h3>
              ${formEntries.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  ${formEntries.map(([k, v]) => {
                    const isFile = fieldTypeByName[k] === 'file' && v
                    return `
                    <div>
                      <p class="text-xs text-slate-500 mb-1">${escapeHtml(prettifyFieldName(k))}</p>
                      ${isFile
                        ? `<a href="/api/admin/orders/${order.id}/upload/${encodeURIComponent(k)}" target="_blank" class="btn-glow inline-flex items-center gap-2 bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30 text-xs font-semibold px-3 py-2 rounded-lg"><i class="fa-solid fa-file-arrow-down"></i> ইউজারের আপলোড করা ডকুমেন্ট দেখুন/ডাউনলোড করুন</a>`
                        : `<p class="text-sm font-medium break-words">${escapeHtml(String(v ?? '-')) || '-'}</p>`}
                    </div>`
                  }).join('')}
                </div>` : `<p class="text-sm text-slate-500">কোনো তথ্য পাওয়া যায়নি।</p>`}
            </div>

            ${bdrisPending ? `
            <div class="glass rounded-2xl p-6 bg-violet-500/5 border-violet-500/20">
              <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h3 class="font-bold"><i class="fa-solid fa-shield-halved text-violet-400 mr-2"></i>BDRIS ক্যাপচা সমাধান করুন</h3>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">ইউজারের পক্ষে যাচাই</span>
              </div>
              <p class="text-xs text-slate-400 mb-4">কাস্টমার ক্যাপচা পূরণ না করলে আপনি এখানে কোড লিখে যাচাই সম্পন্ন করতে পারেন।</p>
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div class="relative shrink-0 self-center">
                  <img id="ab-captcha-img" src="${AdminService.orders.bdrisCaptchaUrl(order.id)}" alt="ক্যাপচা"
                       class="h-16 min-w-[170px] rounded-xl ring-1 ring-white/15 bg-white object-contain" />
                  <button id="ab-captcha-refresh" type="button" title="নতুন ক্যাপচা"
                          class="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-violet-500 hover:bg-violet-600 text-white text-xs flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <i class="fa-solid fa-rotate"></i>
                  </button>
                </div>
                <div class="flex-1 flex flex-col sm:flex-row gap-2">
                  <input id="ab-captcha-input" type="text" inputmode="numeric" autocomplete="off" placeholder="ক্যাপচা কোড লিখুন"
                         class="flex-1 glass rounded-xl px-4 py-3 text-sm outline-none input-glow placeholder:text-slate-500 tracking-widest" />
                  <button id="ab-captcha-submit" type="button"
                          class="btn-glow bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold px-6 py-3 rounded-xl whitespace-nowrap">
                    <i class="fa-solid fa-check mr-1.5"></i>যাচাই করুন
                  </button>
                </div>
              </div>
              <p id="ab-captcha-msg" class="text-xs mt-3 hidden"></p>
            </div>` : ''}

            ${order.status === 'completed' ? `
            <div class="glass rounded-2xl p-6 bg-brand-500/5 border-brand-500/10">
              <h3 class="font-bold mb-4"><i class="fa-solid fa-circle-check text-brand-400 mr-2"></i>ফলাফল</h3>
              ${order.result_file_key ? `<a href="/api/orders/${order.id}/result-file" target="_blank" class="btn-glow inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl mb-3"><i class="fa-solid fa-download"></i> ফলাফল ফাইল</a>` : ''}
              ${order.result_data ? `<p class="text-sm whitespace-pre-wrap">${escapeHtml(typeof order.result_data === 'string' ? order.result_data : JSON.stringify(order.result_data))}</p>` : ''}
            </div>` : ''}

            ${order.admin_note ? `
            <div class="glass rounded-2xl p-6 bg-amber-500/5 border-amber-500/10">
              <h3 class="font-bold mb-2 text-sm"><i class="fa-solid fa-comment-dots text-amber-400 mr-2"></i>এডমিন নোট</h3>
              <p class="text-sm text-slate-300">${escapeHtml(order.admin_note)}</p>
            </div>` : ''}
          </div>

          <div class="glass rounded-2xl p-6">
            <h3 class="font-bold mb-5 text-sm"><i class="fa-solid fa-timeline text-brand-400 mr-2"></i>টাইমলাইন</h3>
            <div class="relative pl-2">
              ${logs.map((l, i) => {
                const meta = ORDER_LOG_ICON[l.action] || { icon: 'fa-circle-dot', color: 'text-slate-400 bg-white/5' }
                const isLast = i === logs.length - 1
                return `
                <div class="relative pl-8 ${isLast ? '' : 'pb-6'}">
                  ${!isLast ? '<div class="absolute left-[15px] top-8 bottom-0 w-px bg-white/10"></div>' : ''}
                  <div class="absolute left-0 top-0 w-8 h-8 rounded-full ${meta.color} flex items-center justify-center"><i class="fa-solid ${meta.icon} text-xs"></i></div>
                  <p class="text-sm font-medium">${escapeHtml(l.note || l.action)}</p>
                  <p class="text-[11px] text-slate-500 mt-0.5">${formatDate(l.created_at)} • ${l.actor_type === 'system' ? 'সিস্টেম' : l.actor_type === 'admin' ? 'এডমিন' : 'ইউজার'}</p>
                </div>`
              }).join('') || `<p class="text-sm text-slate-500">কোনো কার্যক্রম নেই।</p>`}
            </div>
          </div>
        </div>
      </div>
    `

    if (bdrisPending) {
      const abImg = qs('#ab-captcha-img')
      const abInput = qs('#ab-captcha-input')
      const abBtn = qs('#ab-captcha-submit')
      const abMsg = qs('#ab-captcha-msg')
      const abSay = (text, tone) => {
        if (!abMsg) return
        abMsg.textContent = text
        abMsg.className = `text-xs mt-3 ${tone === 'error' ? 'text-rose-400' : 'text-violet-300'}`
      }
      qs('#ab-captcha-refresh')?.addEventListener('click', () => {
        if (abImg) abImg.src = AdminService.orders.bdrisCaptchaUrl(order.id)
        abSay('নতুন ক্যাপচা আনা হচ্ছে…', 'ok')
      })
      abImg?.addEventListener('error', () => abSay('ক্যাপচা ইমেজ লোড হয়নি — রিফ্রেশ বাটনে চাপ দিন।', 'error'))
      async function abSubmit() {
        const code = (abInput?.value || '').trim()
        if (!code) {
          abSay('ক্যাপচা কোডটি লিখুন।', 'error')
          abInput?.focus()
          return
        }
        if (abBtn) {
          abBtn.disabled = true
          abBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>যাচাই হচ্ছে…'
        }
        try {
          await AdminService.orders.verifyBdris(order.id, code)
          showToast('যাচাই সম্পন্ন হয়েছে ✅', 'success')
          load()
          return
        } catch (err) {
          abSay(getErrorMessage(err), 'error')
          if (err && (err.new_captcha || /captcha/i.test(getErrorMessage(err)))) {
            if (abImg) abImg.src = AdminService.orders.bdrisCaptchaUrl(order.id)
          }
          abInput?.select()
        } finally {
          if (abBtn) {
            abBtn.disabled = false
            abBtn.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i>যাচাই করুন'
          }
        }
      }
      abBtn?.addEventListener('click', abSubmit)
      abInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          abSubmit()
        }
      })
    }

    qs('#ao-approve-btn')?.addEventListener('click', () => openOrderApproveModal(order, load))
    qs('#ao-reject-btn')?.addEventListener('click', async () => {
      const reason = await promptDialog('অর্ডার বাতিল করুন', 'বাতিলের কারণ লিখুন (টাকা থাকলে অটো রিফান্ড হবে)', true)
      if (reason === null) return
      try {
        const res = await AdminService.orders.reject(order.id, reason)
        showToast(res.message, 'success')
        load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    })
    qs('#ao-note-btn')?.addEventListener('click', async () => {
      const note = await promptDialog('অভ্যন্তরীণ নোট যোগ করুন', 'নোট লিখুন')
      if (note === null) return
      try {
        const res = await AdminService.orders.setNote(order.id, note)
        showToast(res.message, 'success')
        load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    })
  }

  load()
}

function openOrderApproveModal(order, onDone) {
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-circle-check text-brand-400 mr-2"></i>অর্ডার সম্পন্ন করুন</h3>
      <form id="approve-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">ফলাফল টেক্সট (ঐচ্ছিক)</label>
          <textarea id="ap-result-text" name="result_text" rows="3" placeholder="ফলাফলের বিবরণ লিখুন..." class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">ফলাফল ফাইল (ঐচ্ছিক)</label>
          <label for="ap-result-file" id="ap-file-dz" class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-xl px-4 py-6 cursor-pointer hover:border-brand-400/50 hover:bg-white/[0.02] transition-colors">
            <i class="fa-solid fa-cloud-arrow-up text-2xl text-slate-500"></i>
            <span class="text-xs text-slate-400 text-center" id="ap-file-label">ফাইল আপলোড করুন</span>
          </label>
          <input type="file" id="ap-result-file" name="result_file" class="hidden" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">নোট (ঐচ্ছিক)</label>
          <input type="text" id="ap-note" name="note" placeholder="ইউজারের জন্য নোট" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
        </div>
        <button type="submit" id="ap-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
          <i class="fa-solid fa-circle-check"></i> সম্পন্ন করুন
        </button>
      </form>
    </div>`, { maxWidth: 'max-w-lg' })

  qs('#ap-result-file', modal).addEventListener('change', () => {
    const f = qs('#ap-result-file', modal).files[0]
    if (f) qs('#ap-file-label', modal).textContent = f.name
  })

  qs('#approve-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#ap-submit', modal)
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> প্রসেস হচ্ছে...`
    try {
      const fd = new FormData(qs('#approve-form', modal))
      const res = await AdminService.orders.approve(order.id, fd)
      showToast(res.message, 'success')
      closeModal()
      onDone()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> সম্পন্ন করুন`
    }
  })
}

// ------------------------------------------------------------
// 3. Admin Recharge — pending/approved/rejected list, proof viewer, approve/reject
// ------------------------------------------------------------
async function renderAdminRecharge() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/recharge', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  let activeStatus = 'pending'
  let currentPage = 1

  const statusTabs = [
    { key: 'pending', label: 'পেন্ডিং' },
    { key: 'approved', label: 'অনুমোদিত' },
    { key: 'rejected', label: 'প্রত্যাখ্যাত' },
    { key: 'all', label: 'সব' },
  ]

  content.innerHTML = `
    ${adminSectionHeader('রিচার্জ রিকুয়েস্ট', 'ম্যানুয়াল পেমেন্ট প্রুফ যাচাই ও অনুমোদন করুন')}
    <div class="flex flex-wrap gap-2 mb-6" id="recharge-status-filters">
      ${statusTabs.map((s) => `<button data-status="${s.key}" class="status-filter-btn btn-glow px-4 py-2 rounded-full text-xs font-semibold ${s.key === 'pending' ? 'bg-brand-500 text-white' : 'glass text-slate-300'}">${s.label}</button>`).join('')}
    </div>
    <div id="recharge-list" class="space-y-3">${Array(4).fill(0).map(() => skeletonCard('h-24')).join('')}</div>
    <div id="recharge-pagination"></div>
  `

  async function loadRequests() {
    const listEl = qs('#recharge-list')
    const pagEl = qs('#recharge-pagination')
    listEl.innerHTML = Array(4).fill(0).map(() => skeletonCard('h-24')).join('')
    pagEl.innerHTML = ''

    let data
    try {
      data = await AdminService.recharge.list({ status: activeStatus, page: currentPage })
    } catch (err) {
      listEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }

    const list = data.requests || []
    if (!list.length) {
      listEl.innerHTML = emptyState('fa-money-bill-transfer', 'কোনো রিকুয়েস্ট নেই', 'এই ফিল্টারে কোনো রিচার্জ রিকুয়েস্ট নেই।')
      return
    }

    listEl.innerHTML = list.map((r) => `
      <div class="spot-card glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${(RECHARGE_METHOD_LABELS[r.method] || RECHARGE_METHOD_LABELS.other).color} flex items-center justify-center shrink-0">
          <i class="fa-solid ${(RECHARGE_METHOD_LABELS[r.method] || RECHARGE_METHOD_LABELS.other).icon} text-white"></i>
        </div>
        <div class="flex-1 min-w-[220px]">
          <p class="font-semibold text-sm">${escapeHtml(r.user_name)} <span class="text-slate-500 font-normal">(${escapeHtml(r.user_phone)})</span></p>
          <p class="text-xs text-slate-400 mt-0.5">${r.request_no} • ${formatDate(r.created_at)}</p>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
            <span><i class="fa-solid fa-mobile-screen mr-1 text-slate-500"></i>পাঠানো নম্বর: <b class="text-slate-300">${escapeHtml(r.sender_number || '-')}</b></span>
            <span><i class="fa-brands fa-whatsapp mr-1 text-slate-500"></i>WhatsApp: <b class="text-slate-300">${escapeHtml(r.whatsapp_number || '-')}</b></span>
            <span><i class="fa-solid fa-hashtag mr-1 text-slate-500"></i>TrxID: <b class="text-slate-300">${escapeHtml(r.transaction_id || '-')}</b></span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <p class="font-extrabold text-lg text-brand-400">${formatMoney(r.amount)}</p>
          ${statusBadge(r.status)}
        </div>
        <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          ${r.proof_file_key ? `<button data-proof="${r.id}" class="btn-glow w-10 h-10 rounded-xl glass flex items-center justify-center text-slate-300 hover:text-brand-400"><i class="fa-solid fa-image"></i></button>` : ''}
          ${r.status === 'pending' ? `
            <button data-approve="${r.id}" class="btn-glow flex-1 sm:flex-none bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl"><i class="fa-solid fa-check mr-1"></i>অনুমোদন</button>
            <button data-reject="${r.id}" class="btn-glow flex-1 sm:flex-none bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl"><i class="fa-solid fa-xmark mr-1"></i>বাতিল</button>
          ` : ''}
        </div>
        ${r.admin_note ? `<div class="w-full pt-3 mt-1 border-t border-white/5 text-xs text-slate-400"><i class="fa-solid fa-comment-dots mr-1.5"></i>${escapeHtml(r.admin_note)}</div>` : ''}
      </div>`).join('')

    initPageEffects(listEl)

    qsa('[data-proof]', listEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        openModal(`
          <div class="p-4">
            <img src="/api/admin/recharge-requests/${btn.dataset.proof}/proof" class="w-full rounded-xl" alt="Payment proof" />
          </div>`, { maxWidth: 'max-w-xl' })
      })
    })
    qsa('[data-approve]', listEl).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog('রিচার্জ অনুমোদন করবেন?', 'অনুমোদন করলে সাথে সাথে ইউজারের ওয়ালেটে টাকা যোগ হবে।', 'অনুমোদন করুন')
        if (!ok) return
        try {
          const res = await AdminService.recharge.approve(btn.dataset.approve)
          showToast(res.message, 'success')
          loadRequests()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
        }
      })
    })
    qsa('[data-reject]', listEl).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reason = await promptDialog('রিচার্জ প্রত্যাখ্যান করুন', 'বাতিলের কারণ লিখুন', true)
        if (reason === null) return
        try {
          const res = await AdminService.recharge.reject(btn.dataset.reject, reason)
          showToast(res.message, 'success')
          loadRequests()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
        }
      })
    })

    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20)))
    pagEl.innerHTML = pagination(currentPage, totalPages, 'data-page')
    qsa('.page-btn', pagEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10)
        if (!p || p < 1 || p > totalPages) return
        currentPage = p
        loadRequests()
      })
    })
  }

  qsa('.status-filter-btn', qs('#recharge-status-filters')).forEach((btn) => {
    btn.addEventListener('click', () => {
      activeStatus = btn.dataset.status
      currentPage = 1
      qsa('.status-filter-btn', qs('#recharge-status-filters')).forEach((b) => {
        b.classList.remove('bg-brand-500', 'text-white')
        b.classList.add('glass', 'text-slate-300')
      })
      btn.classList.remove('glass', 'text-slate-300')
      btn.classList.add('bg-brand-500', 'text-white')
      loadRequests()
    })
  })

  loadRequests()
}

// ------------------------------------------------------------
// 4. Admin Services — CRUD table, category management, form_schema builder
// ------------------------------------------------------------
let _adminCategoriesCache = []
let _adminProvidersCache = []

async function renderAdminServices() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/services', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    ${adminSectionHeader('সার্ভিস ম্যানেজমেন্ট', 'সকল সার্ভিস তৈরি, সম্পাদনা ও পরিচালনা করুন', `
      <div class="flex gap-2">
        <button id="manage-categories-btn" class="btn-glow glass text-sm font-bold px-4 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-layer-group"></i> ক্যাটাগরি</button>
        <button id="add-service-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2"><i class="fa-solid fa-plus"></i> নতুন সার্ভিস</button>
      </div>
    `)}
    <div id="services-table">${skeletonCard('h-96')}</div>
  `

  async function loadServices() {
    const tableEl = qs('#services-table')
    tableEl.innerHTML = skeletonCard('h-96')
    let servicesData, catData, provData
    try {
      [servicesData, catData, provData] = await Promise.all([
        AdminService.services.list(),
        AdminService.services.listCategories(),
        AdminService.providers.list(),
      ])
    } catch (err) {
      tableEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    _adminCategoriesCache = catData.categories || []
    _adminProvidersCache = provData.providers || []
    const list = servicesData.services || []

    if (!list.length) {
      tableEl.innerHTML = emptyState('fa-cubes', 'কোনো সার্ভিস নেই', 'নতুন সার্ভিস তৈরি করে শুরু করুন।', `<button id="empty-add-service" class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">নতুন সার্ভিস</button>`)
      qs('#empty-add-service')?.addEventListener('click', () => openServiceFormModal(null, loadServices))
      return
    }

    tableEl.innerHTML = adminTableWrap(`
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/5 text-slate-400 text-xs">
          <th class="text-left px-4 py-3 font-medium">সার্ভিস</th>
          <th class="text-left px-4 py-3 font-medium">ক্যাটাগরি</th>
          <th class="text-left px-4 py-3 font-medium">মূল্য</th>
          <th class="text-left px-4 py-3 font-medium">মোড</th>
          <th class="text-left px-4 py-3 font-medium">অর্ডার</th>
          <th class="text-left px-4 py-3 font-medium">অবস্থা</th>
          <th class="text-left px-4 py-3 font-medium"></th>
        </tr></thead>
        <tbody>
          ${list.map((s) => `
            <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0"><i class="fa-solid ${s.icon || 'fa-file-lines'} text-brand-400 text-sm"></i></div>
                  <div>
                    <p class="font-medium">${escapeHtml(s.name_bn)}</p>
                    <p class="text-[11px] text-slate-500">${s.slug}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-xs">${escapeHtml(s.category_name_bn || '-')}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-sm text-emerald-400">${formatMoney(s.price)}</span>
                  <button data-rate-id="${s.id}" data-rate-name="${escapeHtml(s.name_bn)}" data-rate-price="${s.price}" data-rate-cost="${s.cost_price || 0}" class="btn-glow text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-brand-500/20 text-brand-300 inline-flex items-center gap-1 border border-white/10" title="রেট পরিবর্তন করুন">
                    <i class="fa-solid fa-pen text-[9px]"></i> রেট
                  </button>
                </div>
              </td>
              <td class="px-4 py-3"><span class="text-[11px] px-2 py-0.5 rounded-full ${(FULFILLMENT_MODE_LABELS[s.fulfillment_mode] || {}).color || 'text-slate-400 bg-white/5'}">${(FULFILLMENT_MODE_LABELS[s.fulfillment_mode] || {}).label || s.fulfillment_mode}</span></td>
              <td class="px-4 py-3 text-xs">${toBnDigits(s.total_orders || 0)} <span class="text-slate-500">/ ${toBnDigits(s.success_orders || 0)} সফল</span></td>
              <td class="px-4 py-3">${statusBadge(s.status)}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <button data-edit="${s.id}" class="btn-glow w-8 h-8 rounded-lg glass inline-flex items-center justify-center text-slate-300 hover:text-brand-400"><i class="fa-solid fa-pen text-xs"></i></button>
                <button data-del="${s.id}" class="btn-glow w-8 h-8 rounded-lg glass inline-flex items-center justify-center text-slate-300 hover:text-rose-400"><i class="fa-solid fa-trash text-xs"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`)

    qsa('[data-rate-id]', tableEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        openRateEditorModal(
          btn.dataset.rateId,
          btn.dataset.rateName,
          parseFloat(btn.dataset.ratePrice) || 0,
          parseFloat(btn.dataset.rateCost) || 0,
          loadServices
        )
      })
    })

    qsa('[data-edit]', tableEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const svc = list.find((s) => String(s.id) === btn.dataset.edit)
        openServiceFormModal(svc, loadServices)
      })
    })
    qsa('[data-del]', tableEl).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog('সার্ভিস মুছে ফেলবেন?', 'অর্ডার হিস্ট্রি থাকলে সার্ভিসটি নিষ্ক্রিয় করা হবে, নাহলে সম্পূর্ণ মুছে যাবে।', 'মুছে ফেলুন', true)
        if (!ok) return
        try {
          const res = await AdminService.services.remove(btn.dataset.del)
          showToast(res.message, 'success')
          loadServices()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
        }
      })
    })
  }

  qs('#add-service-btn').addEventListener('click', () => openServiceFormModal(null, loadServices))
  qs('#manage-categories-btn').addEventListener('click', () => openCategoriesModal(loadServices))

  loadServices()
}

function openRateEditorModal(id, name, currentPrice, currentCost, onDone) {
  const modal = openModal(`
    <div class="space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-bold">
            <i class="fa-solid fa-bangladeshi-taka-sign"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white">রেট পরিবর্তন করুন</h3>
            <p class="text-xs text-slate-400">${escapeHtml(name)}</p>
          </div>
        </div>
        <button type="button" class="close-rate-modal w-8 h-8 rounded-lg glass flex items-center justify-center text-slate-400 hover:text-white text-xs">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <form id="quick-rate-form" class="space-y-4 pt-1">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">সার্ভিস ফি / বিক্রয় মূল্য (৳) *</label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
            <input type="number" id="qrf-price" required min="0" step="0.01" value="${currentPrice}" class="w-full glass rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-bold outline-none input-glow border border-white/10" placeholder="0.00" autofocus />
          </div>
          <p class="text-[11px] text-slate-400 mt-1">ইউজার "Create NID" বা অর্ডার করলেই ওয়ালেট থেকে এই রেট অটো কর্তন হবে।</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">কস্ট প্রাইস (৳) (ঐচ্ছিক)</label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
            <input type="number" id="qrf-cost" min="0" step="0.01" value="${currentCost}" class="w-full glass rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-200 outline-none input-glow border border-white/10" placeholder="0.00" />
          </div>
        </div>

        <div class="pt-2 flex items-center gap-3">
          <button type="button" class="close-rate-modal flex-1 py-2.5 rounded-xl glass hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors">
            বাতিল
          </button>
          <button type="submit" id="qrf-submit" class="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-floppy-disk"></i> রেট সেভ করুন
          </button>
        </div>
      </form>
    </div>
  `, { maxWidth: 'max-w-md' })

  qsa('.close-rate-modal', modal).forEach((btn) => btn.addEventListener('click', () => closeModal()))

  qs('#quick-rate-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = qs('#qrf-submit', modal)
    submitBtn.disabled = true
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সেভ হচ্ছে...`

    const price = parseFloat(qs('#qrf-price', modal).value)
    const costPrice = parseFloat(qs('#qrf-cost', modal).value) || 0

    try {
      const res = await AdminService.services.updateRate(id, price, costPrice)
      showToast(res.message || 'রেট সফলভাবে আপডেট হয়েছে!', 'success')
      closeModal()
      if (typeof onDone === 'function') onDone()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      submitBtn.disabled = false
      submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> রেট সেভ করুন`
    }
  })
}

function formFieldBuilderRowHtml(field = {}) {
  const idx = Math.random().toString(36).slice(2, 8)
  return `
  <div class="form-field-row glass rounded-xl p-4 space-y-3" data-row-id="${idx}">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-slate-400">ফিল্ড</span>
      <button type="button" class="remove-field-row text-rose-400 hover:text-rose-300 text-xs"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input type="text" class="ff-name w-full glass rounded-lg px-3 py-2 text-xs outline-none input-glow" placeholder="ফিল্ড নাম (name, ইংরেজিতে)" value="${escapeHtml(field.name || '')}" />
      <input type="text" class="ff-label w-full glass rounded-lg px-3 py-2 text-xs outline-none input-glow" placeholder="লেবেল (বাংলা)" value="${escapeHtml(field.label_bn || '')}" />
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <select class="ff-type w-full glass rounded-lg px-3 py-2 text-xs outline-none input-glow">
        ${FIELD_TYPE_OPTIONS.map((o) => `<option value="${o.value}" ${field.type === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      <input type="text" class="ff-placeholder w-full glass rounded-lg px-3 py-2 text-xs outline-none input-glow" placeholder="প্লেসহোল্ডার" value="${escapeHtml(field.placeholder || '')}" />
      <label class="flex items-center gap-2 text-xs text-slate-300 px-2">
        <input type="checkbox" class="ff-required" ${field.required ? 'checked' : ''} /> আবশ্যক
      </label>
    </div>
    <input type="text" class="ff-options w-full glass rounded-lg px-3 py-2 text-xs outline-none input-glow field-options-input" placeholder="সিলেক্ট অপশন (কমা দিয়ে আলাদা করুন)" value="${escapeHtml((field.options || []).join(', '))}" style="display:${field.type === 'select' ? 'block' : 'none'}" />
  </div>`
}

function bindFormFieldBuilder(container) {
  const list = qs('.field-builder-list', container)
  qs('.add-field-row-btn', container).addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', formFieldBuilderRowHtml())
    bindFieldRowEvents(list)
  })
  bindFieldRowEvents(list)
}

function bindFieldRowEvents(list) {
  qsa('.form-field-row', list).forEach((row) => {
    if (row._bound) return
    row._bound = true
    qs('.remove-field-row', row).addEventListener('click', () => row.remove())
    qs('.ff-type', row).addEventListener('change', (e) => {
      qs('.field-options-input', row).style.display = e.target.value === 'select' ? 'block' : 'none'
    })
  })
}

function collectFormSchema(container) {
  return qsa('.form-field-row', container).map((row) => {
    const type = qs('.ff-type', row).value
    const field = {
      name: qs('.ff-name', row).value.trim(),
      label_bn: qs('.ff-label', row).value.trim(),
      type,
      required: qs('.ff-required', row).checked,
      placeholder: qs('.ff-placeholder', row).value.trim(),
    }
    if (type === 'select') {
      field.options = qs('.ff-options', row).value.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return field
  }).filter((f) => f.name && f.label_bn)
}

function openServiceFormModal(service, onDone) {
  const isEdit = !!service
  const schema = service ? (() => { try { return JSON.parse(service.form_schema || '[]') } catch { return [] } })() : []

  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-cubes text-brand-400 mr-2"></i>${isEdit ? 'সার্ভিস সম্পাদনা' : 'নতুন সার্ভিস তৈরি'}</h3>
      <form id="service-form" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">নাম (বাংলা) *</label>
            <input type="text" id="sf-name-bn" required value="${escapeHtml(service?.name_bn || '')}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">নাম (ইংরেজি) *</label>
            <input type="text" id="sf-name-en" required value="${escapeHtml(service?.name_en || '')}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">স্লাগ (URL) *</label>
            <input type="text" id="sf-slug" required value="${escapeHtml(service?.slug || '')}" ${isEdit ? 'disabled' : ''} class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow disabled:opacity-50" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">আইকন (Font Awesome ক্লাস)</label>
            <input type="text" id="sf-icon" value="${escapeHtml(service?.icon || 'fa-file-lines')}" placeholder="fa-file-lines" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">মূল্য (৳) *</label>
            <input type="number" id="sf-price" required min="0" step="0.01" value="${service?.price ?? ''}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">কস্ট প্রাইস (৳)</label>
            <input type="number" id="sf-cost" min="0" step="0.01" value="${service?.cost_price ?? 0}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">ক্যাটাগরি</label>
            <select id="sf-category" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              <option value="">নির্বাচন করুন</option>
              ${_adminCategoriesCache.map((c) => `<option value="${c.id}" ${service?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name_bn)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">বিবরণ (বাংলা)</label>
          <textarea id="sf-desc" rows="2" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">${escapeHtml(service?.description_bn || '')}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">ফুলফিলমেন্ট মোড *</label>
            <select id="sf-fulfillment" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              <option value="auto" ${service?.fulfillment_mode === 'auto' ? 'selected' : ''}>অটো সার্ভিস (তাত্ক্ষণিক)</option>
              <option value="manual" ${service?.fulfillment_mode === 'manual' ? 'selected' : ''}>ম্যানুয়াল</option>
              <option value="api" ${service?.fulfillment_mode === 'api' ? 'selected' : ''}>অটো (API)</option>
              <option value="hybrid" ${service?.fulfillment_mode === 'hybrid' ? 'selected' : ''}>হাইব্রিড</option>
            </select>
          </div>
          <div id="sf-provider-wrap" style="display:${service?.fulfillment_mode === 'api' || service?.fulfillment_mode === 'hybrid' ? 'block' : 'none'}">
            <label class="block text-xs font-medium text-slate-300 mb-1.5">API Provider</label>
            <select id="sf-provider" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              <option value="">নির্বাচন করুন</option>
              ${_adminProvidersCache.map((p) => `<option value="${p.id}" ${service?.api_provider_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
          <label class="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" id="sf-captcha" ${service?.requires_captcha ? 'checked' : (isEdit ? '' : 'checked')} /> ক্যাপচা প্রয়োজন</label>
          <label class="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" id="sf-featured" ${service?.is_featured ? 'checked' : ''} /> ফিচার্ড</label>
          <div>
            <label class="block text-[10px] text-slate-500 mb-1">ডেলিভারি (মিনিট)</label>
            <input type="number" id="sf-delivery" min="1" value="${service?.avg_delivery_minutes ?? 60}" class="w-full glass rounded-lg px-3 py-1.5 text-xs outline-none input-glow" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-500 mb-1">অবস্থা</label>
            <select id="sf-status" class="w-full glass rounded-lg px-3 py-1.5 text-xs outline-none input-glow">
              <option value="active" ${service?.status === 'active' || !service ? 'selected' : ''}>সক্রিয়</option>
              <option value="inactive" ${service?.status === 'inactive' ? 'selected' : ''}>নিষ্ক্রিয়</option>
              <option value="maintenance" ${service?.status === 'maintenance' ? 'selected' : ''}>রক্ষণাবেক্ষণ</option>
            </select>
          </div>
        </div>

        <div class="border-t border-white/5 pt-4">
          <div class="flex items-center justify-between mb-3">
            <label class="block text-sm font-semibold text-slate-200">ডাইনামিক ফর্ম ফিল্ড (এই সার্ভিসের অর্ডার ফর্ম)</label>
            <button type="button" class="add-field-row-btn btn-glow glass text-xs font-semibold px-3 py-1.5 rounded-lg"><i class="fa-solid fa-plus mr-1"></i>ফিল্ড যোগ করুন</button>
          </div>
          <div class="field-builder-list space-y-3">
            ${schema.map((f) => formFieldBuilderRowHtml(f)).join('')}
          </div>
        </div>

        <button type="submit" id="sf-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
          <i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'আপডেট করুন' : 'তৈরি করুন'}
        </button>
      </form>
    </div>`, { maxWidth: 'max-w-2xl' })

  bindFormFieldBuilder(modal)

  qs('#sf-fulfillment', modal).addEventListener('change', (e) => {
    qs('#sf-provider-wrap', modal).style.display = (e.target.value === 'api' || e.target.value === 'hybrid') ? 'block' : 'none'
  })

  qs('#service-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#sf-submit', modal)
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`

    const payload = {
      name_bn: qs('#sf-name-bn', modal).value.trim(),
      name_en: qs('#sf-name-en', modal).value.trim(),
      slug: qs('#sf-slug', modal).value.trim(),
      icon: qs('#sf-icon', modal).value.trim() || 'fa-file-lines',
      price: parseFloat(qs('#sf-price', modal).value),
      cost_price: parseFloat(qs('#sf-cost', modal).value) || 0,
      category_id: qs('#sf-category', modal).value || null,
      description_bn: qs('#sf-desc', modal).value.trim(),
      fulfillment_mode: qs('#sf-fulfillment', modal).value,
      api_provider_id: qs('#sf-provider', modal).value || null,
      requires_captcha: qs('#sf-captcha', modal).checked,
      is_featured: qs('#sf-featured', modal).checked,
      avg_delivery_minutes: parseInt(qs('#sf-delivery', modal).value, 10) || 60,
      status: qs('#sf-status', modal).value,
      form_schema: collectFormSchema(modal),
    }

    try {
      const res = isEdit
        ? await AdminService.services.update(service.id, payload)
        : await AdminService.services.create(payload)
      showToast(res.message, 'success')
      closeModal()
      onDone()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'আপডেট করুন' : 'তৈরি করুন'}`
    }
  })
}

function openCategoriesModal(onDone) {
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-layer-group text-brand-400 mr-2"></i>ক্যাটাগরি ম্যানেজমেন্ট</h3>
      <div id="cat-list" class="space-y-2 mb-5 max-h-64 overflow-y-auto">
        ${_adminCategoriesCache.map((c) => `
          <div class="flex items-center gap-3 glass rounded-xl px-4 py-2.5">
            <i class="fa-solid ${c.icon || 'fa-layer-group'} text-brand-400"></i>
            <span class="flex-1 text-sm font-medium">${escapeHtml(c.name_bn)}</span>
            <span class="text-xs text-slate-500">${c.slug}</span>
          </div>`).join('') || '<p class="text-sm text-slate-500 text-center py-4">কোনো ক্যাটাগরি নেই</p>'}
      </div>
      <form id="new-cat-form" class="space-y-3 border-t border-white/5 pt-4">
        <p class="text-xs font-semibold text-slate-400">নতুন ক্যাটাগরি যোগ করুন</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" id="cat-name-bn" required placeholder="নাম (বাংলা)" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          <input type="text" id="cat-name-en" required placeholder="নাম (ইংরেজি)" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" id="cat-slug" required placeholder="স্লাগ (birth-cert)" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          <input type="text" id="cat-icon" placeholder="fa-layer-group" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
        </div>
        <button type="submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl text-sm">যোগ করুন</button>
      </form>
    </div>`, { maxWidth: 'max-w-lg' })

  qs('#new-cat-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      const res = await AdminService.services.createCategory({
        name_bn: qs('#cat-name-bn', modal).value.trim(),
        name_en: qs('#cat-name-en', modal).value.trim(),
        slug: qs('#cat-slug', modal).value.trim(),
        icon: qs('#cat-icon', modal).value.trim() || 'fa-layer-group',
      })
      showToast(res.message, 'success')
      closeModal()
      await onDone()
      openCategoriesModal(onDone)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  })
}

// ------------------------------------------------------------
// 5. Admin API Providers — CRUD, test-call
// ------------------------------------------------------------
async function renderAdminProviders() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/providers', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    ${adminSectionHeader('API প্রোভাইডার', 'তৃতীয়-পক্ষের অটোমেশন API কনফিগার করুন (কোড পরিবর্তন ছাড়াই)', `
      <button id="add-provider-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2"><i class="fa-solid fa-plus"></i> নতুন প্রোভাইডার</button>
    `)}
    <div id="providers-list" class="grid grid-cols-1 lg:grid-cols-2 gap-4">${Array(4).fill(0).map(() => skeletonCard('h-40')).join('')}</div>
  `

  async function loadProviders() {
    const listEl = qs('#providers-list')
    listEl.innerHTML = Array(4).fill(0).map(() => skeletonCard('h-40')).join('')
    let data
    try {
      data = await AdminService.providers.list()
    } catch (err) {
      listEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    _adminProvidersCache = data.providers || []
    const list = _adminProvidersCache

    if (!list.length) {
      listEl.innerHTML = emptyState('fa-plug', 'কোনো প্রোভাইডার নেই', 'অটো ফুলফিলমেন্টের জন্য একটি API প্রোভাইডার যোগ করুন।', `<button id="empty-add-provider" class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">নতুন প্রোভাইডার</button>`)
      qs('#empty-add-provider')?.addEventListener('click', () => openProviderFormModal(null, loadProviders))
      return
    }

    listEl.innerHTML = list.map((p) => `
      <div class="spot-card glass rounded-2xl p-5">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center"><i class="fa-solid fa-plug text-white"></i></div>
            <div>
              <p class="font-bold text-sm">${escapeHtml(p.name)}</p>
              <p class="text-[11px] text-slate-500 truncate max-w-[220px]">${escapeHtml(p.base_url)}</p>
            </div>
          </div>
          ${statusBadge(p.status)}
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-4">
          <span><i class="fa-solid fa-arrow-right-arrow-left mr-1 text-slate-500"></i>${p.http_method}</span>
          <span><i class="fa-solid fa-key mr-1 text-slate-500"></i>${p.auth_type}</span>
          <span class="col-span-2"><i class="fa-solid fa-lock mr-1 text-slate-500"></i>${escapeHtml(p.auth_key_value || 'সেট করা হয়নি')}</span>
        </div>
        <div class="flex gap-2">
          <button data-test="${p.id}" class="btn-glow flex-1 glass text-xs font-semibold px-3 py-2 rounded-lg"><i class="fa-solid fa-vial mr-1"></i>টেস্ট কল</button>
          <button data-edit-provider="${p.id}" class="btn-glow flex-1 glass text-xs font-semibold px-3 py-2 rounded-lg"><i class="fa-solid fa-pen mr-1"></i>এডিট</button>
          <button data-del-provider="${p.id}" class="btn-glow w-9 h-9 rounded-lg glass flex items-center justify-center text-rose-400"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>`).join('')

    initPageEffects(listEl)

    qsa('[data-edit-provider]', listEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = list.find((x) => String(x.id) === btn.dataset.editProvider)
        openProviderFormModal(p, loadProviders)
      })
    })
    qsa('[data-del-provider]', listEl).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog('প্রোভাইডার মুছে ফেলবেন?', 'এই প্রোভাইডারটি কোনো সার্ভিসে ব্যবহৃত না থাকলে মুছে যাবে।', 'মুছে ফেলুন', true)
        if (!ok) return
        try {
          const res = await AdminService.providers.remove(btn.dataset.delProvider)
          showToast(res.message, 'success')
          loadProviders()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
        }
      })
    })
    qsa('[data-test]', listEl).forEach((btn) => {
      btn.addEventListener('click', () => openProviderTestModal(btn.dataset.test))
    })
  }

  qs('#add-provider-btn').addEventListener('click', () => openProviderFormModal(null, loadProviders))

  loadProviders()
}

function openProviderFormModal(provider, onDone) {
  const isEdit = !!provider
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-plug text-brand-400 mr-2"></i>${isEdit ? 'প্রোভাইডার সম্পাদনা' : 'নতুন API প্রোভাইডার'}</h3>
      <form id="provider-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">নাম *</label>
          <input type="text" id="pf-name" required value="${escapeHtml(provider?.name || '')}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Base URL *</label>
          <input type="text" id="pf-url" required value="${escapeHtml(provider?.base_url || '')}" placeholder="https://api.example.com/verify" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">HTTP মেথড</label>
            <select id="pf-method" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              ${HTTP_METHOD_OPTIONS.map((m) => `<option value="${m}" ${provider?.http_method === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">অথ টাইপ</label>
            <select id="pf-authtype" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              ${AUTH_TYPE_OPTIONS.map((a) => `<option value="${a}" ${provider?.auth_type === a ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Auth Key Name</label>
            <input type="text" id="pf-authname" value="${escapeHtml(provider?.auth_key_name || '')}" placeholder="X-API-KEY" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Auth Key Value ${isEdit ? '(পরিবর্তন করতে চাইলে লিখুন)' : ''}</label>
            <input type="password" id="pf-authvalue" placeholder="${isEdit ? provider?.auth_key_value || '' : 'গোপন কী'}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Request Template (JSON, {{field}} প্লেসহোল্ডার ব্যবহার করুন)</label>
          <textarea id="pf-template" rows="3" placeholder='{"nid": "{{nid_number}}", "dob": "{{date_of_birth}}"}' class="w-full glass rounded-xl px-4 py-2.5 text-xs font-mono outline-none input-glow">${escapeHtml(provider?.request_template || '')}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Success Path</label>
            <input type="text" id="pf-success-path" value="${escapeHtml(provider?.response_success_path || '')}" placeholder="status" class="w-full glass rounded-xl px-4 py-2.5 text-xs font-mono outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Success Value</label>
            <input type="text" id="pf-success-value" value="${escapeHtml(provider?.response_success_value || '')}" placeholder="ok" class="w-full glass rounded-xl px-4 py-2.5 text-xs font-mono outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Result Path</label>
            <input type="text" id="pf-result-path" value="${escapeHtml(provider?.response_result_path || '')}" placeholder="data.result" class="w-full glass rounded-xl px-4 py-2.5 text-xs font-mono outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Error Path</label>
            <input type="text" id="pf-error-path" value="${escapeHtml(provider?.response_error_path || '')}" placeholder="message" class="w-full glass rounded-xl px-4 py-2.5 text-xs font-mono outline-none input-glow" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Timeout (ms)</label>
            <input type="number" id="pf-timeout" value="${provider?.timeout_ms ?? 15000}" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">অবস্থা</label>
            <select id="pf-status" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              <option value="active" ${provider?.status === 'active' ? 'selected' : ''}>সক্রিয়</option>
              <option value="inactive" ${provider?.status === 'inactive' || !provider ? 'selected' : ''}>নিষ্ক্রিয়</option>
            </select>
          </div>
        </div>
        <button type="submit" id="pf-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
          <i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'আপডেট করুন' : 'তৈরি করুন'}
        </button>
      </form>
    </div>`, { maxWidth: 'max-w-2xl' })

  qs('#provider-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#pf-submit', modal)
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`

    const payload = {
      name: qs('#pf-name', modal).value.trim(),
      base_url: qs('#pf-url', modal).value.trim(),
      http_method: qs('#pf-method', modal).value,
      auth_type: qs('#pf-authtype', modal).value,
      auth_key_name: qs('#pf-authname', modal).value.trim() || null,
      auth_key_value: qs('#pf-authvalue', modal).value.trim() || undefined,
      request_template: qs('#pf-template', modal).value.trim() || null,
      response_success_path: qs('#pf-success-path', modal).value.trim() || null,
      response_success_value: qs('#pf-success-value', modal).value.trim() || null,
      response_result_path: qs('#pf-result-path', modal).value.trim() || null,
      response_error_path: qs('#pf-error-path', modal).value.trim() || null,
      timeout_ms: parseInt(qs('#pf-timeout', modal).value, 10) || 15000,
      status: qs('#pf-status', modal).value,
    }

    try {
      const res = isEdit
        ? await AdminService.providers.update(provider.id, payload)
        : await AdminService.providers.create(payload)
      showToast(res.message, 'success')
      closeModal()
      onDone()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'আপডেট করুন' : 'তৈরি করুন'}`
    }
  })
}

function openProviderTestModal(providerId) {
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-4"><i class="fa-solid fa-vial text-brand-400 mr-2"></i>টেস্ট কল</h3>
      <label class="block text-xs font-medium text-slate-300 mb-1.5">Sample Data (JSON)</label>
      <textarea id="test-sample-data" rows="4" placeholder='{"nid_number": "1234567890", "date_of_birth": "1995-01-01"}' class="w-full glass rounded-xl px-4 py-2.5 text-xs font-mono outline-none input-glow mb-4"></textarea>
      <button id="run-test-btn" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl mb-4">টেস্ট কল করুন</button>
      <div id="test-result" class="text-xs font-mono glass rounded-xl p-4 max-h-64 overflow-auto whitespace-pre-wrap hidden"></div>
    </div>`, { maxWidth: 'max-w-lg' })

  qs('#run-test-btn', modal).addEventListener('click', async () => {
    const btn = qs('#run-test-btn', modal)
    const resultEl = qs('#test-result', modal)
    let sampleData = {}
    try {
      sampleData = JSON.parse(qs('#test-sample-data', modal).value || '{}')
    } catch {
      showToast('Sample Data সঠিক JSON নয়।', 'error')
      return
    }
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> চলছে...`
    try {
      const res = await AdminService.providers.test(providerId, sampleData)
      resultEl.classList.remove('hidden')
      resultEl.textContent = JSON.stringify(res.test_result, null, 2)
      resultEl.classList.toggle('text-brand-400', res.success)
      resultEl.classList.toggle('text-rose-400', !res.success)
    } catch (err) {
      resultEl.classList.remove('hidden')
      resultEl.textContent = getErrorMessage(err)
      resultEl.classList.add('text-rose-400')
    } finally {
      btn.disabled = false
      btn.innerHTML = 'টেস্ট কল করুন'
    }
  })
}

// ------------------------------------------------------------
// 6. Admin Users — list (search/filter), detail (balance/KYC/status)
// ------------------------------------------------------------
async function renderAdminUsers() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/users', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  let currentPage = 1
  let searchQuery = ''
  let statusFilter = ''

  content.innerHTML = `
    ${adminSectionHeader('ইউজার ম্যানেজমেন্ট', 'সকল ইউজার দেখুন, ব্যালেন্স সমন্বয় করুন ও পরিচালনা করুন')}
    <div class="flex flex-wrap gap-3 mb-5 items-center justify-between">
      <div class="glass rounded-xl px-3 py-2 flex items-center gap-2 w-full sm:w-72">
        <i class="fa-solid fa-magnifying-glass text-slate-500 text-sm"></i>
        <input id="admin-user-search" type="text" placeholder="নাম, ফোন বা ইমেইল খুঁজুন..." class="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
      </div>
      <select id="admin-user-status" class="glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
        <option value="">সব অবস্থা</option>
        <option value="pending">অনুমোদনের অপেক্ষায়</option>
        <option value="active">সক্রিয়</option>
        <option value="suspended">সাসপেন্ড</option>
        <option value="banned">ব্যান</option>
      </select>
    </div>
    <div id="admin-users-table">${skeletonCard('h-96')}</div>
    <div id="admin-users-pagination"></div>
  `

  async function loadUsers() {
    const tableEl = qs('#admin-users-table')
    const pagEl = qs('#admin-users-pagination')
    tableEl.innerHTML = skeletonCard('h-96')
    pagEl.innerHTML = ''

    let data
    try {
      data = await AdminService.users.list({ q: searchQuery, status: statusFilter, page: currentPage })
    } catch (err) {
      tableEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }

    const list = data.users || []
    if (!list.length) {
      tableEl.innerHTML = emptyState('fa-users', 'কোনো ইউজার নেই', 'এই ফিল্টারে কোনো ইউজার পাওয়া যায়নি।')
      return
    }

    tableEl.innerHTML = adminTableWrap(`
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/5 text-slate-400 text-xs">
          <th class="text-left px-4 py-3 font-medium">ইউজার</th>
          <th class="text-left px-4 py-3 font-medium">ব্যালেন্স</th>
          <th class="text-left px-4 py-3 font-medium">KYC</th>
          <th class="text-left px-4 py-3 font-medium">অবস্থা</th>
          <th class="text-left px-4 py-3 font-medium">যোগদান</th>
          <th class="text-left px-4 py-3 font-medium"></th>
        </tr></thead>
        <tbody>
          ${list.map((u) => `
            <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  ${iconAvatar(u.name, 32)}
                  <div>
                    <p class="font-medium">${escapeHtml(u.name)}</p>
                    <p class="text-[11px] text-slate-500">${escapeHtml(u.phone)}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 font-bold">${formatMoney(u.balance)}</td>
              <td class="px-4 py-3">${statusBadge(u.kyc_status === 'unverified' ? 'closed' : u.kyc_status)}</td>
              <td class="px-4 py-3">${statusBadge(u.status)}</td>
              <td class="px-4 py-3 text-xs text-slate-400">${formatDate(u.created_at)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <a href="/admin/users/${u.id}" data-link class="text-brand-400 hover:underline text-xs font-semibold">বিস্তারিত →</a>
                  <button data-id="${u.id}" data-name="${escapeHtml(u.name)}" class="btn-delete-user text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors" title="ইউজার ডিলিট করুন">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`)

    qsa('.btn-delete-user', tableEl).forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const id = btn.getAttribute('data-id')
        const name = btn.getAttribute('data-name')
        if (!confirm(`আপনি কি নিশ্চিতভাবে "${name}" ইউজারকে ডিলিট করতে চান? এর সাথে তার সমস্ত ডাটা স্থায়ীভাবে মুছে যাবে।`)) return
        btn.disabled = true
        try {
          const res = await AdminService.users.remove(id)
          showToast(res.message || 'ইউজার ডিলিট করা হয়েছে', 'success')
          loadUsers()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
          btn.disabled = false
        }
      })
    })

    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20)))
    pagEl.innerHTML = pagination(currentPage, totalPages, 'data-page')
    qsa('.page-btn', pagEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10)
        if (!p || p < 1 || p > totalPages) return
        currentPage = p
        loadUsers()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    })
  }

  qs('#admin-user-search').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.trim()
    currentPage = 1
    loadUsers()
  }, 400))
  qs('#admin-user-status').addEventListener('change', (e) => {
    statusFilter = e.target.value
    currentPage = 1
    loadUsers()
  })

  loadUsers()
}

async function renderAdminUserDetail(params) {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/users', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `<div class="max-w-5xl mx-auto space-y-6">${skeletonCard('h-40')}${skeletonCard('h-64')}</div>`

  async function load() {
    let data
    try {
      data = await AdminService.users.get(params.id)
    } catch (err) {
      content.innerHTML = emptyState('fa-triangle-exclamation', 'ইউজার পাওয়া যায়নি', getErrorMessage(err), `<a href="/admin/users" data-link class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সব ইউজার</a>`)
      return
    }

    const user = data.user
    const orders = data.orders || []
    const transactions = data.transactions || []

    content.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6">
        <a href="/admin/users" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5"><i class="fa-solid fa-arrow-left"></i> সব ইউজার</a>

        <div class="glass rounded-2xl p-6 flex flex-wrap items-center gap-4 justify-between">
          <div class="flex items-center gap-4">
            ${iconAvatar(user.name, 56)}
            <div>
              <h1 class="text-lg font-extrabold">${escapeHtml(user.name)}</h1>
              <p class="text-slate-400 text-xs mt-0.5">${escapeHtml(user.phone)} ${user.email ? '• ' + escapeHtml(user.email) : ''} ${user.whatsapp ? '• WhatsApp: ' + escapeHtml(user.whatsapp) : ''}</p>
              <p class="text-slate-500 text-[11px] mt-1">যোগদান: ${formatDate(user.created_at)} ${user.last_login_at ? '• সর্বশেষ লগইন: ' + timeAgo(user.last_login_at) : ''}</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="text-xl font-extrabold text-brand-400">${formatMoney(user.balance)}</span>
            <div class="flex gap-2">${statusBadge(user.status)}${statusBadge(user.kyc_status === 'unverified' ? 'closed' : user.kyc_status)}</div>
          </div>
        </div>

        ${user.status === 'pending' ? `
        <div class="glass rounded-2xl p-5 border border-amber-500/25 bg-amber-500/[0.04] flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0"><i class="fa-solid fa-clock"></i></div>
            <div>
              <p class="text-sm font-bold text-amber-300">এই অ্যাকাউন্টটি অনুমোদনের অপেক্ষায় আছে</p>
              <p class="text-xs text-slate-400">অনুমোদন না করা পর্যন্ত ইউজার লগইন করতে পারবেন না।</p>
            </div>
          </div>
          <button id="au-approve-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shrink-0"><i class="fa-solid fa-circle-check"></i> অনুমোদন করুন</button>
        </div>` : ''}

        <div class="glass rounded-2xl p-6 flex flex-wrap gap-3">
          <button id="au-adjust-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-coins"></i> ব্যালেন্স সমন্বয়</button>
          <select id="au-status-select" class="glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
            <option value="pending" ${user.status === 'pending' ? 'selected' : ''}>অনুমোদনের অপেক্ষায়</option>
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>সক্রিয়</option>
            <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>সাসপেন্ড</option>
            <option value="banned" ${user.status === 'banned' ? 'selected' : ''}>ব্যান</option>
          </select>
          <select id="au-kyc-select" class="glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
            <option value="unverified" ${user.kyc_status === 'unverified' ? 'selected' : ''}>KYC: যাচাই হয়নি</option>
            <option value="pending" ${user.kyc_status === 'pending' ? 'selected' : ''}>KYC: পেন্ডিং</option>
            <option value="verified" ${user.kyc_status === 'verified' ? 'selected' : ''}>KYC: যাচাইকৃত</option>
            <option value="rejected" ${user.kyc_status === 'rejected' ? 'selected' : ''}>KYC: প্রত্যাখ্যাত</option>
          </select>
          <button id="au-delete-btn" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors ml-auto">
            <i class="fa-solid fa-trash-can"></i> ইউজার ডিলিট করুন
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="glass rounded-2xl p-6">
            <h3 class="font-bold mb-4 text-sm"><i class="fa-solid fa-receipt text-sky-400 mr-2"></i>সাম্প্রতিক অর্ডার</h3>
            <div class="space-y-2">
              ${orders.length ? orders.map((o) => `
                <a href="/admin/orders/${o.id}" data-link class="flex items-center justify-between gap-3 hover:bg-white/[0.03] rounded-xl px-2 py-2">
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">${escapeHtml(o.service_name)}</p>
                    <p class="text-[11px] text-slate-500">${o.order_no} • ${timeAgo(o.created_at)}</p>
                  </div>
                  <div class="text-right shrink-0"><p class="text-sm font-bold">${formatMoney(o.price)}</p>${statusBadge(o.status)}</div>
                </a>`).join('') : `<p class="text-sm text-slate-500">কোনো অর্ডার নেই</p>`}
            </div>
          </div>
          <div class="glass rounded-2xl p-6">
            <h3 class="font-bold mb-4 text-sm"><i class="fa-solid fa-list text-violet-400 mr-2"></i>সাম্প্রতিক লেনদেন</h3>
            <div class="space-y-2">
              ${transactions.length ? transactions.map((t) => `
                <div class="flex items-center justify-between gap-3 px-2 py-2">
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">${escapeHtml(t.description || t.type)}</p>
                    <p class="text-[11px] text-slate-500">${timeAgo(t.created_at)}</p>
                  </div>
                  <p class="font-bold shrink-0 ${t.amount > 0 ? 'text-brand-400' : 'text-rose-400'}">${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)}</p>
                </div>`).join('') : `<p class="text-sm text-slate-500">কোনো লেনদেন নেই</p>`}
            </div>
          </div>
        </div>
      </div>
    `

    qs('#au-adjust-btn').addEventListener('click', () => openBalanceAdjustModal(user, load))
    qs('#au-approve-btn')?.addEventListener('click', async () => {
      try {
        const res = await AdminService.users.setStatus(user.id, 'active')
        showToast(res.message, 'success')
        load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    })
    qs('#au-status-select').addEventListener('change', async (e) => {
      try {
        const res = await AdminService.users.setStatus(user.id, e.target.value)
        showToast(res.message, 'success')
        load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    })
    qs('#au-kyc-select').addEventListener('change', async (e) => {
      try {
        const res = await AdminService.users.setKyc(user.id, e.target.value)
        showToast(res.message, 'success')
        load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    })
    qs('#au-delete-btn')?.addEventListener('click', async () => {
      if (!confirm(`আপনি কি নিশ্চিতভাবে "${user.name}" এর একাউন্ট মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।`)) return
      const btn = qs('#au-delete-btn')
      btn.disabled = true
      try {
        const res = await AdminService.users.remove(user.id)
        showToast(res.message || 'ইউজার ডিলিট করা হয়েছে', 'success')
        navigateTo('/admin/users')
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
        btn.disabled = false
      }
    })
  }

  load()
}

function openBalanceAdjustModal(user, onDone) {
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-2"><i class="fa-solid fa-coins text-brand-400 mr-2"></i>ব্যালেন্স সমন্বয়</h3>
      <p class="text-xs text-slate-400 mb-5">বর্তমান ব্যালেন্স: <b class="text-brand-400">${formatMoney(user.balance)}</b></p>
      <form id="adjust-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">পরিমাণ (৳) — পজিটিভ = যোগ, নেগেটিভ = বিয়োগ</label>
          <input type="number" id="adj-amount" required step="0.01" placeholder="যেমন: 100 বা -50" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">কারণ</label>
          <input type="text" id="adj-reason" placeholder="কারণ লিখুন" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
        </div>
        <button type="submit" id="adj-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl">সমন্বয় করুন</button>
      </form>
    </div>`, { maxWidth: 'max-w-sm' })

  qs('#adjust-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#adj-submit', modal)
    btn.disabled = true
    try {
      const res = await AdminService.users.adjustBalance(
        user.id,
        parseFloat(qs('#adj-amount', modal).value),
        qs('#adj-reason', modal).value.trim()
      )
      showToast(res.message, 'success')
      closeModal()
      onDone()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
    }
  })
}

// ------------------------------------------------------------
// 7. Admin Coupons — CRUD table
// ------------------------------------------------------------
async function renderAdminCoupons() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/coupons', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    ${adminSectionHeader('কুপন ম্যানেজমেন্ট', 'ডিসকাউন্ট কুপন তৈরি ও পরিচালনা করুন', `
      <button id="add-coupon-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2"><i class="fa-solid fa-plus"></i> নতুন কুপন</button>
    `)}
    <div id="coupons-table">${skeletonCard('h-96')}</div>
  `

  async function loadCoupons() {
    const tableEl = qs('#coupons-table')
    tableEl.innerHTML = skeletonCard('h-96')
    let data
    try {
      data = await AdminService.coupons.list()
    } catch (err) {
      tableEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const list = data.coupons || []
    if (!list.length) {
      tableEl.innerHTML = emptyState('fa-ticket', 'কোনো কুপন নেই', 'নতুন কুপন তৈরি করে ইউজারদের ছাড় দিন।', `<button id="empty-add-coupon" class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">নতুন কুপন</button>`)
      qs('#empty-add-coupon')?.addEventListener('click', () => openCouponFormModal(loadCoupons))
      return
    }

    tableEl.innerHTML = adminTableWrap(`
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/5 text-slate-400 text-xs">
          <th class="text-left px-4 py-3 font-medium">কোড</th>
          <th class="text-left px-4 py-3 font-medium">টাইপ / মূল্য</th>
          <th class="text-left px-4 py-3 font-medium">ব্যবহৃত / সীমা</th>
          <th class="text-left px-4 py-3 font-medium">প্রযোজ্য</th>
          <th class="text-left px-4 py-3 font-medium">মেয়াদ</th>
          <th class="text-left px-4 py-3 font-medium">অবস্থা</th>
          <th class="text-left px-4 py-3 font-medium"></th>
        </tr></thead>
        <tbody>
          ${list.map((cp) => `
            <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 font-mono font-bold text-brand-400">${cp.code}</td>
              <td class="px-4 py-3">${cp.type === 'percentage' ? toBnDigits(cp.value) + '%' : formatMoney(cp.value)}</td>
              <td class="px-4 py-3 text-xs">${toBnDigits(cp.used_count || 0)} / ${cp.usage_limit ? toBnDigits(cp.usage_limit) : '∞'}</td>
              <td class="px-4 py-3 text-xs">${cp.applicable_to === 'order' ? 'অর্ডার' : 'রিচার্জ'}</td>
              <td class="px-4 py-3 text-xs text-slate-400">${cp.expires_at ? formatDate(cp.expires_at) : 'সীমাহীন'}</td>
              <td class="px-4 py-3">
                <button data-toggle-coupon="${cp.id}" data-current="${cp.status}" class="cursor-pointer">${statusBadge(cp.status === 'active' ? 'active' : 'closed')}</button>
              </td>
              <td class="px-4 py-3">
                <button data-del-coupon="${cp.id}" class="btn-glow w-8 h-8 rounded-lg glass inline-flex items-center justify-center text-slate-300 hover:text-rose-400"><i class="fa-solid fa-trash text-xs"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`)

    qsa('[data-toggle-coupon]', tableEl).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.current === 'active' ? 'inactive' : 'active'
        try {
          await AdminService.coupons.toggle(btn.dataset.toggleCoupon, newStatus)
          showToast('কুপন আপডেট হয়েছে।', 'success')
          loadCoupons()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
        }
      })
    })
    qsa('[data-del-coupon]', tableEl).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog('কুপন মুছে ফেলবেন?', 'এই কাজটি ফিরিয়ে নেওয়া যাবে না।', 'মুছে ফেলুন', true)
        if (!ok) return
        try {
          const res = await AdminService.coupons.remove(btn.dataset.delCoupon)
          showToast(res.message, 'success')
          loadCoupons()
        } catch (err) {
          showToast(getErrorMessage(err), 'error')
        }
      })
    })
  }

  qs('#add-coupon-btn').addEventListener('click', () => openCouponFormModal(loadCoupons))

  loadCoupons()
}

function openCouponFormModal(onDone) {
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-ticket text-brand-400 mr-2"></i>নতুন কুপন তৈরি করুন</h3>
      <form id="coupon-create-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">কুপন কোড *</label>
          <input type="text" id="cf-code" required placeholder="WELCOME50" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow uppercase" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">টাইপ</label>
            <select id="cf-type" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              <option value="fixed">ফিক্সড (৳)</option>
              <option value="percentage">শতাংশ (%)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">মূল্য *</label>
            <input type="number" id="cf-value" required min="0" step="0.01" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">সর্বনিম্ন রিচার্জ (৳)</label>
            <input type="number" id="cf-min" min="0" value="0" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)</label>
            <input type="number" id="cf-max" min="0" placeholder="সীমাহীন" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">মোট ব্যবহার সীমা (0=সীমাহীন)</label>
            <input type="number" id="cf-limit" min="0" value="0" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">প্রতি ইউজার সীমা</label>
            <input type="number" id="cf-per-user" min="1" value="1" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">প্রযোজ্য</label>
            <select id="cf-applicable" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow">
              <option value="recharge">রিচার্জ</option>
              <option value="order">অর্ডার</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">মেয়াদ শেষ (ঐচ্ছিক)</label>
            <input type="date" id="cf-expires" class="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow" />
          </div>
        </div>
        <button type="submit" id="cf-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl">কুপন তৈরি করুন</button>
      </form>
    </div>`, { maxWidth: 'max-w-lg' })

  qs('#coupon-create-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#cf-submit', modal)
    btn.disabled = true
    try {
      const res = await AdminService.coupons.create({
        code: qs('#cf-code', modal).value.trim(),
        type: qs('#cf-type', modal).value,
        value: parseFloat(qs('#cf-value', modal).value),
        min_recharge: parseFloat(qs('#cf-min', modal).value) || 0,
        max_discount: qs('#cf-max', modal).value ? parseFloat(qs('#cf-max', modal).value) : null,
        usage_limit: parseInt(qs('#cf-limit', modal).value, 10) || 0,
        per_user_limit: parseInt(qs('#cf-per-user', modal).value, 10) || 1,
        applicable_to: qs('#cf-applicable', modal).value,
        expires_at: qs('#cf-expires', modal).value || null,
      })
      showToast(res.message, 'success')
      closeModal()
      onDone()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
    }
  })
}

// ============================================================
// Admin Support — ticket list + thread view with admin reply
// ============================================================

const ADMIN_TICKET_STATUS_FILTERS = [
  { key: '', label: 'সব' },
  { key: 'open', label: 'খোলা' },
  { key: 'answered', label: 'উত্তরিত' },
  { key: 'closed', label: 'বন্ধ' },
]

async function renderAdminSupport() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/support', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  let currentStatus = ''

  content.innerHTML = `
    ${adminSectionHeader('সাপোর্ট টিকেট', 'গ্রাহকদের প্রশ্ন ও সমস্যার সমাধান দিন')}
    <div class="flex flex-wrap gap-2 mb-5" id="admin-ticket-filters">
      ${ADMIN_TICKET_STATUS_FILTERS.map((f) => `
        <button data-status="${f.key}" class="admin-ticket-filter-btn btn-glow px-4 py-2 rounded-xl text-xs font-bold transition ${f.key === '' ? 'bg-brand-500 text-white' : 'glass text-slate-300'}">${f.label}</button>
      `).join('')}
    </div>
    <div id="admin-tickets-list" class="space-y-3">
      ${Array(4).fill(0).map(() => skeletonCard('h-20')).join('')}
    </div>
  `

  async function load(status) {
    const listEl = qs('#admin-tickets-list')
    listEl.innerHTML = Array(4).fill(0).map(() => skeletonCard('h-20')).join('')
    let data
    try {
      data = await AdminService.support.listTickets(status)
    } catch (err) {
      listEl.innerHTML = emptyState('fa-triangle-exclamation', 'টিকেট লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const list = data.tickets || []
    if (!list.length) {
      listEl.innerHTML = emptyState('fa-headset', 'কোনো টিকেট নেই', 'এই ফিল্টারে কোনো টিকেট পাওয়া যায়নি।')
      return
    }
    listEl.innerHTML = list.map((t, i) => `
      <a href="/admin/support/${t.id}" data-link class="spot-card glass rounded-2xl p-4 flex items-center gap-4 animate-fade-up block" style="animation-delay:${Math.min(i * 0.04, 0.3)}s">
        <div class="w-11 h-11 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-ticket text-sky-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm truncate">${escapeHtml(t.subject)}</p>
          <p class="text-xs text-slate-500">${t.ticket_no} • ${escapeHtml(t.user_name || '')} • ${escapeHtml(t.user_phone || '')} • ${timeAgo(t.updated_at)}</p>
        </div>
        ${statusBadge(t.status)}
        <i class="fa-solid fa-chevron-right text-slate-600 text-xs hidden sm:block"></i>
      </a>`).join('')
    initPageEffects(listEl)
  }

  qs('#admin-ticket-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-ticket-filter-btn')
    if (!btn) return
    currentStatus = btn.dataset.status
    qsa('.admin-ticket-filter-btn').forEach((b) => {
      b.classList.toggle('bg-brand-500', b === btn)
      b.classList.toggle('text-white', b === btn)
      b.classList.toggle('glass', b !== btn)
      b.classList.toggle('text-slate-300', b !== btn)
    })
    load(currentStatus)
  })

  load('')
}

async function renderAdminSupportDetail(params) {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/support', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `<div class="max-w-3xl mx-auto space-y-4">${skeletonCard('h-24')}${skeletonCard('h-96')}</div>`

  async function load() {
    let data
    try {
      data = await AdminService.support.getTicket(params.id)
    } catch (err) {
      content.innerHTML = emptyState('fa-triangle-exclamation', 'টিকেট পাওয়া যায়নি', getErrorMessage(err), `<a href="/admin/support" data-link class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সব টিকেট</a>`)
      return
    }

    const ticket = data.ticket
    const messages = data.messages || []
    const isClosed = ticket.status === 'closed'

    content.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        <a href="/admin/support" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5"><i class="fa-solid fa-arrow-left"></i> সব টিকেট</a>

        <div class="glass rounded-2xl p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-lg font-extrabold">${escapeHtml(ticket.subject)}</h1>
            <p class="text-slate-400 text-xs mt-1">${ticket.ticket_no} • ${escapeHtml(ticket.user_name || '')} (${escapeHtml(ticket.user_phone || '')}) • খোলা হয়েছে ${formatDate(ticket.created_at)}</p>
          </div>
          <div class="flex items-center gap-3">
            ${statusBadge(ticket.status)}
            <select id="ticket-status-select" class="glass rounded-xl px-3 py-2 text-xs outline-none">
              <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>খোলা</option>
              <option value="answered" ${ticket.status === 'answered' ? 'selected' : ''}>উত্তরিত</option>
              <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>বন্ধ</option>
            </select>
          </div>
        </div>

        <div class="glass rounded-2xl p-6">
          <div id="ticket-messages" class="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            ${messages.map((m) => `
              <div class="flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] ${m.sender_type === 'admin' ? 'bg-brand-500/15 ring-1 ring-brand-500/20' : 'glass'} rounded-2xl px-4 py-3">
                  <p class="text-xs font-semibold mb-1 ${m.sender_type === 'admin' ? 'text-brand-400' : 'text-violet-400'}">${m.sender_type === 'admin' ? 'সাপোর্ট টিম' : m.sender_type === 'user' ? 'গ্রাহক' : 'সিস্টেম'}</p>
                  <p class="text-sm whitespace-pre-wrap">${escapeHtml(m.message)}</p>
                  <p class="text-[10px] text-slate-500 mt-1.5">${timeAgo(m.created_at)}</p>
                </div>
              </div>`).join('')}
          </div>

          ${isClosed ? `
            <div class="mt-5 pt-5 border-t border-white/5 text-center text-sm text-slate-500">
              <i class="fa-solid fa-lock mr-1.5"></i>এই টিকেটটি বন্ধ করা হয়েছে
            </div>` : `
            <form id="admin-reply-form" class="mt-5 pt-5 border-t border-white/5 flex gap-2">
              <input type="text" id="admin-reply-input" placeholder="উত্তর লিখুন..." class="flex-1 glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
              <button type="submit" id="admin-reply-submit" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 rounded-xl font-semibold shrink-0"><i class="fa-solid fa-paper-plane"></i></button>
            </form>`}
        </div>
      </div>
    `

    const msgBox = qs('#ticket-messages')
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight

    qs('#admin-reply-form')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const input = qs('#admin-reply-input')
      const msg = input.value.trim()
      if (!msg) return
      const btn = qs('#admin-reply-submit')
      btn.disabled = true
      try {
        await AdminService.support.reply(params.id, msg)
        input.value = ''
        await load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      } finally {
        btn.disabled = false
      }
    })

    qs('#ticket-status-select')?.addEventListener('change', async (e) => {
      try {
        await AdminService.support.setStatus(params.id, e.target.value)
        showToast('স্ট্যাটাস আপডেট হয়েছে', 'success')
        await load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    })
  }

  load()
}

// ============================================================
// Admin Settings — general settings, payment methods, gateways
// ============================================================

const ADMIN_SETTINGS_TABS = [
  { key: 'general', label: 'সাধারণ সেটিংস', icon: 'fa-sliders' },
  { key: 'methods', label: 'পেমেন্ট মেথড', icon: 'fa-wallet' },
  { key: 'gateways', label: 'পেমেন্ট গেটওয়ে', icon: 'fa-plug' },
  { key: 'notice', label: 'নোটিস ও অফার', icon: 'fa-bullhorn' },
  { key: 'storage', label: 'ডকুমেন্ট স্টোরেজ', icon: 'fa-database' },
]

const GENERAL_SETTINGS_FIELDS = [
  { key: 'site_name', label: 'সাইটের নাম', type: 'text' },
  { key: 'referral_bonus_amount', label: 'রেফারেল বোনাস (টাকা)', type: 'number' },
  { key: 'support_phone', label: 'সাপোর্ট নাম্বার', type: 'text' },
  { key: 'support_whatsapp', label: 'সাপোর্ট হোয়াটসঅ্যাপ', type: 'text' },
  { key: 'min_recharge_amount', label: 'সর্বনিম্ন রিচার্জ (টাকা)', type: 'number' },
]

async function renderAdminSettings() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(ADMIN_NAV, '/admin/settings', true)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  let activeTab = 'general'

  content.innerHTML = `
    ${adminSectionHeader('সেটিংস', 'সিস্টেম কনফিগারেশন, পেমেন্ট মেথড ও গেটওয়ে পরিচালনা করুন')}
    <div class="flex flex-wrap gap-2 mb-6" id="admin-settings-tabs">
      ${ADMIN_SETTINGS_TABS.map((t) => `
        <button data-tab="${t.key}" class="admin-settings-tab-btn btn-glow px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${t.key === 'general' ? 'bg-brand-500 text-white' : 'glass text-slate-300'}">
          <i class="fa-solid ${t.icon}"></i> ${t.label}
        </button>
      `).join('')}
    </div>
    <div id="admin-settings-content"></div>
  `

  qs('#admin-settings-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-settings-tab-btn')
    if (!btn) return
    activeTab = btn.dataset.tab
    qsa('.admin-settings-tab-btn').forEach((b) => {
      b.classList.toggle('bg-brand-500', b === btn)
      b.classList.toggle('text-white', b === btn)
      b.classList.toggle('glass', b !== btn)
      b.classList.toggle('text-slate-300', b !== btn)
    })
    loadTab(activeTab)
  })

  async function loadTab(tab) {
    const el = qs('#admin-settings-content')
    el.innerHTML = skeletonCard('h-64')
    if (tab === 'general') return loadGeneralTab(el)
    if (tab === 'methods') return loadMethodsTab(el)
    if (tab === 'gateways') return loadGatewaysTab(el)
    if (tab === 'notice') return loadNoticeTab(el)
    if (tab === 'storage') return loadStorageTab(el)
  }

  async function loadGeneralTab(el) {
    let data
    try {
      data = await AdminService.settings.getAll()
    } catch (err) {
      el.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const settings = data.settings || {}
    el.innerHTML = `
      <form id="general-settings-form" class="glass rounded-2xl p-6 space-y-4 max-w-2xl">
        ${GENERAL_SETTINGS_FIELDS.map((f) => `
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">${f.label}</label>
            <input type="${f.type}" ${f.type === 'number' ? 'step="0.01"' : ''} data-key="${f.key}" value="${escapeHtml(settings[f.key] ?? '')}" class="general-setting-input w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
          </div>
        `).join('')}
        <button type="submit" id="general-settings-submit" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-floppy-disk"></i> সংরক্ষণ করুন
        </button>
      </form>
    `
    initPageEffects(el)
    qs('#general-settings-form', el).addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = qs('#general-settings-submit', el)
      btn.disabled = true
      const payload = {}
      qsa('.general-setting-input', el).forEach((inp) => { payload[inp.dataset.key] = inp.value })
      try {
        const res = await AdminService.settings.update(payload)
        showToast(res.message || 'সংরক্ষণ সফল হয়েছে', 'success')
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      } finally {
        btn.disabled = false
      }
    })
  }

  async function loadNoticeTab(el) {
    let data
    try {
      data = await AdminService.settings.getAll()
    } catch (err) {
      el.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const s = data.settings || {}
    const on = (v) => v === '1' || v === 1 || v === true
    el.innerHTML = `
      <form id="notice-settings-form" class="space-y-6 max-w-2xl">
        <div class="glass rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm"><i class="fa-solid fa-bullhorn text-amber-400 mr-2"></i>লাইভ নোটিস (স্ক্রলিং বার)</h3>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="ns-notice-enabled" class="sr-only peer" ${on(s.live_notice_enabled) ? 'checked' : ''}>
              <div class="w-11 h-6 bg-white/10 peer-checked:bg-brand-500 rounded-full transition-colors relative">
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>
          <p class="text-xs text-slate-500">চালু করলে সাইটের উপরে একটি স্ক্রলিং নোটিস বার দেখাবে। খালি রাখলে বা বন্ধ রাখলে কিছু দেখাবে না।</p>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">নোটিস টেক্সট</label>
            <textarea id="ns-notice-text" rows="2" placeholder="যেমন: দেশের সবচেয়ে কম দামে ও নিরাপদে জন্ম নিবন্ধন, NID কারেকশন ও সব সেবা পান আমাদের কাছে!" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">${escapeHtml(s.live_notice_text || '')}</textarea>
          </div>
        </div>

        <div class="glass rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm"><i class="fa-solid fa-star text-fuchsia-400 mr-2"></i>অফার / নতুন সেবা পপ-আপ কার্ড</h3>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="ns-promo-enabled" class="sr-only peer" ${on(s.promo_card_enabled) ? 'checked' : ''}>
              <div class="w-11 h-6 bg-white/10 peer-checked:bg-brand-500 rounded-full transition-colors relative">
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>
          <p class="text-xs text-slate-500">চালু করলে ব্যবহারকারীরা একটি আকর্ষণীয় পপ-আপ কার্ড দেখবে (একবার বন্ধ করলে আর দেখাবে না, যতক্ষণ না নিচের তথ্য পরিবর্তন করা হয়)।</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">ব্যাজ টেক্সট</label>
              <input type="text" id="ns-promo-badge" placeholder="যেমন: নতুন অফার" value="${escapeHtml(s.promo_card_badge || '')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">টাইটেল <span class="text-rose-400">*</span></label>
              <input type="text" id="ns-promo-title" placeholder="যেমন: ২০% ছাড়ে জন্ম নিবন্ধন করুন!" value="${escapeHtml(s.promo_card_title || '')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">বিবরণ</label>
            <textarea id="ns-promo-desc" rows="2" placeholder="অফারের বিস্তারিত লিখুন..." class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">${escapeHtml(s.promo_card_desc || '')}</textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">বাটন লেবেল</label>
              <input type="text" id="ns-promo-cta-label" placeholder="যেমন: এখনই দেখুন" value="${escapeHtml(s.promo_card_cta_label || '')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">বাটন লিংক (URL)</label>
              <input type="text" id="ns-promo-cta-url" placeholder="/services অথবা https://..." value="${escapeHtml(s.promo_card_cta_url || '')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
          </div>
        </div>

        <button type="submit" id="notice-settings-submit" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-floppy-disk"></i> সংরক্ষণ করুন
        </button>
      </form>
    `
    initPageEffects(el)
    qs('#notice-settings-form', el).addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = qs('#notice-settings-submit', el)
      btn.disabled = true
      const payload = {
        live_notice_enabled: qs('#ns-notice-enabled', el).checked ? '1' : '0',
        live_notice_text: qs('#ns-notice-text', el).value.trim(),
        promo_card_enabled: qs('#ns-promo-enabled', el).checked ? '1' : '0',
        promo_card_badge: qs('#ns-promo-badge', el).value.trim(),
        promo_card_title: qs('#ns-promo-title', el).value.trim(),
        promo_card_desc: qs('#ns-promo-desc', el).value.trim(),
        promo_card_cta_label: qs('#ns-promo-cta-label', el).value.trim(),
        promo_card_cta_url: qs('#ns-promo-cta-url', el).value.trim(),
      }
      try {
        const res = await AdminService.settings.update(payload)
        showToast(res.message || 'সংরক্ষণ সফল হয়েছে', 'success')
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      } finally {
        btn.disabled = false
      }
    })
  }

  function formatBytes(bytes) {
    if (!bytes) return '০ MB'
    const mb = bytes / (1024 * 1024)
    if (mb < 1) return toBnDigits((bytes / 1024).toFixed(1)) + ' KB'
    if (mb < 1024) return toBnDigits(mb.toFixed(1)) + ' MB'
    return toBnDigits((mb / 1024).toFixed(2)) + ' GB'
  }

  async function loadStorageTab(el) {
    el.innerHTML = skeletonCard('h-64')
    let data
    try {
      data = await AdminService.storage.usage()
    } catch (err) {
      el.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    renderStorage(data)

    function renderStorage(d) {
      const cats = Object.entries(d.categories).filter(([, v]) => v.count > 0)
      el.innerHTML = `
      <div class="space-y-6 max-w-2xl">
        <div class="glass rounded-2xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-sm"><i class="fa-solid fa-database text-brand-400 mr-2"></i>মোট ডকুমেন্ট স্টোরেজ (R2)</h3>
            <span class="text-lg font-extrabold text-brand-400">${formatBytes(d.total.size)}</span>
          </div>
          <p class="text-xs text-slate-500 mb-4">মোট ${toBnDigits(d.total.count)}টি ফাইল সংরক্ষিত আছে — ইউজারের আপলোড করা অর্ডার ডকুমেন্ট, এডমিনের সংযুক্ত ফলাফল ফাইল, এবং রিচার্জ পেমেন্ট প্রুফ।</p>
          <div class="space-y-2.5">
            ${cats.length ? cats.map(([, v]) => `
              <div class="flex items-center justify-between text-sm py-2 px-3 rounded-xl bg-white/[0.03]">
                <span class="text-slate-300">${escapeHtml(v.label)}</span>
                <span class="font-semibold text-slate-400">${toBnDigits(v.count)}টি • ${formatBytes(v.size)}</span>
              </div>
            `).join('') : `<p class="text-xs text-slate-500 text-center py-4">কোনো ফাইল নেই</p>`}
          </div>
        </div>

        <div class="glass rounded-2xl p-6 ${d.orphaned.count > 0 ? 'bg-amber-500/5 border-amber-500/15' : ''}">
          <h3 class="font-bold text-sm mb-2"><i class="fa-solid fa-broom ${d.orphaned.count > 0 ? 'text-amber-400' : 'text-slate-500'} mr-2"></i>অব্যবহৃত ফাইল পরিষ্কার করুন</h3>
          <p class="text-xs text-slate-500 mb-4">যে ফাইলগুলো এখন আর কোনো অর্ডার বা রিচার্জ রিকোয়েস্টের সাথে যুক্ত নেই (যেমন — টেস্ট অর্ডার বা ডিলিট হওয়া রিকোয়েস্টের পুরনো ফাইল), সেগুলো এখান থেকে নিরাপদে মুছে স্টোরেজ খালি করা যাবে। বর্তমানে সক্রিয় কোনো ইউজারের ডকুমেন্ট এতে প্রভাবিত হবে না।</p>
          ${d.orphaned.count > 0 ? `
            <div class="flex items-center justify-between mb-4 p-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25">
              <span class="text-sm font-semibold text-amber-300">${toBnDigits(d.orphaned.count)}টি অব্যবহৃত ফাইল পাওয়া গেছে</span>
              <span class="text-sm font-extrabold text-amber-300">${formatBytes(d.orphaned.size)}</span>
            </div>
            <button id="storage-purge-btn" class="btn-glow w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <i class="fa-solid fa-trash-can"></i> অব্যবহৃত ফাইল মুছে স্টোরেজ খালি করুন
            </button>
          ` : `<p class="text-sm text-brand-400 flex items-center gap-2"><i class="fa-solid fa-circle-check"></i> কোনো অব্যবহৃত ফাইল নেই, স্টোরেজ পরিষ্কার আছে।</p>`}
        </div>
      </div>`

      qs('#storage-purge-btn', el)?.addEventListener('click', async () => {
        openModal(`
          <div class="p-6">
            <h3 class="font-bold text-lg mb-2"><i class="fa-solid fa-triangle-exclamation text-rose-400 mr-2"></i>নিশ্চিত করুন</h3>
            <p class="text-sm text-slate-400 mb-6">${toBnDigits(d.orphaned.count)}টি অব্যবহৃত ফাইল (${formatBytes(d.orphaned.size)}) স্থায়ীভাবে মুছে ফেলা হবে। এই কাজটি ফিরিয়ে নেওয়া যাবে না। এগিয়ে যাবেন?</p>
            <div class="flex gap-3">
              <button id="storage-purge-cancel" class="flex-1 glass py-2.5 rounded-xl text-sm font-semibold">বাতিল</button>
              <button id="storage-purge-confirm" class="flex-1 btn-glow bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-bold">নিশ্চিত, মুছে ফেলুন</button>
            </div>
          </div>
        `, { maxWidth: 'max-w-md' })
        qs('#storage-purge-cancel')?.addEventListener('click', closeModal)
        qs('#storage-purge-confirm')?.addEventListener('click', async (e) => {
          e.target.disabled = true
          e.target.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> মুছে ফেলা হচ্ছে...`
          try {
            const res = await AdminService.storage.purgeOrphaned()
            closeModal()
            showToast(res.message || 'অব্যবহৃত ফাইল মুছে ফেলা হয়েছে', 'success')
            loadStorageTab(el)
          } catch (err) {
            showToast(getErrorMessage(err), 'error')
            e.target.disabled = false
            e.target.innerHTML = 'নিশ্চিত, মুছে ফেলুন'
          }
        })
      })
    }
  }

  async function loadMethodsTab(el) {
    let data
    try {
      data = await AdminService.settings.listPaymentMethods()
    } catch (err) {
      el.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const methods = data.methods || []
    el.innerHTML = `
      <div class="flex justify-end mb-4">
        <button id="add-method-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> নতুন মেথড
        </button>
      </div>
      <div id="methods-list" class="space-y-3">
        ${methods.length ? methods.map((m) => {
          const meta = (typeof RECHARGE_METHOD_LABELS !== 'undefined' && RECHARGE_METHOD_LABELS[m.method]) || { label: m.method, icon: 'fa-wallet', color: 'from-slate-500 to-slate-600' }
          return `
          <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0"><i class="fa-solid ${meta.icon} text-white"></i></div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm">${escapeHtml(meta.label)} <span class="text-[10px] text-slate-500 font-normal">(${escapeHtml(m.account_type || '')})</span></p>
              <p class="text-sm font-mono text-brand-400">${escapeHtml(m.account_number)}</p>
            </div>
            <button data-id="${m.id}" data-status="${m.status === 'active' ? 'inactive' : 'active'}" class="method-toggle-btn">${statusBadge(m.status)}</button>
            <button data-id="${m.id}" class="method-edit-btn text-xs px-3 py-2 rounded-lg glass hover:bg-white/10"><i class="fa-solid fa-pen"></i></button>
            <button data-id="${m.id}" class="method-delete-btn text-xs px-3 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"><i class="fa-solid fa-trash"></i></button>
          </div>`
        }).join('') : emptyState('fa-wallet', 'কোনো পেমেন্ট মেথড নেই', 'নতুন পেমেন্ট মেথড যোগ করুন।')}
      </div>
    `
    initPageEffects(el)

    qs('#add-method-btn', el).addEventListener('click', () => openMethodFormModal(null, () => loadMethodsTab(el)))
    qsa('.method-edit-btn', el).forEach((btn) => btn.addEventListener('click', () => {
      const m = methods.find((x) => String(x.id) === btn.dataset.id)
      openMethodFormModal(m, () => loadMethodsTab(el))
    }))
    qsa('.method-toggle-btn', el).forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await AdminService.settings.updatePaymentMethod(btn.dataset.id, { status: btn.dataset.status })
        showToast('স্ট্যাটাস আপডেট হয়েছে', 'success')
        loadMethodsTab(el)
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    }))
    qsa('.method-delete-btn', el).forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog('মেথড ডিলিট করুন?', 'এই পেমেন্ট মেথডটি স্থায়ীভাবে ডিলিট হয়ে যাবে।', 'ডিলিট করুন', true)
      if (!ok) return
      try {
        await AdminService.settings.deletePaymentMethod(btn.dataset.id)
        showToast('ডিলিট করা হয়েছে', 'success')
        loadMethodsTab(el)
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      }
    }))
  }

  function openMethodFormModal(method, onDone) {
    const isEdit = !!method
    const modal = openModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-wallet text-brand-400 mr-2"></i>${isEdit ? 'পেমেন্ট মেথড সম্পাদনা' : 'নতুন পেমেন্ট মেথড'}</h3>
        <form id="method-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">মেথড</label>
            <select id="mf-method" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">
              <option value="bkash" ${method?.method === 'bkash' ? 'selected' : ''}>বিকাশ</option>
              <option value="nagad" ${method?.method === 'nagad' ? 'selected' : ''}>নগদ</option>
              <option value="rocket" ${method?.method === 'rocket' ? 'selected' : ''}>রকেট</option>
              <option value="upay" ${method?.method === 'upay' ? 'selected' : ''}>উপায়</option>
              <option value="other" ${method?.method === 'other' ? 'selected' : ''}>অন্যান্য</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">একাউন্ট নাম্বার <span class="text-rose-400">*</span></label>
            <input type="text" id="mf-number" required value="${escapeHtml(method?.account_number || '')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">একাউন্ট টাইপ</label>
            <select id="mf-account-type" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">
              <option value="Personal" ${method?.account_type === 'Personal' ? 'selected' : ''}>Personal</option>
              <option value="Agent" ${method?.account_type === 'Agent' ? 'selected' : ''}>Agent</option>
              <option value="Merchant" ${method?.account_type === 'Merchant' ? 'selected' : ''}>Merchant</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">নির্দেশনা (বাংলা)</label>
            <textarea id="mf-instructions" rows="3" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">${escapeHtml(method?.instructions_bn || '')}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">সর্ট অর্ডার</label>
            <input type="number" id="mf-sort" value="${method?.sort_order ?? 0}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
          </div>
          <button type="submit" id="mf-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl">${isEdit ? 'আপডেট করুন' : 'যোগ করুন'}</button>
        </form>
      </div>`, { maxWidth: 'max-w-lg' })

    qs('#method-form', modal).addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = qs('#mf-submit', modal)
      btn.disabled = true
      const payload = {
        method: qs('#mf-method', modal).value,
        account_number: qs('#mf-number', modal).value.trim(),
        account_type: qs('#mf-account-type', modal).value,
        instructions_bn: qs('#mf-instructions', modal).value,
        sort_order: parseInt(qs('#mf-sort', modal).value, 10) || 0,
      }
      try {
        const res = isEdit
          ? await AdminService.settings.updatePaymentMethod(method.id, payload)
          : await AdminService.settings.createPaymentMethod(payload)
        showToast(res.message || 'সফল হয়েছে', 'success')
        closeModal()
        onDone()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
        btn.disabled = false
      }
    })
  }

  async function loadGatewaysTab(el) {
    let data
    try {
      data = await AdminService.settings.listPaymentGateways()
    } catch (err) {
      el.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const gateways = data.gateways || []
    el.innerHTML = `
      <div class="space-y-3">
        ${gateways.length ? gateways.map((g) => `
          <div class="glass rounded-2xl p-5">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center"><i class="fa-solid fa-plug text-violet-400"></i></div>
                <p class="font-semibold text-sm">${escapeHtml(g.name || g.provider || '')}</p>
              </div>
              ${statusBadge(g.status)}
            </div>
            <p class="text-xs text-slate-500 mb-3">${escapeHtml(g.api_base_url || '')}</p>
            <button data-id="${g.id}" class="gateway-edit-btn text-xs px-4 py-2 rounded-lg glass hover:bg-white/10"><i class="fa-solid fa-pen mr-1"></i> কনফিগার</button>
          </div>
        `).join('') : emptyState('fa-plug', 'কোনো গেটওয়ে নেই', 'পেমেন্ট গেটওয়ে কনফিগারেশন এখানে দেখা যাবে।')}
      </div>
    `
    initPageEffects(el)
    qsa('.gateway-edit-btn', el).forEach((btn) => btn.addEventListener('click', () => {
      const g = gateways.find((x) => String(x.id) === btn.dataset.id)
      openGatewayFormModal(g, () => loadGatewaysTab(el))
    }))
  }

  function openGatewayFormModal(gateway, onDone) {
    const modal = openModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-plug text-brand-400 mr-2"></i>${escapeHtml(gateway.name || gateway.provider || 'গেটওয়ে')} কনফিগার</h3>
        <form id="gateway-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">API Base URL</label>
            <input type="text" id="gf-base-url" value="${escapeHtml(gateway.api_base_url || '')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">API Key</label>
            <input type="password" id="gf-api-key" placeholder="${escapeHtml(gateway.api_key || 'অপরিবর্তিত রাখতে খালি রাখুন')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">API Secret</label>
            <input type="password" id="gf-api-secret" placeholder="${escapeHtml(gateway.api_secret || 'অপরিবর্তিত রাখতে খালি রাখুন')}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">অতিরিক্ত কনফিগ (JSON)</label>
            <textarea id="gf-config" rows="4" class="w-full glass rounded-xl px-4 py-3 text-xs font-mono outline-none input-glow" placeholder='{"merchant_id": "..."}'>${gateway.config ? escapeHtml(JSON.stringify(typeof gateway.config === 'string' ? JSON.parse(gateway.config) : gateway.config, null, 2)) : ''}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">স্ট্যাটাস</label>
            <select id="gf-status" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">
              <option value="active" ${gateway.status === 'active' ? 'selected' : ''}>সক্রিয়</option>
              <option value="inactive" ${gateway.status === 'inactive' ? 'selected' : ''}>নিষ্ক্রিয়</option>
            </select>
          </div>
          <button type="submit" id="gf-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl">সংরক্ষণ করুন</button>
        </form>
      </div>`, { maxWidth: 'max-w-lg' })

    qs('#gateway-form', modal).addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = qs('#gf-submit', modal)
      btn.disabled = true
      let config
      const configRaw = qs('#gf-config', modal).value.trim()
      try {
        config = configRaw ? JSON.parse(configRaw) : undefined
      } catch (err) {
        showToast('কনফিগ ভ্যালিড JSON হতে হবে', 'error')
        btn.disabled = false
        return
      }
      const payload = {
        api_base_url: qs('#gf-base-url', modal).value.trim(),
        status: qs('#gf-status', modal).value,
      }
      const apiKey = qs('#gf-api-key', modal).value.trim()
      const apiSecret = qs('#gf-api-secret', modal).value.trim()
      if (apiKey) payload.api_key = apiKey
      if (apiSecret) payload.api_secret = apiSecret
      if (config !== undefined) payload.config = config
      try {
        const res = await AdminService.settings.updatePaymentGateway(gateway.id, payload)
        showToast(res.message || 'সংরক্ষণ সফল হয়েছে', 'success')
        closeModal()
        onDone()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
        btn.disabled = false
      }
    })
  }

  loadTab('general')
}

