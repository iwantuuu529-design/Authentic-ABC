// ============================================================
// Services catalog + dynamic order form
// ============================================================

async function renderServicesPage() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/services')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">সকল সার্ভিস</h1>
      <p class="text-slate-400 text-sm mt-1">প্রয়োজনীয় সার্ভিসটি বেছে নিয়ে অর্ডার করুন</p>
    </div>
    <div class="flex flex-wrap items-center gap-2 mb-6" id="category-filters"></div>
    <div id="services-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      ${Array(6).fill(0).map(() => skeletonCard('h-52')).join('')}
    </div>`

  let data
  try {
    data = await API.get('/services')
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'সার্ভিস লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const allServices = data.services || []
  const categories = data.categories || []
  let activeCat = 'all'

  const filtersEl = qs('#category-filters')
  filtersEl.innerHTML = `
    <button data-cat="all" class="cat-filter-btn btn-glow px-4 py-2 rounded-full text-xs font-semibold bg-brand-500 text-white">সব সার্ভিস</button>
    ${categories.map((c) => `<button data-cat="${c.slug}" class="cat-filter-btn btn-glow px-4 py-2 rounded-full text-xs font-semibold glass text-slate-300"><i class="fa-solid ${c.icon} mr-1.5"></i>${escapeHtml(c.name_bn)}</button>`).join('')}
  `

  function renderGrid() {
    const grid = qs('#services-grid')
    const filtered = activeCat === 'all' ? allServices : allServices.filter((s) => s.category_slug === activeCat)
    if (!filtered.length) {
      grid.innerHTML = emptyState('fa-magnifying-glass', 'কোনো সার্ভিস পাওয়া যায়নি', 'এই ক্যাটাগরিতে বর্তমানে কোনো সার্ভিস নেই।')
      return
    }
    grid.innerHTML = filtered.map((s, i) => `
      <a href="/dashboard/services/${s.slug}" data-link class="spot-card glass rounded-2xl p-6 animate-fade-up block" style="animation-delay:${Math.min(i * 0.05, 0.4)}s">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400/20 to-violet-500/20 flex items-center justify-center">
            <i class="fa-solid ${s.icon || 'fa-file-lines'} text-brand-400 text-lg"></i>
          </div>
          ${s.is_featured ? '<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-500/15 text-violet-300">জনপ্রিয়</span>' : ''}
        </div>
        <h3 class="font-bold mb-1.5">${escapeHtml(s.name_bn)}</h3>
        <p class="text-slate-400 text-xs mb-4 line-clamp-2 h-8">${escapeHtml(s.description_bn || '')}</p>
        <div class="flex items-center justify-between text-xs text-slate-500 mb-4">
          <span><i class="fa-regular fa-clock mr-1"></i>${s.avg_delivery_minutes < 60 ? toBnDigits(s.avg_delivery_minutes) + ' মিনিট' : toBnDigits(Math.round(s.avg_delivery_minutes / 60)) + ' ঘন্টা'}</span>
          <span><i class="fa-solid ${s.fulfillment_mode === 'api' ? 'fa-bolt text-brand-400' : 'fa-user-gear'} mr-1"></i>${s.fulfillment_mode === 'api' ? 'স্বয়ংক্রিয়' : s.fulfillment_mode === 'hybrid' ? 'হাইব্রিড' : 'ম্যানুয়াল'}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="font-extrabold text-brand-400 text-lg">${formatMoney(s.price)}</span>
          <span class="btn-glow bg-white/5 group-hover:bg-brand-500 text-xs font-semibold px-4 py-2 rounded-xl">অর্ডার করুন</span>
        </div>
      </a>`).join('')
    initPageEffects(grid)
  }

  renderGrid()

  qsa('.cat-filter-btn', filtersEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat
      qsa('.cat-filter-btn', filtersEl).forEach((b) => b.classList.remove('bg-brand-500', 'text-white'))
      qsa('.cat-filter-btn', filtersEl).forEach((b) => { if (b !== btn) b.classList.add('glass', 'text-slate-300') })
      btn.classList.remove('glass', 'text-slate-300')
      btn.classList.add('bg-brand-500', 'text-white')
      renderGrid()
    })
  })
}

// ------------------------------------------------------------
// Dynamic service order form — driven entirely by form_schema
// ------------------------------------------------------------
async function renderServiceOrderPage(params) {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/services')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = skeletonCard('h-96')

  let data
  try {
    data = await API.get(`/services/${params.slug}`)
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'সার্ভিস পাওয়া যায়নি', getErrorMessage(err), `<a href="/dashboard/services" data-link class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সার্ভিসে ফিরে যান</a>`)
    return
  }

  const service = data.service
  const hasFileField = service.form_schema.some((f) => f.type === 'file')

  content.innerHTML = `
    <div class="mb-6">
      <a href="/dashboard/services" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5 mb-3"><i class="fa-solid fa-arrow-left"></i> সব সার্ভিস</a>
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400/20 to-violet-500/20 flex items-center justify-center shrink-0">
          <i class="fa-solid ${service.icon || 'fa-file-lines'} text-brand-400 text-xl"></i>
        </div>
        <div>
          <h1 class="text-xl font-extrabold">${escapeHtml(service.name_bn)}</h1>
          <p class="text-slate-400 text-sm">${escapeHtml(service.description_bn || '')}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 glass rounded-2xl p-6">
        <form id="order-form" class="space-y-5">
          ${service.form_schema.map((f) => renderFormField(f)).join('')}
          <div id="captcha-container"></div>
          <button type="submit" id="order-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2">
            <i class="fa-solid fa-paper-plane"></i> অর্ডার সাবমিট করুন
          </button>
        </form>
      </div>

      <div class="space-y-4">
        <div class="glass rounded-2xl p-5">
          <h3 class="font-bold text-sm mb-3">অর্ডার তথ্য</h3>
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">মূল্য</span>
              <span class="font-extrabold text-brand-400 text-lg">${formatMoney(service.price)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">আনুমানিক সময়</span>
              <span class="font-semibold">${service.avg_delivery_minutes < 60 ? toBnDigits(service.avg_delivery_minutes) + ' মিনিট' : toBnDigits(Math.round(service.avg_delivery_minutes / 60)) + ' ঘন্টা'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">প্রসেসিং টাইপ</span>
              <span class="font-semibold">${service.fulfillment_mode === 'api' ? '⚡ স্বয়ংক্রিয়' : service.fulfillment_mode === 'hybrid' ? '🔄 হাইব্রিড' : '👤 ম্যানুয়াল'}</span>
            </div>
          </div>
        </div>
        <div class="glass rounded-2xl p-5 bg-amber-500/5 border-amber-500/10">
          <div class="flex items-start gap-2.5">
            <i class="fa-solid fa-circle-info text-amber-400 mt-0.5"></i>
            <p class="text-xs text-slate-400">অর্ডার সাবমিট করার সাথে সাথে আপনার ওয়ালেট থেকে মূল্য কেটে নেওয়া হবে। ভুল তথ্যের কারণে অর্ডার বাতিল হলে টাকা ফেরত দেওয়া হবে।</p>
          </div>
        </div>
      </div>
    </div>
  `

  bindFileDropzones(qs('#order-form'))

  if (service.requires_captcha) {
    loadCaptcha(qs('#captcha-container'))
  }

  qs('#order-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#order-submit')
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`

    try {
      let res
      if (hasFileField) {
        const fd = new FormData(qs('#order-form'))
        fd.set('service_slug', service.slug)
        if (service.requires_captcha) {
          const cc = qs('#captcha-container')
          fd.set('captcha_token', cc.dataset.token || '')
          fd.set('captcha_answer', qs('#captcha-answer-input')?.value || '')
        }
        res = await API.postForm('/orders', fd)
      } else {
        const formData = {}
        service.form_schema.forEach((f) => {
          formData[f.name] = qs(`#field-${f.name}`)?.value || ''
        })
        const payload = { service_slug: service.slug, form_data: formData }
        if (service.requires_captcha) {
          const cc = qs('#captcha-container')
          payload.captcha_token = cc.dataset.token || ''
          payload.captcha_answer = qs('#captcha-answer-input')?.value || ''
        }
        res = await API.post('/orders', payload)
      }
      showToast(res.message, 'success')
      const u = getStoredUser()
      if (u) { try { const me = await API.get('/auth/me'); setStoredUser({ ...u, balance: me.user.balance }) } catch {} }
      navigate(`/dashboard/orders/${res.order.id}`)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      if (service.requires_captcha) loadCaptcha(qs('#captcha-container'))
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> অর্ডার সাবমিট করুন`
    }
  })
}
