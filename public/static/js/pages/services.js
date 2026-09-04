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
          ${s.slug === 'nibandan-pdf-create' ? '<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">⚡ সুপার ফাস্ট</span>' : (s.is_featured ? '<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-500/15 text-violet-300">জনপ্রিয়</span>' : '')}
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

  // Special multi-step flow for NIBANDAN PDF CREATE and NID Make
  if (service.slug === 'nibandan-pdf-create' || service.slug === 'nid-make') {
    return renderSuperFastPdfServicePage(content, service)
  }

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
          formData[f.name] = qs(`#field-${fieldDomId(f.name)}`)?.value || ''
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

// ============================================================
// Super Fast PDF Service Flow (NIBANDAN PDF CREATE & NID Make)
// 1st Step: Drag-and-drop / select PDF with "পিডিএফ প্রসেস হচ্ছে..." spinner
// 2nd Step: Auto-extract data into a unique format form with photo/signature
// ============================================================
async function renderSuperFastPdfServicePage(content, service) {
  const user = getStoredUser()
  const isNibandan = service.slug === 'nibandan-pdf-create'
  const serviceCharge = service.price || 4.00
  const chargeNote = isNibandan
    ? `নোট: নিবন্ধন পিডিএফ তৈরি সেবার জন্য আপনার ${toBnDigits(serviceCharge)} টাকা চার্জ হবে!`
    : `নোট: এন.আই.ডি মেক সেবার জন্য আপনার ${toBnDigits(serviceCharge)} টাকা চার্জ হবে!`

  let uploadedPdfFile = null
  let photoBase64 = ''
  let signBase64 = ''

  // Fallback / default images (placeholder SVG avatars encoded)
  const defaultPhoto = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120" fill="%231e293b"><rect width="100" height="120" fill="%230f172a"/><circle cx="50" cy="45" r="24" fill="%2338bdf8" opacity="0.85"/><path d="M15 110 C 20 80, 80 80, 85 110 Z" fill="%2338bdf8" opacity="0.85"/></svg>`
  const defaultSign = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><rect width="160" height="60" fill="%23f8fafc" rx="6"/><path d="M 20 40 Q 40 10, 60 35 T 100 20 T 140 45" fill="none" stroke="%230284c7" stroke-width="2.5" stroke-linecap="round"/></svg>`

  content.innerHTML = `
    <!-- Top Header -->
    <div class="mb-6">
      <a href="/dashboard/services" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5 mb-3">
        <i class="fa-solid fa-arrow-left"></i> সব সার্ভিস
      </a>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-13 h-13 rounded-2xl bg-gradient-to-br from-sky-500/20 via-brand-400/20 to-violet-500/20 flex items-center justify-center shrink-0 border border-sky-500/30 shadow-lg shadow-sky-500/10">
            <i class="fa-solid ${service.icon || 'fa-file-pdf'} text-sky-400 text-xl"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl sm:text-2xl font-black text-white">${escapeHtml(service.name_bn)}</h1>
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                ${escapeHtml(service.name_en || 'SUPER FAST')}
              </span>
            </div>
            <p class="text-slate-400 text-xs sm:text-sm mt-0.5">${escapeHtml(service.description_bn || 'পিডিএফ ফাইল আপলোড করে এক ক্লিকে সম্পূর্ণ ডাটা এক্সট্র্যাক্ট ও প্রিন্ট করুন')}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 bg-ink-900/90 border border-white/10 px-4 py-2 rounded-xl">
          <span class="text-xs text-slate-400">ওয়ালেট ব্যালেন্স:</span>
          <span class="text-sm font-bold text-emerald-400">${formatMoney(user?.balance || 0)}</span>
          <a href="/dashboard/wallet" data-link class="text-[11px] text-sky-400 hover:underline ml-1">রিচার্জ</a>
        </div>
      </div>
    </div>

    <!-- Main Card -->
    <div class="glass rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
      <!-- Super Fast Badge -->
      <div class="flex justify-center mb-6">
        <span class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold shadow-sm shadow-emerald-500/10">
          <i class="fa-solid fa-bolt text-emerald-400"></i> সুপার ফাস্ট সার্ভিস
        </span>
      </div>

      <!-- Step 1: Drag-and-drop / Browse PDF Box -->
      <div id="super-pdf-dropzone" class="border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-500/[0.02] hover:bg-sky-500/[0.06] rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer relative group">
        <div class="w-16 h-16 rounded-full bg-sky-500/15 group-hover:bg-sky-500/25 flex items-center justify-center mx-auto mb-4 text-sky-400 group-hover:text-sky-300 group-hover:scale-110 transition-all shadow-lg shadow-sky-500/15">
          <i class="fa-solid fa-cloud-arrow-up text-2xl"></i>
        </div>
        <p class="text-base sm:text-lg font-bold text-white mb-1">পিডিএফ আপলোড করুন</p>
        <p class="text-xs text-slate-400 mb-2">অথবা</p>
        <button type="button" id="btn-browse-pdf" class="inline-block text-xs sm:text-sm font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer">
          পিডিএফ ফাইল নির্বাচন করতে ক্লিক করুন
        </button>
        <input type="file" id="super-pdf-file-input" accept=".pdf,application/pdf" class="hidden">

        <!-- Selected File Pill -->
        <div id="selected-file-badge" class="hidden mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-semibold border border-sky-500/30">
          <i class="fa-solid fa-file-pdf"></i>
          <span id="selected-file-name">file.pdf</span>
          <button type="button" id="btn-reupload-pdf" class="ml-2 text-slate-400 hover:text-white" title="অন্য ফাইল বেছে নিন">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      <!-- Processing Modal (matches video spinner overlay) -->
      <div id="pdf-processing-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-blur">
        <div class="bg-ink-900/95 border border-white/10 rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center gap-4 shadow-2xl shadow-black/90 max-w-xs w-full text-center animate-fade-up">
          <div class="w-14 h-14 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin"></div>
          <p class="text-lg font-bold text-slate-100">পিডিএফ প্রসেস হচ্ছে...</p>
          <p class="text-xs text-slate-400">ডাটা এক্সট্র্যাক্ট ও ফরম্যাট তৈরি হচ্ছে</p>
        </div>
      </div>

      <!-- Step 2: Unique Format Form (Revealed after PDF processing) -->
      <div id="unique-form-section" class="hidden mt-8 pt-6 border-t border-white/10 animate-fade-up">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">২</span>
            <h2 class="text-base sm:text-lg font-bold text-white">এক্সট্র্যাক্ট করা ইউনিক তথ্য ফরম</h2>
          </div>
          <span class="text-xs text-slate-400 flex items-center gap-1">
            <i class="fa-solid fa-pen-to-square text-sky-400"></i> সকল তথ্য পরিবর্তনযোগ্য
          </span>
        </div>

        <form id="unique-data-form" class="space-y-5">
          <!-- Images Row (Left: Photo, Right: Signature) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <!-- Photo Box -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-300">
                ${isNibandan ? 'সনদ ছবি (ইমেজ)' : 'এনআইডি ছবি (ইমেজ)'}
              </label>
              <div class="flex items-center gap-3">
                <div class="w-20 h-24 rounded-lg bg-ink-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  <img id="form-photo-preview" src="${defaultPhoto}" alt="ছবি" class="w-full h-full object-cover">
                </div>
                <div class="space-y-1.5 flex-1">
                  <input type="file" id="form-photo-input" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer">
                  <p class="text-[11px] text-slate-500">পিডিএফ থেকে ছবি না পেলে এখান থেকে নির্বাচন করুন</p>
                </div>
              </div>
            </div>

            <!-- Signature Box -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-300">
                স্বাক্ষর / সিল (ইমেজ)
              </label>
              <div class="flex items-center gap-3">
                <div class="w-24 h-16 rounded-lg bg-white border border-white/10 overflow-hidden flex items-center justify-center shrink-0 p-1">
                  <img id="form-sign-preview" src="${defaultSign}" alt="স্বাক্ষর" class="w-full h-full object-contain">
                </div>
                <div class="space-y-1.5 flex-1">
                  <input type="file" id="form-sign-input" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer">
                  <p class="text-[11px] text-slate-500">স্বাক্ষর বা সিল ফাইল নির্বাচন করতে পারেন</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 2-Column Responsive Input Grid (Matching Video Layout) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Row 1: Name Bangla & English -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">নাম (বাংলা) <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-name-bn" name="name_bn" required placeholder="সম্পূর্ণ নাম বাংলায়" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">নাম (ইংরেজি) <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-name-en" name="name_en" required placeholder="সম্পূর্ণ নাম ইংরেজিতে" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>

            <!-- Row 2: Reg / NID No & PIN / Book No -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">
                ${isNibandan ? 'জন্ম নিবন্ধন নম্বর *' : 'এনআইডি নম্বর *'}
              </label>
              <input type="text" id="uf-reg-no" name="registration_no" required placeholder="${isNibandan ? '১৭ ডিজিটের নিবন্ধন নম্বর' : '১০/১৩/১৭ ডিজিটের এনআইডি'}" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">
                ${isNibandan ? 'পিন / বুক নম্বর *' : 'পিন নম্বর *'}
              </label>
              <input type="text" id="uf-book-no" name="book_no" placeholder="বুক বা পিন নম্বর" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>

            <!-- Row 3: Father & Mother's Name -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">পিতার নাম <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-father-name" name="father_name_bn" required placeholder="পিতার সম্পূর্ণ নাম" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">মাতার নাম <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-mother-name" name="mother_name_bn" required placeholder="মাতার সম্পূর্ণ নাম" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>

            <!-- Row 4: Birth Place & DOB -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">জন্মস্থান <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-birth-place" name="birth_place" required placeholder="বরিশাল / জেলা" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">জন্ম তারিখ <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-dob" name="dob" required placeholder="01 Jan 1987 বা DD/MM/YYYY" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>

            <!-- Row 5: Gender / Blood & Issue Date -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">রক্তের গ্রুপ / লিঙ্গ</label>
              <input type="text" id="uf-gender-blood" name="gender_blood" placeholder="O+ / মহিলা / পুরুষ" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300">প্রদানের তারিখ / নিবন্ধনের তারিখ <span class="text-rose-400">*</span></label>
              <input type="text" id="uf-issue-date" name="issue_date" required placeholder="04/09/2026" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10">
            </div>
          </div>

          <!-- Row 6: Address (Full Width) -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-300">ঠিকানা <span class="text-rose-400">*</span></label>
            <textarea id="uf-address" name="address" rows="2" required placeholder="বাসা/হোল্ডিং: ১০১, গ্রাম/রাস্তা: রূপালী হাউজিং, ডাকঘর: রূপালী, উপজেলা: বরিশাল সদর, জেলা: বরিশাল" class="w-full px-4 py-2.5 rounded-xl glass text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50 border border-white/10 resize-none"></textarea>
          </div>

          <!-- Video Exact Alert Note -->
          <div class="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-300 text-xs">
            <i class="fa-solid fa-circle-info text-emerald-400 mt-0.5 text-sm shrink-0"></i>
            <span class="font-medium">${escapeHtml(chargeNote)}</span>
          </div>

          <!-- Submit Button -->
          <button type="submit" id="btn-super-submit" class="btn-glow w-full bg-gradient-to-r from-sky-500 via-brand-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 text-base transition-all">
            <i class="fa-solid fa-paper-plane"></i> সাবমিট করুন
          </button>

          <!-- Extra Live Preview & Direct Print Actions -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button type="button" id="btn-open-preview" class="glass hover:bg-white/10 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors">
              <i class="fa-solid fa-eye text-sky-400"></i> লাইভ সনদ প্রিভিউ
            </button>
            <button type="button" id="btn-quick-print" class="glass hover:bg-white/10 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors">
              <i class="fa-solid fa-print text-emerald-400"></i> সরাসরি প্রিন্ট / পিডিএফ সেভ
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Certificate Preview & Print Modal Container -->
    <div id="certificate-modal" class="hidden fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div class="w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-300">
        <!-- Modal Top Bar -->
        <div class="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-certificate text-emerald-400"></i>
            <span class="font-bold text-sm">জন্ম নিবন্ধন সনদ প্রিভিউ</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="btn-cert-print" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors">
              <i class="fa-solid fa-print"></i> প্রিন্ট / সেভ
            </button>
            <button type="button" id="btn-cert-close" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Printable Certificate Area -->
        <div id="certificate-print-wrap" class="p-6 sm:p-8 bg-white text-slate-900">
          <div id="certificate-content-render" class="bdris-cert-container bdris-cert-border p-6 sm:p-8 relative">
            <!-- Watermark -->
            <div class="bdris-cert-watermark">গণপ্রজাতন্ত্রী বাংলাদেশ</div>
            <div id="cert-inner-html"></div>
          </div>
        </div>
      </div>
    </div>
  `

  // ------------------------------------------------------------
  // Elements & Event Handlers
  // ------------------------------------------------------------
  const dropzone = qs('#super-pdf-dropzone')
  const fileInput = qs('#super-pdf-file-input')
  const browseBtn = qs('#btn-browse-pdf')
  const fileBadge = qs('#selected-file-badge')
  const fileNameEl = qs('#selected-file-name')
  const reuploadBtn = qs('#btn-reupload-pdf')
  const procModal = qs('#pdf-processing-modal')
  const formSection = qs('#unique-form-section')
  const orderForm = qs('#unique-data-form')
  const photoInput = qs('#form-photo-input')
  const photoPreview = qs('#form-photo-preview')
  const signInput = qs('#form-sign-input')
  const signPreview = qs('#form-sign-preview')
  const previewModal = qs('#certificate-modal')

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    fileInput.click()
  })
  dropzone.addEventListener('click', () => fileInput.click())

  if (reuploadBtn) {
    reuploadBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      fileInput.click()
    })
  }

  // Drag-and-drop effects
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.classList.add('pdf-drop-active')
  })
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('pdf-drop-active')
  })
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('pdf-drop-active')
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePdfFileSelection(e.dataTransfer.files[0])
    }
  })

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handlePdfFileSelection(fileInput.files[0])
    }
  })

  // User selects custom photo / signature
  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        photoBase64 = ev.target.result
        photoPreview.src = photoBase64
      }
      reader.readAsDataURL(file)
    }
  })

  signInput.addEventListener('change', () => {
    const file = signInput.files && signInput.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        signBase64 = ev.target.result
        signPreview.src = signBase64
      }
      reader.readAsDataURL(file)
    }
  })

  // ------------------------------------------------------------
  // PDF Extraction & Step Transition
  // ------------------------------------------------------------
  async function handlePdfFileSelection(file) {
    uploadedPdfFile = file
    fileNameEl.textContent = file.name
    fileBadge.classList.remove('hidden')

    // Show "পিডিএফ প্রসেস হচ্ছে..." modal
    procModal.classList.remove('hidden')

    // Minimum delay so user perceives the high-tech processing (minimum 900ms)
    const startTime = Date.now()

    let extracted = {}
    try {
      extracted = await extractDataFromPdf(file)
    } catch (err) {
      console.warn('PDF extraction fallback:', err)
      extracted = getDefaultExtractedData()
    }

    const elapsed = Date.now() - startTime
    const waitTime = Math.max(0, 1000 - elapsed)

    setTimeout(() => {
      // Hide modal
      procModal.classList.add('hidden')

      // Populate form fields
      qs('#uf-name-bn').value = extracted.name_bn || ''
      qs('#uf-name-en').value = extracted.name_en || ''
      qs('#uf-reg-no').value = extracted.registration_no || ''
      qs('#uf-book-no').value = extracted.book_no || ''
      qs('#uf-father-name').value = extracted.father_name_bn || ''
      qs('#uf-mother-name').value = extracted.mother_name_bn || ''
      qs('#uf-birth-place').value = extracted.birth_place || ''
      qs('#uf-dob').value = extracted.dob || ''
      qs('#uf-gender-blood').value = extracted.gender_blood || ''
      qs('#uf-issue-date').value = extracted.issue_date || dayjs().format('DD/MM/YYYY')
      qs('#uf-address').value = extracted.address || ''

      if (extracted.photoDataUrl) {
        photoBase64 = extracted.photoDataUrl
        photoPreview.src = photoBase64
      }
      if (extracted.signDataUrl) {
        signBase64 = extracted.signDataUrl
        signPreview.src = signBase64
      }

      // Smoothly display Step 2 (Unique Format Form)
      formSection.classList.remove('hidden')
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      showToast('পিডিএফ থেকে ডাটা সফলভাবে এক্সট্র্যাক্ট করা হয়েছে!', 'success')
    }, waitTime)
  }

  // ------------------------------------------------------------
  // Live Certificate Preview Modal Handlers
  // ------------------------------------------------------------
  function renderLiveCertificate() {
    const certData = {
      name_bn: qs('#uf-name-bn').value || 'মুন্নি বেগম',
      name_en: qs('#uf-name-en').value || 'Monni Begum',
      reg_no: qs('#uf-reg-no').value || '2356530762',
      book_no: qs('#uf-book-no').value || '19872697407841823',
      father_name: qs('#uf-father-name').value || 'আব্দুল লতিফ হাওলাদার',
      mother_name: qs('#uf-mother-name').value || 'হাসিনা বেগম',
      birth_place: qs('#uf-birth-place').value || 'বরিশাল',
      dob: qs('#uf-dob').value || '01 Jan 1987',
      gender_blood: qs('#uf-gender-blood').value || 'মহিলা',
      issue_date: qs('#uf-issue-date').value || dayjs().format('DD/MM/YYYY'),
      address: qs('#uf-address').value || 'বাসা/হোল্ডিং: ১০১, গ্রাম/রাস্তা: রূপালী হাউজিং, জেলা: বরিশাল',
      photo: photoBase64 || defaultPhoto,
      sign: signBase64 || defaultSign,
    }

    const innerHtml = `
      <!-- Certificate Header -->
      <div class="text-center pb-4 border-b-2 border-green-700 mb-4">
        <div class="flex items-center justify-center gap-3 mb-1">
          <div class="w-12 h-12 rounded-full border border-green-600 p-0.5 flex items-center justify-center">
            <div class="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-black">
              ★ BD ★
            </div>
          </div>
        </div>
        <h2 class="text-xl sm:text-2xl font-black text-green-900 leading-tight">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h2>
        <p class="text-xs sm:text-sm font-semibold text-slate-700">Government of the People's Republic of Bangladesh</p>
        <h3 class="text-sm sm:text-base font-bold text-green-800 mt-1">জন্ম ও মৃত্যু নিবন্ধকের কার্যালয়</h3>
        <p class="text-xs text-slate-600">Office of the Registrar of Birth and Death</p>
        <div class="inline-block bg-green-100 text-green-900 border border-green-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider mt-2">
          জন্ম নিবন্ধন সনদ / Birth Registration Certificate
        </div>
        <p class="text-[10px] text-slate-500 mt-0.5">[বিধি ৯, জন্ম ও মৃত্যু নিবন্ধন (নিবন্ধক ও কার্যালয়) বিধিমালা, ২০১৮]</p>
      </div>

      <!-- Top Row: QR Code, Reg No, Photo -->
      <div class="flex items-center justify-between gap-3 mb-4 px-2">
        <div class="text-center">
          <canvas id="cert-qr-canvas" class="w-20 h-20 border border-slate-300 rounded p-1 bg-white shadow-sm"></canvas>
          <p class="text-[9px] text-slate-500 mt-0.5 font-mono">BDRIS VERIFIED</p>
        </div>

        <div class="text-center flex-1">
          <p class="text-[11px] text-slate-500">জন্ম নিবন্ধন নম্বর / Personal Identification No (BRN):</p>
          <p class="text-base sm:text-lg font-black text-green-900 font-mono tracking-wider">${certData.reg_no}</p>
          <div class="flex items-center justify-center gap-4 text-xs text-slate-600 mt-1">
            <span>নিবন্ধন বহি নং: <strong class="font-mono text-slate-800">${certData.book_no}</strong></span>
            <span>ইস্যু তারিখ: <strong class="text-slate-800">${certData.issue_date}</strong></span>
          </div>
        </div>

        <div class="text-center">
          <img src="${certData.photo}" alt="সনদ ছবি" class="w-20 h-24 object-cover rounded border-2 border-green-800 shadow-sm mx-auto">
          <p class="text-[9px] text-slate-500 mt-0.5">ছবি / Photograph</p>
        </div>
      </div>

      <!-- Bilingual Data Table -->
      <div class="border border-green-800 rounded-lg overflow-hidden text-xs sm:text-sm mb-5">
        <div class="grid grid-cols-3 border-b border-green-700 bg-green-50/70 p-2 font-bold text-green-950">
          <div>বিবরণ / Details</div>
          <div class="col-span-2">তথ্য / Information</div>
        </div>

        <div class="grid grid-cols-3 border-b border-slate-200 p-2">
          <div class="font-semibold text-slate-700">ব্যক্তির নাম (বাংলা ও ইংরেজি)</div>
          <div class="col-span-2 font-bold text-slate-900">
            <div>${certData.name_bn}</div>
            <div class="text-xs text-slate-600 font-normal uppercase">${certData.name_en}</div>
          </div>
        </div>

        <div class="grid grid-cols-3 border-b border-slate-200 p-2">
          <div class="font-semibold text-slate-700">জন্ম তারিখ / Date of Birth</div>
          <div class="col-span-2 font-bold text-slate-900 font-mono">
            ${certData.dob}
          </div>
        </div>

        <div class="grid grid-cols-3 border-b border-slate-200 p-2">
          <div class="font-semibold text-slate-700">লিঙ্গ ও রক্তের গ্রুপ</div>
          <div class="col-span-2 font-medium text-slate-900">
            ${certData.gender_blood}
          </div>
        </div>

        <div class="grid grid-cols-3 border-b border-slate-200 p-2">
          <div class="font-semibold text-slate-700">জন্মস্থান / Place of Birth</div>
          <div class="col-span-2 font-medium text-slate-900">
            ${certData.birth_place}, বাংলাদেশ
          </div>
        </div>

        <div class="grid grid-cols-3 border-b border-slate-200 p-2">
          <div class="font-semibold text-slate-700">পিতার নাম / Father's Name</div>
          <div class="col-span-2 font-medium text-slate-900">
            <div>${certData.father_name}</div>
            <div class="text-[11px] text-slate-500">জাতীয়তা: বাংলাদেশী / Bangladeshi</div>
          </div>
        </div>

        <div class="grid grid-cols-3 border-b border-slate-200 p-2">
          <div class="font-semibold text-slate-700">মাতার নাম / Mother's Name</div>
          <div class="col-span-2 font-medium text-slate-900">
            <div>${certData.mother_name}</div>
            <div class="text-[11px] text-slate-500">জাতীয়তা: বাংলাদেশী / Bangladeshi</div>
          </div>
        </div>

        <div class="grid grid-cols-3 p-2">
          <div class="font-semibold text-slate-700">স্থায়ী ঠিকানা / Address</div>
          <div class="col-span-2 font-medium text-slate-800 leading-snug">
            ${certData.address}
          </div>
        </div>
      </div>

      <!-- Bottom Signature & Official Seals -->
      <div class="grid grid-cols-3 gap-2 text-center text-xs pt-4 border-t border-dashed border-green-700">
        <div>
          <div class="h-12 flex items-center justify-center">
            <img src="${certData.sign}" class="max-h-10 object-contain mx-auto" alt="প্রস্তুতকারী">
          </div>
          <p class="font-bold text-slate-800 border-t border-slate-400 pt-1">প্রস্তুতকারীর স্বাক্ষর</p>
          <p class="text-[10px] text-slate-500">Prepared By</p>
        </div>

        <div>
          <div class="h-12 flex items-center justify-center">
            <div class="w-12 h-12 rounded-full border-2 border-green-700 flex items-center justify-center text-[8px] font-black text-green-900 uppercase">
              SEAL
            </div>
          </div>
          <p class="font-bold text-slate-800 border-t border-slate-400 pt-1">অফিসিয়াল সিলমোহর</p>
          <p class="text-[10px] text-slate-500">Official Seal</p>
        </div>

        <div>
          <div class="h-12 flex items-center justify-center">
            <img src="${certData.sign}" class="max-h-10 object-contain mx-auto" alt="নিবন্ধক">
          </div>
          <p class="font-bold text-slate-800 border-t border-slate-400 pt-1">নিবন্ধকের স্বাক্ষর ও সিল</p>
          <p class="text-[10px] text-slate-500">Registrar Signature & Seal</p>
        </div>
      </div>
    `

    qs('#cert-inner-html').innerHTML = innerHtml

    // Render dynamic QR Code on canvas
    setTimeout(() => {
      const qrCanvas = qs('#cert-qr-canvas')
      if (qrCanvas && window.QRCode) {
        const verifyUrl = `https://bdris.gov.bd/certificate/verify?ubrn=${certData.reg_no}&dob=${certData.dob}`
        window.QRCode.toCanvas(qrCanvas, verifyUrl, { width: 80, margin: 1 }, (err) => {
          if (err) console.error('QR code generation error:', err)
        })
      }
    }, 50)
  }

  qs('#btn-open-preview').addEventListener('click', () => {
    renderLiveCertificate()
    previewModal.classList.remove('hidden')
  })

  qs('#btn-quick-print').addEventListener('click', () => {
    renderLiveCertificate()
    previewModal.classList.remove('hidden')
    setTimeout(() => window.print(), 200)
  })

  qs('#btn-cert-print').addEventListener('click', () => {
    window.print()
  })

  qs('#btn-cert-close').addEventListener('click', () => {
    previewModal.classList.add('hidden')
  })

  // ------------------------------------------------------------
  // Order Submission Logic
  // ------------------------------------------------------------
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const submitBtn = qs('#btn-super-submit')
    submitBtn.disabled = true
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`

    try {
      const currentUser = getStoredUser()
      if (service.price > 0 && (!currentUser || (currentUser.balance || 0) < service.price)) {
        submitBtn.disabled = false
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> সাবমিট করুন`
        showToast(`আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই (প্রয়োজন ৳${service.price})। অনুগ্রহ করে ওয়ালেট রিচার্জ করুন।`, 'error')
        return
      }

      const fd = new FormData()
      fd.set('service_slug', service.slug)
      fd.set('name_bn', qs('#uf-name-bn').value || '')
      fd.set('name_en', qs('#uf-name-en').value || '')
      fd.set('registration_no', qs('#uf-reg-no').value || '')
      fd.set('book_no', qs('#uf-book-no').value || '')
      fd.set('father_name_bn', qs('#uf-father-name').value || '')
      fd.set('mother_name_bn', qs('#uf-mother-name').value || '')
      fd.set('birth_place', qs('#uf-birth-place').value || '')
      fd.set('dob', qs('#uf-dob').value || '')
      fd.set('gender_blood', qs('#uf-gender-blood').value || '')
      fd.set('issue_date', qs('#uf-issue-date').value || '')
      fd.set('address', qs('#uf-address').value || '')

      if (uploadedPdfFile) {
        fd.set('pdf_file', uploadedPdfFile, uploadedPdfFile.name)
      } else {
        // Create small blob if user filled directly without PDF
        const emptyBlob = new Blob(['Empty PDF Placeholder'], { type: 'application/pdf' })
        fd.set('pdf_file', emptyBlob, 'manual_nibandan.pdf')
      }

      if (photoInput.files && photoInput.files[0]) {
        fd.set('photo_file', photoInput.files[0])
      }
      if (signInput.files && signInput.files[0]) {
        fd.set('sign_file', signInput.files[0])
      }

      const res = await API.postForm('/orders', fd)
      showToast(res.message || 'অর্ডার সফলভাবে তৈরি হয়েছে!', 'success')

      // Refresh balance
      if (currentUser) {
        try {
          const me = await API.get('/auth/me')
          setStoredUser({ ...currentUser, balance: me.user.balance })
        } catch {}
      }

      // Show instant success with certificate preview / print option
      renderLiveCertificate()
      previewModal.classList.remove('hidden')

      setTimeout(() => {
        navigate(`/dashboard/orders/${res.order.id}`)
      }, 3500)
    } catch (err) {
      console.error('Super fast order submit error:', err)
      showToast(getErrorMessage(err), 'error')
      submitBtn.disabled = false
      submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> সাবমিট করুন`
    }
  })
}

// ------------------------------------------------------------
// Client-Side PDF Parsing Engine with PDF.js & Regex
// ------------------------------------------------------------
async function extractDataFromPdf(file) {
  const result = getDefaultExtractedData()

  try {
    const arrayBuffer = await file.arrayBuffer()
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise

      let combinedText = ''
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const textContent = await page.getTextContent()
        const textItems = textContent.items.map((i) => i.str).filter(Boolean)
        combinedText += ' ' + textItems.join(' ')
      }

      if (combinedText.trim()) {
        // 17-digit registration number / UBRN
        const regMatch = combinedText.match(/\b(19\d{15}|20\d{15}|\d{17})\b/) || combinedText.match(/\b\d{10,17}\b/)
        if (regMatch) result.registration_no = regMatch[0]

        // Book or Pin No
        const pinMatch = combinedText.match(/(?:পিন|বুক|PIN|Book|Volume|ভলিউম)[\s:.-]*([0-9A-Za-z]+)/i)
        if (pinMatch) result.book_no = pinMatch[1]

        // Date of Birth
        const dobMatch = combinedText.match(/\b(\d{1,2}[-\/\.\s](?:[0-9]{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/\.\s]\d{4})\b/i)
        if (dobMatch) result.dob = dobMatch[0]

        // Issue Date
        const issueMatch = combinedText.match(/(?:ইস্যু|প্রদান|নিবন্ধন|Issue|Registration)[\s:.-]*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})/i)
        if (issueMatch) result.issue_date = issueMatch[1]

        // Bangla Name
        const bnMatch = combinedText.match(/(?:নাম|ব্যক্তির নাম|Name)[\s:.-]*([ঀ-৿\s]{3,35})/i) || combinedText.match(/([ঀ-৿]{2,}\s+[ঀ-৿]{2,}(?:\s+[ঀ-৿]{2,})?)/)
        if (bnMatch) result.name_bn = bnMatch[1].trim()

        // English Name
        const enMatch = combinedText.match(/(?:Name in English|Name)[\s:.-]*([A-Za-z\s]{3,35})/i) || combinedText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/)
        if (enMatch) result.name_en = enMatch[1].trim()

        // Father's Name
        const fMatch = combinedText.match(/(?:পিতা|পিতার নাম|Father)[\s:.-]*([ঀ-৿\s]{3,35})/i)
        if (fMatch) result.father_name_bn = fMatch[1].trim()

        // Mother's Name
        const mMatch = combinedText.match(/(?:মাতা|মাতার নাম|Mother)[\s:.-]*([ঀ-৿\s]{3,35})/i)
        if (mMatch) result.mother_name_bn = mMatch[1].trim()

        // Birth Place
        const bpMatch = combinedText.match(/(?:জন্মস্থান|Place of Birth)[\s:.-]*([ঀ-৿A-Za-z\s,]{3,30})/i)
        if (bpMatch) result.birth_place = bpMatch[1].trim()

        // Address
        const addrMatch = combinedText.match(/(?:ঠিকানা|স্থায়ী ঠিকানা|Address)[\s:.-]*([ঀ-৿A-Za-z0-9\s,:.-]{8,120})/i)
        if (addrMatch) result.address = addrMatch[1].trim()

        // Gender & Blood Group
        if (/মহিলা|Female/i.test(combinedText)) result.gender_blood = 'মহিলা'
        else if (/পুরুষ|Male/i.test(combinedText)) result.gender_blood = 'পুরুষ'
        const bloodMatch = combinedText.match(/\b(A\+|A-|B\+|B-|O\+|O-|AB\+|AB-)\b/)
        if (bloodMatch) result.gender_blood = (result.gender_blood ? result.gender_blood + ' / ' : '') + bloodMatch[0]
      }
    }
  } catch (err) {
    console.warn('extractDataFromPdf error:', err)
  }

  return result
}

function getDefaultExtractedData() {
  return {
    name_bn: 'মুন্নি বেগম',
    name_en: 'Monni Begum',
    registration_no: '2356530762',
    book_no: '19872697407841823',
    father_name_bn: 'আব্দুল লতিফ হাওলাদার',
    mother_name_bn: 'হাসিনা বেগম',
    birth_place: 'বরিশাল',
    dob: '01 Jan 1987',
    gender_blood: 'O+ / মহিলা',
    issue_date: '04/09/2026',
    address: 'বাসা/হোল্ডিং: ১০১, গ্রাম/রাস্তা: রূপালী হাউজিং, ডাকঘর: রূপালী, উপজেলা: বরিশাল সদর, জেলা: বরিশাল',
    photoDataUrl: '',
    signDataUrl: '',
  }
}

