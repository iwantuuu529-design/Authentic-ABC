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
          ${(s.slug === 'nid-create' || s.slug === 'nid-make' || s.slug === 'nibandan-pdf-create') ? '<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">⚡ সুপার ফাস্ট</span>' : (s.is_featured ? '<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-500/15 text-violet-300">জনপ্রিয়</span>' : '')}
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

  // Special multi-step flow for NID CREATE, NID Make, and NIBANDAN PDF CREATE
  if (service.slug === 'nid-create' || service.slug === 'nid-make' || service.slug === 'nibandan-pdf-create') {
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
  const isNid = service.slug === 'nid-create' || service.slug === 'nid-make' || service.slug === 'nid-smart-card-pdf' || service.slug === 'nid-sign-copy' || service.slug === 'nid-server-copy' || service.category_slug === 'nid' || (service.slug && service.slug.startsWith('nid-'))
  const isNibandan = service.slug === 'nibandan-pdf-create'
  const serviceCharge = service.price || 4.00
  const chargeNote = isNid
    ? `নোট: এনআইডি ক্রিয়েট সেবার জন্য আপনার ${toBnDigits(serviceCharge)} টাকা চার্জ হবে!`
    : isNibandan
    ? `নোট: নিবন্ধন পিডিএফ তৈরি সেবার জন্য আপনার ${toBnDigits(serviceCharge)} টাকা চার্জ হবে!`
    : `নোট: এই সেবার জন্য আপনার ${toBnDigits(serviceCharge)} টাকা চার্জ হবে!`

  const sampleNidPhoto = '/static/img/sample_nid_photo.jpg'
  const sampleNidSign = '/static/img/sample_nid_sign.svg'

  let uploadedPdfFile = null
  let photoBase64 = isNid ? sampleNidPhoto : ''
  let signBase64 = isNid ? sampleNidSign : ''

  // Fallback / default images (real photo and ink signature)
  const defaultPhoto = sampleNidPhoto
  const defaultSign = sampleNidSign

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

      ${isNid ? `
      <!-- Quick Demo Clone Action -->
      <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button type="button" id="btn-load-sample-nid" class="px-5 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer">
          <i class="fa-solid fa-id-card text-emerald-400 text-sm"></i> ১০০০% অরিজিনাল ক্লোন কার্ড দেখুন (MD. AMRAN KABIR RIPON)
        </button>
      </div>
      ` : ''}

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
      <div class="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-300">
        <!-- Modal Top Bar -->
        <div class="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div class="flex items-center gap-2">
            <i class="fa-solid ${isNid ? 'fa-id-card' : 'fa-certificate'} text-emerald-400"></i>
            <span class="font-bold text-sm">${isNid ? 'জাতীয় পরিচয়পত্র (NID Card) প্রিভিউ' : 'জন্ম নিবন্ধন সনদ প্রিভিউ'}</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="btn-cert-print" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors">
              <i class="fa-solid fa-print"></i> প্রিন্ট / সেভ করুন
            </button>
            <button type="button" id="btn-cert-close" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Printable Certificate Area -->
        <div id="certificate-print-wrap" class="p-4 sm:p-6 bg-white text-slate-900 overflow-x-auto flex justify-center">
          <div id="certificate-content-render" class="${isNid ? 'nid-card-print-container' : 'bdris-cert-container bdris-cert-border p-6 sm:p-8'} relative">
            ${isNid ? '' : '<div class="bdris-cert-watermark">গণপ্রজাতন্ত্রী বাংলাদেশ</div>'}
            <div id="cert-inner-html" class="${isNid ? 'w-full' : ''}"></div>
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

  function loadSampleNidCardData() {
    if (!isNid) return
    qs('#uf-name-bn').value = 'মোঃ এমরান কবির রিপন'
    qs('#uf-name-en').value = 'MD. AMRAN KABIR RIPON'
    qs('#uf-reg-no').value = '3738061542'
    qs('#uf-book-no').value = '19754814243000004'
    qs('#uf-father-name').value = 'মোঃ লিলু মিয়া'
    qs('#uf-mother-name').value = 'রহিমা খাতুন'
    qs('#uf-birth-place').value = 'কিশোরগঞ্জ'
    qs('#uf-dob').value = '08 Aug 1975'
    qs('#uf-gender-blood').value = 'AB+'
    qs('#uf-issue-date').value = '৩১/০৮/২০২৬'
    qs('#uf-address').value = 'বাসা/হোল্ডিং: , গ্রাম/রাস্তা: সাধের জঙ্গল, বাদে শ্রীরামপুর, ডাকঘর: জঙ্গলবাড়ি - ২৩০০, করিমগঞ্জ, কিশোরগঞ্জ'
    photoBase64 = sampleNidPhoto
    signBase64 = sampleNidSign
    photoPreview.src = photoBase64
    signPreview.src = signBase64
    formSection.classList.remove('hidden')
  }

  const sampleNidBtn = qs('#btn-load-sample-nid')
  if (sampleNidBtn) {
    sampleNidBtn.addEventListener('click', () => {
      loadSampleNidCardData()
      renderLiveCertificate()
      previewModal.classList.remove('hidden')
    })
  }

  // Pre-fill sample clone on initial load for NID service
  if (isNid) {
    loadSampleNidCardData()
  }

  // ------------------------------------------------------------
  // Real API NID Extraction & Step Transition
  // ------------------------------------------------------------
  async function handlePdfFileSelection(file) {
    uploadedPdfFile = file
    fileNameEl.textContent = file.name
    fileBadge.classList.remove('hidden')

    // Show "পিডিএফ প্রসেস হচ্ছে..." modal
    procModal.classList.remove('hidden')

    const startTime = Date.now()
    let extracted = null
    let apiError = null

    try {
      // 1. Send real PDF to backend proxy calling core.skseba.shop
      const fd = new FormData()
      fd.append('pdf', file)

      const apiRes = await fetch('/api/services/nid-analyze', {
        method: 'POST',
        body: fd
      })

      const apiData = await apiRes.json()

      if (apiData && (apiData.status === 'success' || apiData.status === true || apiData.success === true)) {
        extracted = mapSksebaData(apiData.data || apiData)
      } else if (apiData && (apiData.name || apiData.name_bn || apiData.nid || apiData.national_id || apiData.data)) {
        extracted = mapSksebaData(apiData.data || apiData)
      } else {
        apiError = apiData?.message || apiData?.error || 'API থেকে ডাটা পাওয়া যায়নি'
      }
    } catch (err) {
      console.warn('Real NID API call error:', err)
      apiError = err.message || 'API সার্ভারে কানেক্ট করা সম্ভব হয়নি'
    }

    // Always combine or fallback with client-side high-precision PDF extractor
    try {
      const parsed = await extractDataFromPdf(file)
      if (parsed && (parsed.registration_no || parsed.name_bn || parsed.name_en || parsed.dob)) {
        extracted = {
          name_bn: extracted?.name_bn || parsed.name_bn || '',
          name_en: extracted?.name_en || parsed.name_en || '',
          registration_no: extracted?.registration_no || parsed.registration_no || parsed.book_no || '',
          book_no: extracted?.book_no || parsed.book_no || parsed.registration_no || '',
          father_name_bn: extracted?.father_name_bn || parsed.father_name_bn || '',
          mother_name_bn: extracted?.mother_name_bn || parsed.mother_name_bn || '',
          birth_place: extracted?.birth_place || parsed.birth_place || '',
          dob: extracted?.dob || parsed.dob || '',
          gender_blood: extracted?.gender_blood || parsed.gender_blood || '',
          issue_date: extracted?.issue_date || parsed.issue_date || dayjs().format('DD/MM/YYYY'),
          address: extracted?.address || parsed.address || '',
          photoDataUrl: extracted?.photoDataUrl || parsed.photoDataUrl || '',
          signDataUrl: extracted?.signDataUrl || parsed.signDataUrl || '',
        }
      }
    } catch (parseErr) {
      console.warn('Fallback PDF extraction error:', parseErr)
    }

    const elapsed = Date.now() - startTime
    const waitTime = Math.max(0, 600 - elapsed)

    setTimeout(() => {
      // Hide modal
      procModal.classList.add('hidden')

      if (!extracted || (!extracted.name_bn && !extracted.registration_no && !extracted.name_en)) {
        showToast(apiError || 'পিডিএফ ফাইলটি রিড করা সম্ভব হয়নি। সঠিক ফাইল আপলোড করুন।', 'error')
        extracted = {
          name_bn: '',
          name_en: '',
          registration_no: '',
          book_no: '',
          father_name_bn: '',
          mother_name_bn: '',
          birth_place: '',
          dob: '',
          gender_blood: '',
          issue_date: dayjs().format('DD/MM/YYYY'),
          address: '',
          photoDataUrl: '',
          signDataUrl: '',
        }
      } else {
        showToast('রিয়েল API ও সিএমএস অ্যানালাইসিসের মাধ্যমে ডাটা সফলভাবে পাওয়া গেছে!', 'success')
      }

      // Populate form fields with real extracted data
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
    }, waitTime)
  }

  function mapSksebaData(raw) {
    const d = raw?.data || raw?.result || raw?.info || raw || {}
    let photo = d.photo || d.photo_url || d.photoUrl || d.image || d.picture || ''
    let sign = d.sign || d.signature || d.sign_url || d.signUrl || d.signature_url || ''

    if (photo && !photo.startsWith('data:') && !photo.startsWith('http')) {
      photo = 'data:image/jpeg;base64,' + photo
    }
    if (sign && !sign.startsWith('data:') && !sign.startsWith('http')) {
      sign = 'data:image/png;base64,' + sign
    }

    // Extract CMS copy Permanent Address (স্থায়ী ঠিকানা) logic
    let addr = d.permanent_address || d.permanentAddress || d.address || d.present_address || ''
    if (typeof addr === 'object' && addr !== null) {
      const parts = []
      const holding = addr.holding || addr.home || addr.holding_no || ''
      const holdingStr = (!holding || holding === '-' || holding === 'None' || holding === 'null') ? '' : holding
      parts.push(`বাসা/হোল্ডিং: ${holdingStr}`)
      const addl = addr.additional_village || addr.additional_village_road || ''
      const mouza = addr.mouza || addr.moholla || addr.village || addr.road || ''
      const v = [addl, mouza].filter(Boolean).join(', ')
      if (v) parts.push(`গ্রাম/রাস্তা: ${v}`)
      if (addr.post_office || addr.postOffice) {
        const po = addr.post_office || addr.postOffice
        const pc = addr.postal_code || addr.postCode || addr.post_code || ''
        parts.push(`ডাকঘর: ${po}${pc ? ' - ' + pc : ''}`)
      }
      if (addr.upozila || addr.upazila || addr.thana) parts.push(addr.upozila || addr.upazila || addr.thana)
      if (addr.district || addr.zila) parts.push(addr.district || addr.zila)
      addr = parts.join(', ')
    } else if (!addr && (d.village || d.post_office || d.district)) {
      const parts = []
      const holding = d.holding || d.home || d.holding_no || ''
      const holdingStr = (!holding || holding === '-' || holding === 'None' || holding === 'null') ? '' : holding
      parts.push(`বাসা/হোল্ডিং: ${holdingStr}`)
      const addl = d.additional_village || d.additional_village_road || ''
      const mouza = d.mouza || d.moholla || d.village || d.road || ''
      const v = [addl, mouza].filter(Boolean).join(', ')
      if (v) parts.push(`গ্রাম/রাস্তা: ${v}`)
      if (d.post_office || d.postOffice) {
        const po = d.post_office || d.postOffice
        const pc = d.postal_code || d.postCode || d.post_code || ''
        parts.push(`ডাকঘর: ${po}${pc ? ' - ' + pc : ''}`)
      }
      if (d.upozila || d.upazila || d.thana) parts.push(d.upozila || d.upazila || d.thana)
      if (d.district || d.zila) parts.push(d.district || d.zila)
      addr = parts.join(', ')
    }

    const blood = d.blood_group || d.bloodGroup || d.blood || ''
    const regNo = d.nid || d.nidNo || d.nid_no || d.national_id || d.nationalId || d.nationalID || d['National ID'] || d.registration_no || d.voter_no || ''
    const pinNo = d.pin || d.pinNo || d.pin_no || d.book_no || d['Pin'] || ''

    return {
      name_bn: d.name_bn || d.name || d.nameBangla || d.bangla_name || '',
      name_en: d.name_en || d.nameEn || d.english_name || d.nameEnglish || '',
      registration_no: regNo || pinNo || '',
      book_no: pinNo || regNo || '',
      father_name_bn: d.father || d.father_name || d.father_name_bn || d.fatherName || '',
      mother_name_bn: d.mother || d.mother_name || d.mother_name_bn || d.motherName || '',
      birth_place: d.birth_place || d.birthPlace || d.place_of_birth || d.district || '',
      dob: formatNidDob(d.dob || d.date_of_birth || d.dateOfBirth || ''),
      gender_blood: blood || (d.gender ? d.gender : ''),
      issue_date: d.issue_date || d.issueDate || d.registration_date || dayjs().format('DD/MM/YYYY'),
      address: addr,
      photoDataUrl: photo,
      signDataUrl: sign,
    }
  }

  // ------------------------------------------------------------
  // Live Certificate Preview Modal Handlers
  // ------------------------------------------------------------
  function renderLiveCertificate() {
    const rawDob = qs('#uf-dob').value || ''
    const rawIssueDate = qs('#uf-issue-date').value || dayjs().format('DD/MM/YYYY')
    const formattedDob = formatNidDob(rawDob)
    const issueDateBn = formatBanglaDate(rawIssueDate)

    const bnToEn = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' }
    const rawRegNo = qs('#uf-reg-no').value || ''
    const cleanRegNo = String(rawRegNo).replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch).trim()

    let addressRaw = qs('#uf-address').value || ''
    let cleanAddress = addressRaw
      .replace(/বাসা\/হোল্ডিং:\s*[-–]/g, 'বাসা/হোল্ডিং: ')
      .replace(/ডাকঘর:\s*([^,-]+)-(\d{4})/g, 'ডাকঘর: $1 - $2')
      .replace(/\s{2,}/g, ' ')
      .trim()

    const certData = {
      name_bn: qs('#uf-name-bn').value || (isNid ? 'মোঃ এমরান কবির রিপন' : ''),
      name_en: qs('#uf-name-en').value || (isNid ? 'MD. AMRAN KABIR RIPON' : ''),
      reg_no: cleanRegNo || (isNid ? '3738061542' : ''),
      book_no: qs('#uf-book-no').value || (isNid ? '19754814243000004' : ''),
      father_name: qs('#uf-father-name').value || (isNid ? 'মোঃ লিলু মিয়া' : ''),
      mother_name: qs('#uf-mother-name').value || (isNid ? 'রহিমা খাতুন' : ''),
      birth_place: qs('#uf-birth-place').value || (isNid ? 'কিশোরগঞ্জ' : ''),
      dob: formattedDob || rawDob || (isNid ? '08 Aug 1975' : ''),
      gender_blood: qs('#uf-gender-blood').value || (isNid ? 'AB+' : ''),
      issue_date: issueDateBn || rawIssueDate || (isNid ? '৩১/০৮/২০২৬' : ''),
      address: cleanAddress || (isNid ? 'বাসা/হোল্ডিং: , গ্রাম/রাস্তা: সাধের জঙ্গল, বাদে শ্রীরামপুর, ডাকঘর: জঙ্গলবাড়ি - ২৩০০, করিমগঞ্জ, কিশোরগঞ্জ' : ''),
      photo: photoBase64 || defaultPhoto,
      sign: signBase64 || defaultSign,
    }

    let innerHtml = ''

    if (isNid) {
      innerHtml = `
        <!-- NID Card Preview (Front & Back Side-by-Side) -->
        <div class="nid-card-print-container flex flex-col md:flex-row items-center justify-center gap-5 my-2">
          
          <!-- FRONT SIDE -->
          <div class="nid-card-frame shadow-md select-none p-2 flex flex-col justify-between">
            <!-- Background Guilloche Watermark Seal -->
            <svg class="nid-watermark-seal" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#006a4e" stroke-width="1.5" stroke-dasharray="2 2" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#c8102e" stroke-width="1" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="#c9a030" stroke-width="1.5" stroke-dasharray="3 2" />
              <circle cx="50" cy="50" r="22" fill="#c8102e" opacity="0.12" />
            </svg>

            <!-- Card Header -->
            <div class="flex items-center justify-center gap-2 relative z-10 border-b border-black/20 pb-1 pt-0.5">
              <!-- Official Bangladesh Emblem Seal -->
              <svg class="w-8 h-8 flex-shrink-0" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="#c8102e" stroke="#006a4e" stroke-width="3" />
                <circle cx="50" cy="50" r="41" fill="none" stroke="#ffcc00" stroke-width="2.5" stroke-dasharray="3,3" />
                <!-- Water Lily (Shapla) -->
                <path d="M50 25 C45 38 43 55 50 64 C57 55 55 38 50 25 Z" fill="#ffffff" />
                <path d="M38 32 C38 46 42 58 50 64 C44 56 41 44 38 32 Z" fill="#ffffff" />
                <path d="M62 32 C62 46 58 58 50 64 C56 56 59 44 62 32 Z" fill="#ffffff" />
                <!-- Waves -->
                <path d="M28 66 Q39 62 50 66 T72 66" fill="none" stroke="#ffffff" stroke-width="3" />
                <path d="M32 72 Q41 68 50 72 T68 72" fill="none" stroke="#ffffff" stroke-width="2.5" />
                <!-- Stars -->
                <text x="32" y="22" fill="#ffffff" font-size="7" font-weight="bold" text-anchor="middle">★</text>
                <text x="44" y="16" fill="#ffffff" font-size="7" font-weight="bold" text-anchor="middle">★</text>
                <text x="56" y="16" fill="#ffffff" font-size="7" font-weight="bold" text-anchor="middle">★</text>
                <text x="68" y="22" fill="#ffffff" font-size="7" font-weight="bold" text-anchor="middle">★</text>
              </svg>

              <div class="text-center flex-1 pr-1">
                <div style="color: #006a4e; font-weight: 700; font-size: 12.5px; line-height: 1.15; font-family: 'Hind Siliguri', sans-serif;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
                <div style="color: #006a4e; font-weight: 600; font-size: 8px; line-height: 1.15; font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: 0.1px;">Government of the People's Republic of Bangladesh</div>
                <div style="color: #c8102e; font-weight: 700; font-size: 9.5px; line-height: 1.15; margin-top: 1px; font-family: 'Hind Siliguri', sans-serif;">National ID Card / জাতীয় পরিচয় পত্র</div>
              </div>
            </div>

            <!-- Card Body: Left (Photo + Sign) & Right (Info Rows) -->
            <div class="flex gap-2 items-start relative z-10 flex-1 pt-1">
              <!-- Left: Photo + Sign -->
              <div class="flex flex-col items-center flex-shrink-0" style="width: 72px;">
                <div style="width: 72px; height: 86px; border: 1px solid #444; background: #fff; overflow: hidden; border-radius: 2px;">
                  <img src="${certData.photo}" alt="NID Photo" class="w-full h-full object-cover">
                </div>
                <div style="width: 72px; height: 20px; margin-top: 2px; display: flex; align-items: center; justify-content: center;">
                  <img src="${certData.sign}" alt="Signature" class="max-w-full max-h-full object-contain">
                </div>
              </div>

              <!-- Right: Info Rows -->
              <div class="flex-1 space-y-0.5 pt-0.5" style="font-size: 10px; line-height: 1.25; color: #111;">
                <div class="flex items-baseline" style="margin-bottom: 2px;">
                  <span style="width: 42px; flex-shrink: 0; color: #111; font-weight: 500;">নাম:</span>
                  <strong style="font-size: 11px; color: #000; font-weight: 700; font-family: 'Hind Siliguri', sans-serif;">${certData.name_bn}</strong>
                </div>
                <div class="flex items-baseline" style="margin-bottom: 2px;">
                  <span style="width: 42px; flex-shrink: 0; color: #111; font-weight: 500;">Name:</span>
                  <strong style="font-size: 9.5px; color: #000; font-weight: 600; font-family: 'Segoe UI', Arial, sans-serif;">${certData.name_en}</strong>
                </div>
                <div class="flex items-baseline" style="margin-bottom: 2px;">
                  <span style="width: 42px; flex-shrink: 0; color: #111; font-weight: 500;">পিতা:</span>
                  <span style="font-size: 9.5px; font-weight: 600; color: #111;">${certData.father_name}</span>
                </div>
                <div class="flex items-baseline" style="margin-bottom: 2px;">
                  <span style="width: 42px; flex-shrink: 0; color: #111; font-weight: 500;">মাতা:</span>
                  <span style="font-size: 9.5px; font-weight: 600; color: #111;">${certData.mother_name}</span>
                </div>
                <div class="flex items-baseline" style="margin-top: 3px; margin-bottom: 2px;">
                  <span style="color: #111; margin-right: 4px; font-size: 9px; font-weight: 500;">Date of Birth:</span>
                  <strong style="color: #c8102e; font-size: 10px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif;">${certData.dob}</strong>
                </div>
                <div class="flex items-baseline" style="margin-top: 2px;">
                  <span style="color: #111; margin-right: 4px; font-size: 9.5px; font-weight: 500;">ID NO:</span>
                  <strong style="color: #c8102e; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; font-family: 'Courier New', monospace;">${certData.reg_no}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- BACK SIDE -->
          <div class="nid-card-frame shadow-md select-none flex flex-col justify-between" style="padding: 2px 0;">
            <!-- Background Guilloche Watermark Seal -->
            <svg class="nid-watermark-seal" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#006a4e" stroke-width="1.5" stroke-dasharray="2 2" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#c8102e" stroke-width="1" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="#c9a030" stroke-width="1.5" stroke-dasharray="3 2" />
              <circle cx="50" cy="50" r="22" fill="#c8102e" opacity="0.12" />
            </svg>

            <!-- Top Notice Box -->
            <div style="border-bottom: 0.75px solid #333; padding: 3px 6px; font-size: 7.5px; line-height: 1.25; text-align: center; color: #111;" class="relative z-10">
              এই কার্ডটি গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের সম্পত্তি। কার্ডটি ব্যবহারকারী ব্যতীত অন্য কোথাও<br>
              পাওয়া গেলে নিকটস্থ পোস্ট অফিসে জমা দেবার জন্য অনুরোধ করা হলো।
            </div>

            <!-- Middle Address (স্থায়ী ঠিকানা) -->
            <div style="padding: 3px 8px; font-size: 8px; line-height: 1.35; color: #111;" class="relative z-10 flex-1">
              <span style="font-weight: 700;">ঠিকানা:</span> ${certData.address}
            </div>

            <!-- Blood Group, Birth Place & Print Count Row -->
            <div style="padding: 2px 8px; font-size: 8px; line-height: 1.25; color: #111; border-top: 0.5px solid rgba(0,0,0,0.25);" class="relative z-10 flex items-center justify-between">
              <div>
                <span>রক্তের গ্রুপ / Blood Group: </span>
                <strong style="color: #c8102e; font-weight: 700;">${certData.gender_blood || 'AB+'}</strong>
                <span style="margin-left: 8px;">জন্মস্থান: </span>
                <span style="font-weight: 600;">${certData.birth_place || 'কিশোরগঞ্জ'}</span>
              </div>
              <div style="font-weight: 700; font-size: 7.5px;">
                মুদ্রণ: ০১
              </div>
            </div>

            <!-- Signatures & Issue Date Row -->
            <div style="padding: 2px 8px 3px 8px; font-size: 7.5px; color: #111;" class="relative z-10 flex items-end justify-between">
              <!-- Official Authority Signature -->
              <div class="text-center" style="width: 110px;">
                <div style="height: 20px; display: flex; align-items: center; justify-content: center;">
                  <svg class="h-5 w-24" viewBox="0 0 120 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 21 C16 15, 18 5, 24 3 C28 2, 30 7, 28 13 C26 19, 20 22, 16 23 C24 23, 34 14, 42 9 C48 5, 52 11, 50 16 C48 21, 40 24, 46 23 C54 21, 62 13, 70 8 C76 4, 82 10, 78 17 C84 14, 94 11, 106 7" stroke="#111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M20 18 Q50 20 80 17 T114 14" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div style="font-size: 7px; font-weight: 600; border-top: 0.5px solid #222; padding-top: 1px;">
                  প্রদানকারী কর্তৃপক্ষের স্বাক্ষর
                </div>
              </div>

              <!-- Issue Date -->
              <div style="font-size: 8px; font-weight: 600; padding-bottom: 2px;">
                প্রদানের তারিখ: <span style="font-weight: 700;">${certData.issue_date}</span>
              </div>
            </div>

            <!-- Bottom 2D PDF417 Barcode -->
            <div style="padding: 1px 4px 3px 4px;" class="relative z-10">
              <canvas id="nid-barcode-canvas" style="width: 100%; height: 34px; image-rendering: pixelated; display: block;"></canvas>
            </div>
          </div>
        </div>
      `
    } else {
      innerHtml = `
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
    }

    qs('#cert-inner-html').innerHTML = innerHtml

    // Render Barcode or QR Code
    setTimeout(() => {
      if (isNid) {
        const barcodeCanvas = qs('#nid-barcode-canvas')
        if (barcodeCanvas) {
          const barcodeXml = generateNidBarcodeXml(certData)
          renderNidPdf417(barcodeCanvas, barcodeXml)
        }
      } else {
        const qrCanvas = qs('#cert-qr-canvas')
        if (qrCanvas && window.QRCode) {
          const verifyUrl = `https://bdris.gov.bd/certificate/verify?ubrn=${certData.reg_no}&dob=${certData.dob}`
          window.QRCode.toCanvas(qrCanvas, verifyUrl, { width: 80, margin: 1 }, (err) => {
            if (err) console.error('QR code generation error:', err)
          })
        }
      }
    }, 40)
  }

  function generateNidBarcodeXml(certData) {
    const pin = certData.book_no || certData.reg_no || '19754814243000004'
    const name = (certData.name_en || 'MD. AMRAN KABIR RIPON').toUpperCase().trim()
    const dob = formatNidDob(certData.dob) || '08 Aug 1975'
    const ds = '302c0214103fc01240542ed736c0b48858c1c03d80006215021416e73728de9618fedcd368c88d8f3a2e72096d'
    return `<pin>${pin}</pin><name>${name}</name><DOB>${dob}</DOB><FP></FP><F>Right Index</F><TYPE></TYPE><V>2.0</V><ds>${ds}</ds>`
  }

  function formatNidDob(raw) {
    if (!raw) return ''
    const bnToEn = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' }
    const cleaned = String(raw).replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch).trim()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    if (/[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4}/.test(cleaned)) return cleaned
    const m1 = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (m1) {
      const y = m1[1]
      const mon = parseInt(m1[2], 10) - 1
      const d = String(parseInt(m1[3], 10)).padStart(2, '0')
      if (months[mon]) return `${d} ${months[mon]} ${y}`
    }
    const m2 = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
    if (m2) {
      const d = String(parseInt(m2[1], 10)).padStart(2, '0')
      const mon = parseInt(m2[2], 10) - 1
      const y = m2[3]
      if (months[mon]) return `${d} ${months[mon]} ${y}`
    }
    return cleaned
  }

  function formatBanglaDate(dateStr) {
    if (!dateStr) return ''
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
    return dateStr.replace(/\d/g, (d) => bnDigits[parseInt(d, 10)])
  }

  function renderNidPdf417(canvas, barcodeXml, attempt = 0) {
    if (!canvas) return
    if (window.bwipjs && typeof window.bwipjs.toCanvas === 'function') {
      try {
        window.bwipjs.toCanvas(canvas, {
          bcid: 'pdf417',
          text: barcodeXml,
          scale: 2,
          height: 12,
          columns: 12,
          eclevel: 5,
          includetext: false,
        })
        return
      } catch (err1) {
        try {
          window.bwipjs.toCanvas(canvas, {
            bcid: 'pdf417',
            text: barcodeXml,
            scale: 2,
            height: 12,
            columns: 10,
            eclevel: 5,
            includetext: false,
          })
          return
        } catch (err2) {
          console.error('bwip-js PDF417 render failed:', err2)
        }
      }
    }
    if (attempt < 15) {
      setTimeout(() => renderNidPdf417(canvas, barcodeXml, attempt + 1), 60)
    }
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

  // Real-time live preview update
  orderForm.addEventListener('input', () => {
    if (!previewModal.classList.contains('hidden')) {
      renderLiveCertificate()
    }
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
async function extractCitizenImagesFromPdf(arrayBuffer, pdf) {
  let photoDataUrl = ''
  let signDataUrl = ''

  // Step 1: Direct Binary JPEG Stream Scanner (Extracts raw embedded JPEG images instantly)
  try {
    const bytes = new Uint8Array(arrayBuffer)
    const len = bytes.length
    const candidates = []

    for (let i = 0; i < len - 4; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        const start = i
        let end = -1
        for (let j = i + 3; j < len - 1; j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            end = j + 2
            break
          }
        }
        if (end !== -1 && (end - start) > 400) {
          const slice = bytes.slice(start, end)
          try {
            const blob = new Blob([slice], { type: 'image/jpeg' })
            const dataUrl = await new Promise((res) => {
              const r = new FileReader()
              r.onload = () => res(r.result)
              r.onerror = () => res('')
              r.readAsDataURL(blob)
            })
            if (dataUrl) {
              const dims = await new Promise((res) => {
                const img = new Image()
                img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight, dataUrl, size: slice.length })
                img.onerror = () => res(null)
                img.src = dataUrl
              })
              if (dims && dims.width > 20 && dims.height > 20) {
                candidates.push(dims)
              }
            }
          } catch (e) {}
          i = end
        }
      }
    }

    if (candidates.length > 0) {
      const signatures = candidates.filter((c) => (c.width / c.height >= 1.25) || (c.height <= 85 && c.width > c.height))
      const portraits = candidates.filter((c) => (c.width / c.height < 1.25) && c.width >= 40 && c.height >= 40)

      if (portraits.length > 0) {
        portraits.sort((a, b) => (b.width * b.height) - (a.width * a.height))
        photoDataUrl = portraits[0].dataUrl
      }
      if (signatures.length > 0) {
        signatures.sort((a, b) => (b.width / b.height) - (a.width / a.height))
        signDataUrl = signatures[0].dataUrl
      }

      if (photoDataUrl && signDataUrl) {
        return { photoDataUrl, signDataUrl }
      }
    }
  } catch (rawErr) {
    console.warn('Binary JPEG extraction notice:', rawErr)
  }

  // Step 2: PDF.js Operator List & Decoded Objects (Handles PNG, FlateDecode, and masked images)
  try {
    if (pdf && pdf.numPages > 0) {
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      // Rendering ensures all image resources are decoded into page.objs
      await page.render({ canvasContext: ctx, viewport }).promise

      const ops = await page.getOperatorList()
      const decodedImages = []

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]
        if (fn === window.pdfjsLib.OPS.paintImageXObject || fn === window.pdfjsLib.OPS.paintJpegXObject) {
          const imgName = ops.argsArray[i][0]
          const imgObj = await new Promise((res) => {
            try {
              if (page.objs && page.objs.has && page.objs.has(imgName)) {
                page.objs.get(imgName, res)
              } else if (page.commonObjs && page.commonObjs.has && page.commonObjs.has(imgName)) {
                page.commonObjs.get(imgName, res)
              } else {
                res(null)
              }
            } catch (e) {
              res(null)
            }
          })

          if (imgObj && imgObj.width > 20 && imgObj.height > 20 && imgObj.data) {
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = imgObj.width
            tempCanvas.height = imgObj.height
            const tCtx = tempCanvas.getContext('2d')
            const imgData = tCtx.createImageData(imgObj.width, imgObj.height)

            if (imgObj.kind === 1) { // Grayscale
              let s = 0, d = 0
              for (let j = 0; j < imgObj.width * imgObj.height; j++) {
                const v = imgObj.data[s++]
                imgData.data[d++] = v
                imgData.data[d++] = v
                imgData.data[d++] = v
                imgData.data[d++] = 255
              }
            } else { // RGB or RGBA
              let s = 0, d = 0
              for (let j = 0; j < imgObj.width * imgObj.height; j++) {
                imgData.data[d++] = imgObj.data[s++]
                imgData.data[d++] = imgObj.data[s++]
                imgData.data[d++] = imgObj.data[s++]
                imgData.data[d++] = (imgObj.kind === 3 && imgObj.data[s] !== undefined) ? imgObj.data[s++] : 255
              }
            }
            tCtx.putImageData(imgData, 0, 0)
            const dUrl = tempCanvas.toDataURL('image/jpeg', 0.95)
            decodedImages.push({ width: imgObj.width, height: imgObj.height, dataUrl: dUrl })
          }
        }
      }

      if (!photoDataUrl || !signDataUrl) {
        const sigs = decodedImages.filter((c) => (c.width / c.height >= 1.25) || (c.height <= 85 && c.width > c.height))
        const ports = decodedImages.filter((c) => (c.width / c.height < 1.25) && c.width >= 40 && c.height >= 40)
        if (!photoDataUrl && ports.length > 0) {
          ports.sort((a, b) => (b.width * b.height) - (a.width * a.height))
          photoDataUrl = ports[0].dataUrl
        }
        if (!signDataUrl && sigs.length > 0) {
          sigs.sort((a, b) => (b.width / b.height) - (a.width / a.height))
          signDataUrl = sigs[0].dataUrl
        }
      }

      // Step 3: High-precision CMS copy canvas crop fallback
      // In CMS copy PDFs, the photo is located at top-right (x: 72% to 95%, y: 6% to 26%)
      if (!photoDataUrl && canvas.width > 200 && canvas.height > 200) {
        try {
          const cropW = Math.round(canvas.width * 0.22)
          const cropH = Math.round(canvas.height * 0.18)
          const cropX = Math.round(canvas.width * 0.74)
          const cropY = Math.round(canvas.height * 0.08)
          const cropC = document.createElement('canvas')
          cropC.width = cropW
          cropC.height = cropH
          const cCtx = cropC.getContext('2d')
          cCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
          photoDataUrl = cropC.toDataURL('image/jpeg', 0.95)
        } catch (cropErr) {
          console.warn('Canvas crop fallback notice:', cropErr)
        }
      }
    }
  } catch (objErr) {
    console.warn('PDF.js image decoding notice:', objErr)
  }

  return { photoDataUrl, signDataUrl }
}

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

      // Extract citizen photo and signature using multi-engine extraction
      const extractedImages = await extractCitizenImagesFromPdf(arrayBuffer, pdf)
      if (extractedImages.photoDataUrl) {
        result.photoDataUrl = extractedImages.photoDataUrl
      }
      if (extractedImages.signDataUrl) {
        result.signDataUrl = extractedImages.signDataUrl
      }

      if (combinedText.trim()) {
        const bnToEn = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' }
        const text = combinedText

        // 1. National ID (10 to 17 digits, e.g. 3738061542)
        const nidMatch = text.match(/(?:National\s*ID|জাতীয়\s*পরিচয়পত্র\s*নম্বর|জাতীয়\s*পরিচয়পত্র\s*নং|জাতীয়\s*পরিচয়পত্র|এনআইডি\s*নম্বর|এনআইডি\s*নং|এনআইডি|NID\s*No|NID)[\s:.-]*([0-9০-৯]{10,17})/i)
        if (nidMatch) {
          result.registration_no = nidMatch[1].replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch)
        } else {
          const smartMatch = text.match(/\b([0-9]{10})\b/)
          if (smartMatch) result.registration_no = smartMatch[1]
        }

        // 2. PIN No (17 digits, e.g. 19754814243000004)
        const pinMatch = text.match(/(?:Pin|পিন\s*নম্বর|পিন\s*নং|পিন|PIN\s*No|PIN|Book)[\s:.-]*([0-9০-৯]{17})/i)
        if (pinMatch) {
          result.book_no = pinMatch[1].replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch)
        } else {
          const seventeen = text.match(/\b(19\d{15}|20\d{15})\b/)
          if (seventeen) result.book_no = seventeen[1]
        }

        // Cross fallback ensuring neither registration_no nor book_no is blank
        if (!result.registration_no && result.book_no) {
          result.registration_no = result.book_no
        }
        if (!result.book_no && result.registration_no) {
          result.book_no = result.registration_no
        }
        if (!result.registration_no) {
          const anyNum = text.match(/\b([0-9]{10,17})\b/)
          if (anyNum) {
            result.registration_no = anyNum[1]
            result.book_no = anyNum[1]
          } else if (file?.name) {
            const fnMatch = file.name.match(/\b([0-9]{10,17})\b/)
            if (fnMatch) {
              result.registration_no = fnMatch[1]
              result.book_no = fnMatch[1]
            }
          }
        }

        // 3. Name (Bangla)
        const bnMatch = text.match(/(?:Name\s*\(Bangla\)|নাম\s*\(বাংলা\)|ব্যক্তির\s*নাম|নাম)[\s:.-]*([ঀ-৿\s.]{3,40})/i)
        if (bnMatch) {
          result.name_bn = bnMatch[1].trim()
        } else {
          const bnAny = text.match(/([ঀ-৿]{2,}\s+[ঀ-৿]{2,}(?:\s+[ঀ-৿]{2,})?)/)
          if (bnAny) result.name_bn = bnAny[1].trim()
        }

        // 4. Name (English)
        const enMatch = text.match(/(?:Name\s*\(English\)|নাম\s*\(ইংরেজি\)|Name\s*in\s*English|Name)[\s:.-]*([A-Za-z\s.]{3,40})/i)
        if (enMatch) {
          result.name_en = enMatch[1].trim()
        } else {
          const enAny = text.match(/([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){1,4})/)
          if (enAny) result.name_en = enAny[1].trim()
        }

        // 5. Date of Birth (support YYYY-MM-DD, DD-MM-YYYY, DD Mon YYYY)
        const dobMatch = text.match(/(?:Date\s*of\s*Birth|জন্ম\s*তারিখ|DOB)[\s:.-]*([0-9০-৯]{4}[-\/.][0-9০-৯]{1,2}[-\/.][0-9০-৯]{1,2}|[0-9০-৯]{1,2}[-\/.\s](?:[0-9০-৯]{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/.\s][0-9০-৯]{4})/i) ||
          text.match(/\b([0-9০-৯]{4}[-\/.][0-9০-৯]{1,2}[-\/.][0-9০-৯]{1,2})\b/) ||
          text.match(/\b([0-9০-৯]{1,2}[-\/.\s](?:[0-9০-৯]{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/.\s][0-9০-৯]{4})\b/)
        if (dobMatch) {
          result.dob = formatNidDob(dobMatch[1])
        }

        // 6. Birth Place
        const bpMatch = text.match(/(?:Birth\s*Place|জন্মস্থান|Place\s*of\s*Birth)[\s:.-]*([ঀ-৿A-Za-z\s,]{3,30})/i)
        if (bpMatch) result.birth_place = bpMatch[1].trim()

        // 7. Father Name
        const fMatch = text.match(/(?:Father\s*Name|পিতার\s*নাম|পিতা|Father)[\s:.-]*([ঀ-৿\s.]{3,35})/i)
        if (fMatch) result.father_name_bn = fMatch[1].trim()

        // 8. Mother Name
        const mMatch = text.match(/(?:Mother\s*Name|মাতার\s*নাম|মাতা|Mother)[\s:.-]*([ঀ-৿\s.]{3,35})/i)
        if (mMatch) result.mother_name_bn = mMatch[1].trim()

        // 9. Blood Group
        const bgMatch = text.match(/(?:Blood\s*Group|রক্তের\s*গ্রুপ)[\s:.-]*\b(A\+|A-|B\+|B-|O\+|O-|AB\+|AB-)\b/i) ||
          text.match(/\b(A\+|A-|B\+|B-|O\+|O-|AB\+|AB-)\b/)
        if (bgMatch) result.gender_blood = bgMatch[1]

        // 10. Permanent Address from CMS Copy Table
        const holdingMatch = text.match(/(?:Home\/Holding\s*No|বাসা\/হোল্ডিং)[\s:.-]*([^\n,]{1,20})/i)
        const addlVillageMatch = text.match(/(?:Additional\s*Village\/Road|অতিরিক্ত\s*গ্রাম\/রাস্তা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,40})/i)
        const mouzaMatch = text.match(/(?:Mouza\/Moholla|মৌজা\/মহল্লা|গ্রাম\/রাস্তা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,40})/i)
        const poMatch = text.match(/(?:Post\s*Office|ডাকঘর)[\s:.-]*([ঀ-৿A-Za-z\s]{2,40})/i)
        const pcMatch = text.match(/(?:Postal\s*Code|পোস্ট\s*কোড)[\s:.-]*([0-9০-৯]{4})/i)
        const upoMatch = text.match(/(?:Upozila|Upazila|উপজেলা|থানা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,30})/i)
        const distMatch = text.match(/(?:District|জেলা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,30})/i)

        if (poMatch || mouzaMatch || upoMatch || distMatch) {
          const parts = []
          const holding = holdingMatch ? holdingMatch[1].trim() : ''
          const holdingStr = (!holding || holding === '-' || holding === 'None' || holding === 'null') ? '' : holding
          parts.push(`বাসা/হোল্ডিং: ${holdingStr}`)
          const vList = [addlVillageMatch?.[1]?.trim(), mouzaMatch?.[1]?.trim()].filter(Boolean)
          if (vList.length > 0) parts.push(`গ্রাম/রাস্তা: ${vList.join(', ')}`)
          if (poMatch) {
            const po = poMatch[1].trim()
            const pc = pcMatch ? pcMatch[1].trim() : ''
            parts.push(`ডাকঘর: ${po}${pc ? ' - ' + pc : ''}`)
          }
          if (upoMatch) parts.push(upoMatch[1].trim())
          if (distMatch) parts.push(distMatch[1].trim())
          result.address = parts.join(', ')
        } else {
          const permMatch = text.match(/(?:Permanent\s*Address|স্থায়ী\s*ঠিকানা|স্থায়ী\s*ঠিকানা)[\s:.-]*([ঀ-৿A-Za-z0-9\s,:.-]{10,140})/i)
          if (permMatch) {
            result.address = permMatch[1].trim()
          } else {
            const addrMatch = text.match(/(?:ঠিকানা|Address)[\s:.-]*([ঀ-৿A-Za-z0-9\s,:.-]{8,120})/i)
            if (addrMatch) result.address = addrMatch[1].trim()
          }
        }

        // 11. Issue Date extraction (Search for explicit print/issue date or any non-DOB date)
        const issueMatch = text.match(/(?:প্রদানের\s*তারিখ|ইস্যুর\s*তারিখ|ইস্যু\s*তারিখ|Print\s*Date|Generation\s*Date|Issue\s*Date)[\s:.-]*([0-9০-৯]{1,2}[-\/.][0-9০-৯]{1,2}[-\/.][0-9০-৯]{4})/i)
        if (issueMatch) {
          result.issue_date = issueMatch[1].replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch).replace(/[-.]/g, '/')
        } else {
          const allDates = text.match(/\b([0-9০-৯]{1,2}[-\/.][0-9০-৯]{1,2}[-\/.][0-9০-৯]{4})\b/g) || []
          for (const dStr of allDates) {
            const norm = dStr.replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch).replace(/[-.]/g, '/')
            const dobNorm = (result.dob || '').replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch).replace(/[-.]/g, '/')
            if (!dobNorm.includes(norm)) {
              result.issue_date = norm
              break
            }
          }
        }

        if (!result.issue_date) {
          result.issue_date = dayjs().format('DD/MM/YYYY')
        }
      }
    }
  } catch (err) {
    console.warn('extractDataFromPdf error:', err)
  }

  return result
}

function getDefaultExtractedData() {
  return {
    name_bn: '',
    name_en: '',
    registration_no: '',
    book_no: '',
    father_name_bn: '',
    mother_name_bn: '',
    birth_place: '',
    dob: '',
    gender_blood: '',
    issue_date: '',
    address: '',
    photoDataUrl: '',
    signDataUrl: '',
  }
}

