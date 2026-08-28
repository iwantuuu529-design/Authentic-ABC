// ============================================================
// User Orders — list (filterable + paginated) & detail (timeline)
// ============================================================

const ORDER_STATUS_FILTERS = [
  { key: '', label: 'সব' },
  { key: 'pending', label: 'পেন্ডিং' },
  { key: 'processing', label: 'প্রসেসিং' },
  { key: 'completed', label: 'সম্পন্ন' },
  { key: 'rejected', label: 'বাতিল' },
  { key: 'refunded', label: 'রিফান্ড' },
]

async function renderOrdersPage() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/orders')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  let activeStatus = ''
  let currentPage = 1

  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">আমার অর্ডার</h1>
        <p class="text-slate-400 text-sm mt-1">সকল অর্ডারের বর্তমান অবস্থা দেখুন</p>
      </div>
      <a href="/dashboard/services" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2">
        <i class="fa-solid fa-plus"></i> নতুন অর্ডার
      </a>
    </div>
    <div class="flex flex-wrap gap-2 mb-6" id="order-status-filters">
      ${ORDER_STATUS_FILTERS.map((s) => `<button data-status="${s.key}" class="status-filter-btn btn-glow px-4 py-2 rounded-full text-xs font-semibold ${s.key === '' ? 'bg-brand-500 text-white' : 'glass text-slate-300'}">${s.label}</button>`).join('')}
    </div>
    <div id="orders-list" class="space-y-3">
      ${Array(5).fill(0).map(() => skeletonCard('h-20')).join('')}
    </div>
    <div id="orders-pagination"></div>
  `

  async function loadOrders() {
    const listEl = qs('#orders-list')
    const pagEl = qs('#orders-pagination')
    listEl.innerHTML = Array(5).fill(0).map(() => skeletonCard('h-20')).join('')
    pagEl.innerHTML = ''

    let data
    try {
      const q = activeStatus ? `?status=${activeStatus}&page=${currentPage}` : `?page=${currentPage}`
      data = await API.get(`/orders${q}`)
    } catch (err) {
      listEl.innerHTML = emptyState('fa-triangle-exclamation', 'অর্ডার লোড করা যায়নি', getErrorMessage(err))
      return
    }

    const list = data.orders || []
    if (!list.length) {
      listEl.innerHTML = emptyState('fa-inbox', 'কোনো অর্ডার নেই', 'এই স্ট্যাটাসে আপনার কোনো অর্ডার পাওয়া যায়নি।', `<a href="/dashboard/services" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সার্ভিস দেখুন</a>`)
      return
    }

    listEl.innerHTML = list.map((o, i) => `
      <a href="/dashboard/orders/${o.id}" data-link class="spot-card glass rounded-2xl p-4 flex items-center gap-4 animate-fade-up block" style="animation-delay:${Math.min(i * 0.04, 0.3)}s">
        <div class="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
          <i class="fa-solid ${o.service_icon || 'fa-file-lines'} text-brand-400 text-lg"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm truncate">${escapeHtml(o.service_name)}</p>
          <p class="text-xs text-slate-500">${o.order_no} • ${formatDate(o.created_at)}</p>
        </div>
        <div class="text-right shrink-0 flex flex-col items-end gap-1.5">
          <p class="font-extrabold text-sm">${formatMoney(o.price)}</p>
          ${statusBadge(o.status)}
        </div>
        <i class="fa-solid fa-chevron-right text-slate-600 text-xs hidden sm:block"></i>
      </a>`).join('')

    initPageEffects(listEl)

    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 15)))
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

  qsa('.status-filter-btn', qs('#order-status-filters')).forEach((btn) => {
    btn.addEventListener('click', () => {
      activeStatus = btn.dataset.status
      currentPage = 1
      qsa('.status-filter-btn', qs('#order-status-filters')).forEach((b) => {
        b.classList.remove('bg-brand-500', 'text-white')
        b.classList.add('glass', 'text-slate-300')
      })
      btn.classList.remove('glass', 'text-slate-300')
      btn.classList.add('bg-brand-500', 'text-white')
      loadOrders()
    })
  })

  loadOrders()
}

// ------------------------------------------------------------
// Order detail — form data, timeline, result
// ------------------------------------------------------------

function prettifyFieldName(name) {
  return String(name || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const ORDER_LOG_ICON = {
  created: { icon: 'fa-plus', color: 'text-sky-400 bg-sky-500/10' },
  auto_processing: { icon: 'fa-bolt', color: 'text-violet-400 bg-violet-500/10' },
  api_success: { icon: 'fa-circle-check', color: 'text-brand-400 bg-brand-500/10' },
  api_failed: { icon: 'fa-triangle-exclamation', color: 'text-amber-400 bg-amber-500/10' },
  refunded: { icon: 'fa-rotate-left', color: 'text-violet-400 bg-violet-500/10' },
  approved: { icon: 'fa-circle-check', color: 'text-brand-400 bg-brand-500/10' },
  rejected: { icon: 'fa-circle-xmark', color: 'text-rose-400 bg-rose-500/10' },
  note: { icon: 'fa-note-sticky', color: 'text-slate-400 bg-white/5' },
}

async function renderOrderDetailPage(params) {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/orders')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      ${skeletonCard('h-32')}
      ${skeletonCard('h-64')}
    </div>`

  let data
  try {
    data = await API.get(`/orders/${params.id}`)
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'অর্ডার পাওয়া যায়নি', getErrorMessage(err), `<a href="/dashboard/orders" data-link class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">অর্ডার তালিকায় ফিরুন</a>`)
    return
  }

  const order = data.order
  const logs = data.logs || []
  const formEntries = Object.entries(order.form_data || {}).filter(([k]) => k !== 'captcha_token' && k !== 'captcha_answer')
  const fieldTypeByName = {}
  ;(order.form_schema || []).forEach((f) => { fieldTypeByName[f.name] = f.type })

  content.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      <a href="/dashboard/orders" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5"><i class="fa-solid fa-arrow-left"></i> সব অর্ডার</a>

      <div class="glass rounded-2xl p-6 flex flex-wrap items-center gap-4 justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400/20 to-violet-500/20 flex items-center justify-center shrink-0">
            <i class="fa-solid ${order.service_icon || 'fa-file-lines'} text-brand-400 text-xl"></i>
          </div>
          <div>
            <h1 class="text-lg font-extrabold">${escapeHtml(order.service_name)}</h1>
            <p class="text-slate-400 text-xs mt-0.5">অর্ডার নম্বর: ${order.order_no} • ${formatDate(order.created_at)}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xl font-extrabold text-brand-400">${formatMoney(order.price)}</span>
          ${statusBadge(order.status)}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Submitted form data -->
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
                      ? `<a href="/api/orders/${order.id}/upload/${encodeURIComponent(k)}" target="_blank" class="btn-glow inline-flex items-center gap-2 bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30 text-xs font-semibold px-3 py-2 rounded-lg"><i class="fa-solid fa-file-arrow-up"></i> আপলোড করা ফাইল দেখুন</a>`
                      : `<p class="text-sm font-medium break-words">${escapeHtml(String(v ?? '-')) || '-'}</p>`}
                  </div>`
                }).join('')}
              </div>` : `<p class="text-sm text-slate-500">কোনো তথ্য পাওয়া যায়নি।</p>`}
          </div>

          ${order.status === 'completed' ? `
          <div class="glass rounded-2xl p-6 bg-brand-500/5 border-brand-500/10">
            <h3 class="font-bold mb-4"><i class="fa-solid fa-circle-check text-brand-400 mr-2"></i>ফলাফল</h3>
            ${order.result_file_key ? `
              <a href="/api/orders/${order.id}/result-file" target="_blank" class="btn-glow inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
                <i class="fa-solid fa-download"></i> ফলাফল ফাইল ডাউনলোড করুন
              </a>` : ''}
            ${order.result_data ? `
              <div class="mt-4 ${order.result_file_key ? 'pt-4 border-t border-white/5' : ''}">
                ${typeof order.result_data === 'object' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${Object.entries(order.result_data).map(([k, v]) => `
                      <div>
                        <p class="text-xs text-slate-500 mb-1">${escapeHtml(prettifyFieldName(k))}</p>
                        <p class="text-sm font-medium break-words">${escapeHtml(String(v ?? '-'))}</p>
                      </div>`).join('')}
                  </div>` : `<p class="text-sm whitespace-pre-wrap">${escapeHtml(String(order.result_data))}</p>`}
              </div>` : ''}
            ${!order.result_file_key && !order.result_data ? `<p class="text-sm text-slate-500">ফলাফল শীঘ্রই আপডেট করা হবে।</p>` : ''}
          </div>` : ''}

          ${order.admin_note ? `
          <div class="glass rounded-2xl p-6 bg-amber-500/5 border-amber-500/10">
            <h3 class="font-bold mb-2 text-sm"><i class="fa-solid fa-comment-dots text-amber-400 mr-2"></i>এডমিন নোট</h3>
            <p class="text-sm text-slate-300">${escapeHtml(order.admin_note)}</p>
          </div>` : ''}
        </div>

        <!-- Timeline -->
        <div class="glass rounded-2xl p-6">
          <h3 class="font-bold mb-5 text-sm"><i class="fa-solid fa-timeline text-brand-400 mr-2"></i>অর্ডার টাইমলাইন</h3>
          <div class="relative pl-2">
            ${logs.map((l, i) => {
              const meta = ORDER_LOG_ICON[l.action] || { icon: 'fa-circle-dot', color: 'text-slate-400 bg-white/5' }
              const isLast = i === logs.length - 1
              return `
              <div class="relative pl-8 ${isLast ? '' : 'pb-6'}">
                ${!isLast ? '<div class="absolute left-[15px] top-8 bottom-0 w-px bg-white/10"></div>' : ''}
                <div class="absolute left-0 top-0 w-8 h-8 rounded-full ${meta.color} flex items-center justify-center">
                  <i class="fa-solid ${meta.icon} text-xs"></i>
                </div>
                <p class="text-sm font-medium">${escapeHtml(l.note || l.action)}</p>
                <p class="text-[11px] text-slate-500 mt-0.5">${formatDate(l.created_at)} • ${l.actor_type === 'system' ? 'সিস্টেম' : l.actor_type === 'admin' ? 'এডমিন' : 'আপনি'}</p>
              </div>`
            }).join('') || `<p class="text-sm text-slate-500">কোনো কার্যক্রম নেই।</p>`}
          </div>
        </div>
      </div>

      <div class="text-center">
        <a href="/dashboard/support" data-link class="text-xs text-slate-400 hover:text-brand-400"><i class="fa-solid fa-circle-question mr-1"></i>এই অর্ডার নিয়ে সমস্যা? সাপোর্ট টিকেট খুলুন</a>
      </div>
    </div>
  `
}
