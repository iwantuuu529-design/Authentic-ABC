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
  const sampleNidSign = '/static/img/sample_nid_sign_ripon.svg'
  const defaultBdGovtLogo = '/static/img/bd_govt_logo.svg'
  const defaultBdWatermark = '/static/img/bd_nid_watermark.svg'

  let uploadedPdfFile = null
  let photoBase64 = isNid ? sampleNidPhoto : ''
  let signBase64 = isNid ? sampleNidSign : ''
  let logoBase64 = isNid ? defaultBdGovtLogo : ''
  let watermarkBase64 = isNid ? defaultBdWatermark : ''

  // Fallback / default images (real photo, ink signature, logo, watermark)
  const defaultPhoto = sampleNidPhoto
  const defaultSign = sampleNidSign
  const defaultLogo = defaultBdGovtLogo
  const defaultWatermark = defaultBdWatermark

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
      <!-- Super Fast Auto Badge -->
      <div class="flex justify-center mb-6">
        <span class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black shadow-md shadow-emerald-500/20 uppercase tracking-wide">
          <i class="fa-solid fa-bolt text-amber-300 text-sm animate-pulse"></i> অটো সার্ভিস (AUTO SERVICE) • তাত্ক্ষণিক ডেলিভারি
        </span>
      </div>

      <!-- Step 1: Drag-and-drop / Browse PDF or Image Box -->
      <div id="super-pdf-dropzone" class="border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-500/[0.03] hover:bg-sky-500/[0.08] rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer relative group">
        <div class="w-16 h-16 rounded-full bg-sky-500/15 group-hover:bg-sky-500/25 flex items-center justify-center mx-auto mb-4 text-sky-400 group-hover:text-sky-300 group-hover:scale-110 transition-all shadow-lg shadow-sky-500/15">
          <i class="fa-solid fa-cloud-arrow-up text-2xl"></i>
        </div>
        <p class="text-base sm:text-lg font-bold text-white mb-1">CMS কপি বা এনআইডি ফাইল আপলোড করুন</p>
        <p class="text-xs text-slate-300 mb-3">CMS কপি, অনলাইন কপি, স্লিপ পিডিএফ বা স্ক্রিনশট ইমেজ নির্বাচন করলেই সকল তথ্য, ছবি ও স্বাক্ষর অটোমেটিকভাবে নিচে পূরণ হবে</p>
        <button type="button" id="btn-browse-pdf" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs sm:text-sm font-bold border border-sky-500/30 transition-all">
          <i class="fa-solid fa-file-arrow-up"></i> CMS কপি / পিডিএফ / ইমেজ নির্বাচন করুন
        </button>
        <input type="file" id="super-pdf-file-input" accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp" class="hidden">

        <!-- Selected File Pill -->
        <div id="selected-file-badge" class="hidden mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-semibold border border-sky-500/30">
          <i class="fa-solid fa-file-lines"></i>
          <span id="selected-file-name">file.pdf</span>
          <button type="button" id="btn-reupload-pdf" class="ml-2 text-slate-400 hover:text-white" title="অন্য ফাইল বেছে নিন">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      ${isNid ? `
      <!-- Quick Demo Clone Action -->
      <div class="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <button type="button" id="btn-load-sample-nid-1" class="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer">
          <i class="fa-solid fa-id-card text-sky-400 text-sm"></i> নমুনা ১: নুরুন নাহার (CMS অনলাইন কপি)
        </button>
        <button type="button" id="btn-load-sample-nid-2" class="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer">
          <i class="fa-solid fa-id-card text-emerald-400 text-sm"></i> নমুনা ২: মোঃ এমরান কবির রিপন (CMS কপি ক্লোন)
        </button>
      </div>

      <!-- Option to Paste Raw CMS Data -->
      <div class="mt-3 border border-white/10 rounded-xl bg-white/[0.02] overflow-hidden">
        <button type="button" id="btn-toggle-cms-paste" class="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:text-white font-semibold transition-colors">
          <span class="flex items-center gap-2">
            <i class="fa-solid fa-clipboard text-sky-400"></i> নির্বাচন কমিশন পোর্টাল থেকে কপি করা CMS টেক্সট পেস্ট করুন
          </span>
          <i id="cms-paste-icon" class="fa-solid fa-chevron-down text-slate-400 transition-transform"></i>
        </button>
        <div id="cms-paste-panel" class="hidden p-4 border-t border-white/5 space-y-3">
          <textarea id="cms-raw-text-input" rows="4" placeholder="নির্বাচন কমিশন পোর্টাল থেকে কপি করা CMS তথ্য এখানে পেস্ট করুন (যেমন: National ID 2429358167, Name(Bangla) নুরুন নাহার, Home/Holding No ৪৭৩, Village/Road উত্তমপুর...)" class="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500/50 outline-none font-mono"></textarea>
          <div class="flex justify-end gap-2">
            <button type="button" id="btn-parse-cms-text" class="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors flex items-center gap-2">
              <i class="fa-solid fa-wand-magic-sparkles"></i> CMS টেক্সট থেকে ডাটা অটো-ফিল করুন
            </button>
          </div>
        </div>
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
          <!-- Images Row (Photo, Signature, and Logo) -->
          <div class="grid grid-cols-1 ${isNid ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
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
                  <p class="text-[11px] text-slate-500">পিডিএফ থেকে ছবি না পেলে নির্বাচন করুন</p>
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

            ${isNid ? `
            <!-- Government Logo (From PDF or Official Emblem) -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-300">
                জাতীয় লোগো (মনোগ্রাম)
              </label>
              <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-full bg-white border border-white/10 overflow-hidden flex items-center justify-center shrink-0 p-1 shadow-sm">
                  <img id="form-logo-preview" src="${defaultLogo}" alt="লোগো" class="w-full h-full object-contain">
                </div>
                <div class="space-y-1.5 flex-1">
                  <input type="file" id="form-logo-input" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer">
                  <p class="text-[11px] text-emerald-400 font-medium">পিডিএফ এর আসল মনোগ্রাম স্বয়ংক্রিয় ব্যবহৃত</p>
                </div>
              </div>
            </div>
            ` : ''}
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
            <i class="fa-solid fa-bolt text-emerald-400 mt-0.5 text-sm shrink-0"></i>
            <div>
              <span class="font-bold block mb-0.5">স্বয়ংক্রিয় অটো সার্ভিস ফি:</span>
              <span class="font-medium">${escapeHtml(chargeNote)}</span>
            </div>
          </div>

          <!-- Submit Button -->
          <button type="submit" id="btn-super-submit" class="btn-glow w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white font-black py-4 rounded-xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 text-base transition-all cursor-pointer">
            <i class="fa-solid fa-bolt text-amber-300 text-lg"></i> ${isNid ? `Create NID (৳${toBnDigits(serviceCharge)} অটো কাটবে)` : `অর্ডার কনফার্ম করুন (৳${toBnDigits(serviceCharge)})`}
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
            <button type="button" id="btn-cert-download-pdf" class="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
              <i class="fa-solid fa-file-arrow-down"></i> PDF ডাউনলোড
            </button>
            <button type="button" id="btn-cert-print" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
              <i class="fa-solid fa-print"></i> প্রিন্ট করুন
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
  const logoInput = qs('#form-logo-input')
  const logoPreview = qs('#form-logo-preview')
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

  // User selects custom photo / signature / logo
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

  signInput.addEventListener('change', async () => {
    const file = signInput.files && signInput.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const raw = ev.target.result
        signBase64 = await cleanSignatureTransparency(raw)
        signPreview.src = signBase64
      }
      reader.readAsDataURL(file)
    }
  })

  if (logoInput) {
    logoInput.addEventListener('change', () => {
      const file = logoInput.files && logoInput.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          logoBase64 = ev.target.result
          if (logoPreview) logoPreview.src = logoBase64
        }
        reader.readAsDataURL(file)
      }
    })
  }

  function loadSampleNidCardData(sampleIndex = 1) {
    if (!isNid) return
    if (sampleIndex === 2) {
      // 100% Real profile from User CMS Screenshot: MD. AMRAN KABIR RIPON
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
      signBase64 = '/static/img/sample_nid_sign_ripon.svg'
      logoBase64 = defaultBdGovtLogo
      watermarkBase64 = defaultBdWatermark
    } else {
      // 100% Real profile from User CMS and Output files: Nurun Naher
      qs('#uf-name-bn').value = 'নুরুন নাহার'
      qs('#uf-name-en').value = 'NURUN NAHER'
      qs('#uf-reg-no').value = '2429358167'
      qs('#uf-book-no').value = '20040610727000601'
      qs('#uf-father-name').value = 'এস্কান্দার মোল্লা'
      qs('#uf-mother-name').value = 'তাছলিমা বেগম'
      qs('#uf-birth-place').value = 'বরিশাল'
      qs('#uf-dob').value = '10 Dec 2004'
      qs('#uf-gender-blood').value = ''
      qs('#uf-issue-date').value = '০৬/০৯/২০২৬'
      qs('#uf-address').value = 'বাসা/হোল্ডিং: ৪৭৩, গ্রাম/রাস্তা: উত্তমপুর, উত্তমপুর, ডাকঘর: উত্তমপুর - ৮২৮০, বাকেরগঞ্জ, বরিশাল'
      photoBase64 = '/static/img/nurun_naher_photo.jpg'
      signBase64 = '/static/img/sample_nid_sign.svg'
      logoBase64 = defaultBdGovtLogo
      watermarkBase64 = defaultBdWatermark
    }
    photoPreview.src = photoBase64
    signPreview.src = signBase64
    if (logoPreview) logoPreview.src = logoBase64
    formSection.classList.remove('hidden')
  }

  const sampleNidBtn1 = qs('#btn-load-sample-nid-1')
  if (sampleNidBtn1) {
    sampleNidBtn1.addEventListener('click', () => {
      loadSampleNidCardData(1)
      renderLiveCertificate()
      previewModal.classList.remove('hidden')
    })
  }

  const sampleNidBtn2 = qs('#btn-load-sample-nid-2')
  if (sampleNidBtn2) {
    sampleNidBtn2.addEventListener('click', () => {
      loadSampleNidCardData(2)
      renderLiveCertificate()
      previewModal.classList.remove('hidden')
    })
  }

  // Toggle CMS paste panel
  const toggleCmsBtn = qs('#btn-toggle-cms-paste')
  const cmsPastePanel = qs('#cms-paste-panel')
  const cmsPasteIcon = qs('#cms-paste-icon')
  if (toggleCmsBtn && cmsPastePanel) {
    toggleCmsBtn.addEventListener('click', () => {
      const isHidden = cmsPastePanel.classList.toggle('hidden')
      if (cmsPasteIcon) {
        cmsPasteIcon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)'
      }
    })
  }

  // Parse pasted CMS text
  const parseCmsBtn = qs('#btn-parse-cms-text')
  const cmsTextInput = qs('#cms-raw-text-input')
  if (parseCmsBtn && cmsTextInput) {
    parseCmsBtn.addEventListener('click', () => {
      const rawText = cmsTextInput.value.trim()
      if (!rawText) {
        showToast('অনুগ্রহ করে CMS তথ্য পেস্ট করুন', 'warning')
        return
      }
      const parsed = parseCmsRawText(rawText)
      if (parsed) {
        if (parsed.name_bn) qs('#uf-name-bn').value = parsed.name_bn
        if (parsed.name_en) qs('#uf-name-en').value = parsed.name_en
        if (parsed.registration_no) qs('#uf-reg-no').value = parsed.registration_no
        if (parsed.book_no) qs('#uf-book-no').value = parsed.book_no
        if (parsed.father_name_bn) qs('#uf-father-name').value = parsed.father_name_bn
        if (parsed.mother_name_bn) qs('#uf-mother-name').value = parsed.mother_name_bn
        if (parsed.birth_place) qs('#uf-birth-place').value = parsed.birth_place
        if (parsed.dob) qs('#uf-dob').value = parsed.dob
        if (parsed.gender_blood !== undefined) qs('#uf-gender-blood').value = parsed.gender_blood
        if (parsed.address) qs('#uf-address').value = parsed.address
        if (!qs('#uf-issue-date').value) qs('#uf-issue-date').value = formatBanglaDate(dayjs().format('DD/MM/YYYY'))

        formSection.classList.remove('hidden')
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        showToast('CMS টেক্সট থেকে সকল ডাটা সফলভাবে অটো-ফিল করা হয়েছে!', 'success')
      } else {
        showToast('টেক্সট থেকে ডাটা সনাক্ত করা যায়নি। সঠিক তথ্য পেস্ট করুন।', 'error')
      }
    })
  }

  // Pre-fill sample clone on initial load for NID service
  if (isNid) {
    loadSampleNidCardData(1)
  }

  // ------------------------------------------------------------
  // Real API NID Extraction & Step Transition
  // ------------------------------------------------------------
  async function handlePdfFileSelection(file) {
    uploadedPdfFile = file
    fileNameEl.textContent = file.name
    fileBadge.classList.remove('hidden')

    // Show processing modal
    procModal.classList.remove('hidden')

    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    if (isImage) {
      try {
        const imgExtracted = await extractFromCmsImage(file)
        if (imgExtracted.photoDataUrl) {
          photoBase64 = imgExtracted.photoDataUrl
          photoPreview.src = photoBase64
        }
        if (imgExtracted.signDataUrl) {
          signBase64 = imgExtracted.signDataUrl
          signPreview.src = signBase64
        }
        procModal.classList.add('hidden')
        formSection.classList.remove('hidden')
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        showToast('CMS ইমেজ থেকে ছবি ও স্বাক্ষর সফলভাবে এক্সট্র্যাক্ট করা হয়েছে!', 'success')
        return
      } catch (imgErr) {
        console.warn('Image extraction notice:', imgErr)
      }
    }

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
          logoDataUrl: extracted?.logoDataUrl || parsed.logoDataUrl || '',
          watermarkDataUrl: extracted?.watermarkDataUrl || parsed.watermarkDataUrl || '',
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
          logoDataUrl: '',
          watermarkDataUrl: '',
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
      if (extracted.logoDataUrl) {
        logoBase64 = extracted.logoDataUrl
        if (logoPreview) logoPreview.src = logoBase64
      }
      if (extracted.watermarkDataUrl) {
        watermarkBase64 = extracted.watermarkDataUrl
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

    // Extract CMS copy Address (Present Address / বর্তমান ঠিকানা ONLY for NID Card back)
    let addr = d.present_address || d.presentAddress || d.address || ''
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
  function getNidSecurityBg(watermarkUrl) {
    const wm = watermarkUrl || watermarkBase64 || defaultBdWatermark
    return `
      <!-- Guilloche Security Pattern Background -->
      <svg class="nid-guilloche-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324 204" preserveAspectRatio="none">
        <defs>
          <pattern id="nid-guilloche-pattern" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M 0 9 Q 4.5 0, 9 9 T 18 9" fill="none" stroke="#006a4e" stroke-width="0.32" opacity="0.08"/>
            <path d="M 0 4.5 Q 4.5 13.5, 9 4.5 T 18 4.5" fill="none" stroke="#c9a030" stroke-width="0.3" opacity="0.07"/>
            <circle cx="9" cy="9" r="7" fill="none" stroke="#006a4e" stroke-width="0.22" opacity="0.05" stroke-dasharray="1 1.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nid-guilloche-pattern)"/>
      </svg>
      <!-- Central 100% Authentic National Monogram Watermark Seal -->
      <div class="nid-watermark-seal">
        <img src="${wm}" alt="National Monogram Watermark" onerror="this.src='/static/img/bd_nid_watermark.png'">
      </div>
    `
  }

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
      name_bn: qs('#uf-name-bn').value || (isNid ? 'নুরুন নাহার' : ''),
      name_en: qs('#uf-name-en').value || (isNid ? 'NURUN NAHER' : ''),
      reg_no: cleanRegNo || (isNid ? '2429358167' : ''),
      book_no: qs('#uf-book-no').value || (isNid ? '20040610727000601' : ''),
      father_name: qs('#uf-father-name').value || (isNid ? 'এস্কান্দার মোল্লা' : ''),
      mother_name: qs('#uf-mother-name').value || (isNid ? 'তাছলিমা বেগম' : ''),
      birth_place: qs('#uf-birth-place').value || (isNid ? 'বরিশাল' : ''),
      dob: formattedDob || rawDob || (isNid ? '10 Dec 2004' : ''),
      gender_blood: qs('#uf-gender-blood').value || '',
      issue_date: issueDateBn || rawIssueDate || (isNid ? '০৬/০৯/২০২৬' : ''),
      address: cleanAddress || (isNid ? 'বাসা/হোল্ডিং: ৪৭৩, গ্রাম/রাস্তা: উত্তমপুর, উত্তমপুর, ডাকঘর: উত্তমপুর - ৮২৮০, বাকেরগঞ্জ, বরিশাল' : ''),
      photo: photoBase64 || '/static/img/nurun_naher_photo.jpg',
      sign: signBase64 || '/static/img/sample_nid_sign.svg',
      logo: logoBase64 || defaultBdGovtLogo,
      watermark: watermarkBase64 || defaultBdWatermark,
    }

    let innerHtml = ''

    if (isNid) {
      innerHtml = `
        <!-- NID Card Preview (Front & Back Side-by-Side Standard CR80: 85.6mm x 53.98mm) -->
        <div class="nid-cards-wrapper">
          
          <!-- FRONT SIDE -->
          <div class="nid-card-frame select-none flex flex-col justify-between" style="padding: 4.5px 8px 4.5px 8px; box-sizing: border-box;">
            <!-- Background Guilloche & Watermark -->
            ${getNidSecurityBg(certData.watermark)}

            <!-- Card Header -->
            <div class="flex items-center gap-2 relative z-10 pt-0.5" style="min-height: 38px;">
              <!-- Official Bangladesh Emblem Seal -->
              <div style="width: 35px; height: 35px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                <img src="${certData.logo}" alt="বাংলাদেশ সরকার" style="width: 35px; height: 35px; object-fit: contain; border-radius: 50%; display: block;" onerror="this.src='/static/img/bd_govt_logo.png'">
              </div>

              <div class="text-center flex-1" style="overflow: hidden;">
                <div style="color: #000000; font-weight: 700; font-size: 9.8pt; line-height: 1.15; font-family: 'Hind Siliguri', 'Kalpurush', 'SolaimanLipi', sans-serif; white-space: nowrap;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
                <div style="color: #006a4e; font-weight: 700; font-size: 6.8pt; line-height: 1.1; font-family: Arial, 'Segoe UI', sans-serif; letter-spacing: 0.1px; white-space: nowrap; margin-top: 1px;">Government of the People's Republic of Bangladesh</div>
                <div style="font-weight: 700; font-size: 7.8pt; line-height: 1.15; margin-top: 1px; font-family: 'Hind Siliguri', 'Kalpurush', 'SolaimanLipi', sans-serif; white-space: nowrap;">
                  <span style="color: #c8102e;">National ID Card</span> <span style="color: #006a4e;">/ জাতীয় পরিচয় পত্র</span>
                </div>
              </div>
            </div>

            <!-- Card Body: Left (Photo + Sign) & Right (Info Rows) -->
            <div class="flex gap-2 items-start relative z-10 flex-1 pt-1">
              <!-- Left: Photo + Citizen Signature -->
              <div class="flex flex-col items-center flex-shrink-0" style="width: 71px;">
                <div style="width: 71px; height: 85px; border: 0.75px solid #000000; background: #ffffff; overflow: hidden; border-radius: 0px; box-sizing: border-box;">
                  <img src="${certData.photo}" alt="NID Photo" class="w-full h-full object-cover" style="display: block;">
                </div>
                <div style="width: 71px; height: 20px; margin-top: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  <img src="${certData.sign}" alt="Signature" class="max-w-full max-h-full object-contain" style="display: block;">
                </div>
              </div>

              <!-- Right: Info Rows -->
              <div class="flex-1 flex flex-col justify-between" style="font-size: 8.5pt; line-height: 1.25; color: #000000; padding-left: 3px; height: 107px;">
                <div class="flex items-baseline">
                  <span style="width: 36px; flex-shrink: 0; color: #000000; font-weight: 500; font-size: 8.5pt;">নাম:</span>
                  <strong style="font-size: 10.5pt; color: #000000; font-weight: 700; font-family: 'Hind Siliguri', 'Kalpurush', 'SolaimanLipi', sans-serif; line-height: 1.15;">${certData.name_bn}</strong>
                </div>
                <div class="flex items-baseline">
                  <span style="width: 36px; flex-shrink: 0; color: #000000; font-weight: 500; font-size: 8.5pt;">Name:</span>
                  <strong style="font-size: 9.2pt; color: #000000; font-weight: 700; font-family: Arial, 'Segoe UI', sans-serif; line-height: 1.15;">${certData.name_en}</strong>
                </div>
                <div class="flex items-baseline">
                  <span style="width: 36px; flex-shrink: 0; color: #000000; font-weight: 500; font-size: 8.5pt;">পিতা:</span>
                  <span style="font-size: 9pt; font-weight: 600; color: #000000; line-height: 1.15;">${certData.father_name}</span>
                </div>
                <div class="flex items-baseline">
                  <span style="width: 36px; flex-shrink: 0; color: #000000; font-weight: 500; font-size: 8.5pt;">মাতা:</span>
                  <span style="font-size: 9pt; font-weight: 600; color: #000000; line-height: 1.15;">${certData.mother_name}</span>
                </div>
                <div class="flex items-baseline">
                  <span style="color: #000000; margin-right: 4px; font-size: 8.5pt; font-weight: 500;">Date of Birth:</span>
                  <strong style="color: #c8102e; font-size: 9.5pt; font-weight: 700; font-family: Arial, 'Segoe UI', sans-serif;">${certData.dob}</strong>
                </div>
                <div class="flex items-baseline">
                  <span style="color: #000000; margin-right: 4px; font-size: 9pt; font-weight: 600;">ID NO:</span>
                  <strong style="color: #c8102e; font-size: 11.5pt; font-weight: 800; letter-spacing: 0.5px; font-family: 'Courier New', monospace, sans-serif;">${certData.reg_no}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- BACK SIDE -->
          <div class="nid-card-frame select-none flex flex-col justify-between" style="padding: 0; box-sizing: border-box;">
            <!-- Background Guilloche & Watermark -->
            ${getNidSecurityBg(certData.watermark)}

            <!-- Top Notice Box -->
            <div style="border-bottom: 0.75px solid #000000; padding: 4px 6px 3px 6px; font-size: 6.4pt; line-height: 1.25; text-align: center; color: #000000;" class="relative z-10 font-semibold">
              এই কার্ডটি গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের সম্পত্তি। কার্ডটি ব্যবহারকারী ব্যতীত অন্য<br>
              কোথাও পাওয়া গেলে নিকটস্থ পোস্ট অফিসে জমা দেবার জন্য অনুরোধ করা হলো।
            </div>

            <!-- Middle Address (স্থায়ী ঠিকানা) -->
            <div style="border-bottom: 0.75px solid #000000; padding: 3px 8px 3px 8px; font-size: 7.6pt; line-height: 1.28; color: #000000;" class="relative z-10 flex-1 flex flex-col justify-center">
              <div><span style="font-weight: 700;">ঠিকানা:</span> ${certData.address}</div>
            </div>

            <!-- Blood Group, Birth Place & Print Count Row -->
            <div style="border-bottom: 0.75px solid #000000; padding: 2px 8px; font-size: 7.6pt; line-height: 1.2; color: #000000; min-height: 18px;" class="relative z-10 flex items-center justify-between">
              <div>
                <span>রক্তের গ্রুপ / Blood Group: </span>
                ${certData.gender_blood ? `<strong style="color: #c8102e; font-weight: 700;">${certData.gender_blood}</strong>` : ''}
                <span style="margin-left: ${certData.gender_blood ? '12px' : '22px'};">জন্মস্থান: </span>
                <span style="font-weight: 600;">${certData.birth_place || ''}</span>
              </div>
              <div style="background-color: #000000; color: #ffffff; padding: 1.5px 6px; font-weight: 700; font-size: 7.2pt; line-height: 1.1; border-radius: 0;">
                মুদ্রণ: ০১
              </div>
            </div>

            <!-- Signatures & Issue Date Row -->
            <div style="padding: 2px 8px 1px 8px; font-size: 7.5pt; color: #000000;" class="relative z-10 flex items-end justify-between">
              <!-- Official Authority Signature -->
              <div class="text-center" style="width: 130px;">
                <div style="height: 18px; display: flex; align-items: flex-end; justify-content: center;">
                  <svg class="h-4 w-24" viewBox="0 0 110 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 28 20 C 26 12, 30 4, 34 3 C 37 2, 38 8, 35 15 C 32 21, 26 22, 22 20 C 18 18, 25 15, 36 12 C 44 9, 52 12, 50 17 C 48 20, 42 21, 47 18 C 55 14, 68 8, 80 6 C 88 4, 95 8, 92 12 C 90 14, 86 15, 94 13" stroke="#000000" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M 32 19 Q 60 18 90 15" stroke="#000000" stroke-width="1.1" stroke-linecap="round"/>
                  </svg>
                </div>
                <div style="border-top: 0.75px solid #000000; font-size: 6.8pt; font-weight: 600; padding-top: 1px;">
                  প্রদানকারী কর্তৃপক্ষের স্বাক্ষর
                </div>
              </div>

              <!-- Issue Date -->
              <div style="font-size: 7.6pt; font-weight: 600; padding-bottom: 2px;">
                প্রদানের তারিখ: <span style="font-weight: 700;">${certData.issue_date}</span>
              </div>
            </div>

            <!-- Bottom 2D PDF417 Barcode -->
            <div style="padding: 1px 6px 3px 6px;" class="relative z-10">
              <canvas id="nid-barcode-canvas" style="width: 100%; height: 38px; image-rendering: pixelated; display: block;"></canvas>
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

  function drawFallbackPdf417Barcode(canvas, text) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = 320
    const h = 36
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#000000'
    const startPattern = [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0]
    const stopPattern = [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1]

    const numRows = 12
    const rowHeight = h / numRows
    const moduleWidth = w / 160

    let hash = 0
    const str = String(text || 'NID_PDF417_DEFAULT')
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
    }

    for (let r = 0; r < numRows; r++) {
      const y = r * rowHeight
      let x = 0

      for (let i = 0; i < startPattern.length; i++) {
        if (startPattern[i]) ctx.fillRect(x, y, moduleWidth, rowHeight)
        x += moduleWidth
      }

      let rowHash = (hash ^ (r * 7919)) >>> 0
      const cols = 125
      for (let c = 0; c < cols; c++) {
        rowHash = (rowHash * 1664525 + 1013904223) >>> 0
        const isBar = (rowHash & 0x7) < 4
        if (isBar) {
          ctx.fillRect(x, y, moduleWidth, rowHeight)
        }
        x += moduleWidth
      }

      for (let i = 0; i < stopPattern.length; i++) {
        if (stopPattern[i]) ctx.fillRect(x, y, moduleWidth, rowHeight)
        x += moduleWidth
      }
    }
  }

  function renderNidPdf417(canvas, barcodeXml, attempt = 0) {
    if (!canvas) return
    if (window.bwipjs && typeof window.bwipjs.toCanvas === 'function') {
      try {
        window.bwipjs.toCanvas(canvas, {
          bcid: 'pdf417',
          text: barcodeXml,
          scale: 2,
          height: 11,
          columns: 16,
          eclevel: 4,
          includetext: false,
        })
        return
      } catch (err1) {
        try {
          window.bwipjs.toCanvas(canvas, {
            bcid: 'pdf417',
            text: barcodeXml,
            scale: 2,
            height: 11,
            columns: 14,
            eclevel: 4,
            includetext: false,
          })
          return
        } catch (err2) {
          console.error('bwip-js PDF417 render failed:', err2)
        }
      }
    }
    if (attempt < 10) {
      setTimeout(() => renderNidPdf417(canvas, barcodeXml, attempt + 1), 70)
      return
    }
    drawFallbackPdf417Barcode(canvas, barcodeXml)
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

  const downloadPdfBtn = qs('#btn-cert-download-pdf')
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      const renderEl = qs('#certificate-content-render')
      if (!renderEl) return
      const rawRegNo = qs('#uf-reg-no')?.value || 'NID_Card'
      if (window.html2pdf) {
        showToast('উচ্চমানের A4 PDF প্রস্তুত হচ্ছে...', 'info')
        const opt = {
          margin: [24, 0, 0, 0],
          filename: `NID_${rawRegNo}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }
        window.html2pdf().set(opt).from(renderEl).save().then(() => {
          showToast('PDF ফাইল সফলভাবে ডাউনলোড হয়েছে!', 'success')
        }).catch((err) => {
          console.error('HTML2PDF error:', err)
          window.print()
        })
      } else {
        window.print()
      }
    })
  }

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
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> এনআইডি তৈরি ও ওয়ালেট থেকে ফি কাটা হচ্ছে...`

    try {
      const currentUser = getStoredUser()
      if (service.price > 0 && (!currentUser || (currentUser.balance || 0) < service.price)) {
        submitBtn.disabled = false
        submitBtn.innerHTML = `<i class="fa-solid fa-bolt text-amber-300"></i> ${isNid ? `Create NID (৳${toBnDigits(serviceCharge)} অটো কাটবে)` : `সাবমিট করুন`}`
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
      showToast(`🎉 এনআইডি কার্ড সফলভাবে তৈরি হয়েছে! আপনার ওয়ালেট থেকে ৳${service.price} ফি অটো কর্তন করা হয়েছে।`, 'success')

      // Refresh balance across the interface
      try {
        const me = await API.get('/auth/me')
        if (me && me.user) {
          setStoredUser(me.user)
          const navBal = qs('#nav-user-balance')
          if (navBal) navBal.textContent = formatMoney(me.user.balance)
        }
      } catch {}

      // Show instant success with certificate preview / print option
      renderLiveCertificate()
      previewModal.classList.remove('hidden')

      submitBtn.disabled = false
      submitBtn.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-300"></i> সম্পন্ন হয়েছে (৳${toBnDigits(serviceCharge)} কর্তন হয়েছে)`
    } catch (err) {
      console.error('Super fast order submit error:', err)
      showToast(getErrorMessage(err), 'error')
      submitBtn.disabled = false
      submitBtn.innerHTML = `<i class="fa-solid fa-bolt text-amber-300"></i> ${isNid ? `Create NID (৳${toBnDigits(serviceCharge)} অটো কাটবে)` : `সাবমিট করুন`}`
    }
  })
}

// ------------------------------------------------------------
// Client-Side PDF Parsing Engine with PDF.js & Regex
// ------------------------------------------------------------
async function extractCitizenImagesFromPdf(arrayBuffer, pdf) {
  let photoDataUrl = ''
  let signDataUrl = ''
  let logoDataUrl = ''
  let watermarkDataUrl = ''

  const allCandidates = []

  // Step 1: Direct Binary JPEG Stream Scanner (Extracts raw embedded JPEG images instantly)
  try {
    const bytes = new Uint8Array(arrayBuffer)
    const len = bytes.length

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
                img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight, dataUrl, size: slice.length, source: 'binary' })
                img.onerror = () => res(null)
                img.src = dataUrl
              })
              if (dims && dims.width > 20 && dims.height > 20) {
                allCandidates.push(dims)
              }
            }
          } catch (e) {}
          i = end
        }
      }
    }
  } catch (rawErr) {
    console.warn('Binary JPEG extraction notice:', rawErr)
  }

  // Step 2: PDF.js Operator List & Decoded Objects (Handles PNG, FlateDecode, and masked images)
  let canvas = null
  try {
    if (pdf && pdf.numPages > 0) {
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.5 })
      canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      // Rendering ensures all image resources are decoded into page.objs
      await page.render({ canvasContext: ctx, viewport }).promise

      const ops = await page.getOperatorList()

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
            const dUrl = tempCanvas.toDataURL('image/png', 0.95)
            allCandidates.push({ width: imgObj.width, height: imgObj.height, dataUrl: dUrl, size: imgObj.width * imgObj.height, source: 'pdfjs' })
          }
        }
      }
    }
  } catch (objErr) {
    console.warn('PDF.js image decoding notice:', objErr)
  }

  // Multi-engine sorting and categorization of extracted image candidates
  if (allCandidates.length > 0) {
    // Signatures: wide aspect ratio (width/height >= 1.20) or short height
    const signatures = allCandidates.filter((c) => (c.width / c.height >= 1.20) || (c.height <= 95 && c.width > c.height))
    // Portraits: vertical/square (width/height between 0.65 and 1.25)
    const portraits = allCandidates.filter((c) => {
      const ratio = c.width / c.height
      return ratio >= 0.65 && ratio < 1.25 && c.width >= 40 && c.height >= 40
    })
    // Logos / Monograms: circular or small square
    const logos = allCandidates.filter((c) => {
      const ratio = c.width / c.height
      return ratio >= 0.80 && ratio <= 1.20 && c.width >= 35 && c.width <= 140
    })

    if (portraits.length > 0) {
      portraits.sort((a, b) => (b.width * b.height) - (a.width * a.height))
      photoDataUrl = portraits[0].dataUrl
      if (portraits.length > 1 && !logoDataUrl) {
        logoDataUrl = portraits[1].dataUrl
      }
    }
    if (signatures.length > 0) {
      signatures.sort((a, b) => (b.width / b.height) - (a.width / a.height))
      signDataUrl = signatures[0].dataUrl
    }
    if (!logoDataUrl && logos.length > 0) {
      const unusedLogo = logos.find((l) => l.dataUrl !== photoDataUrl && l.dataUrl !== signDataUrl)
      if (unusedLogo) logoDataUrl = unusedLogo.dataUrl
    }
    const watermarks = allCandidates.filter((c) => c.width >= 120 && c.height >= 120 && c.dataUrl !== photoDataUrl && c.dataUrl !== logoDataUrl && c.dataUrl !== signDataUrl)
    if (watermarks.length > 0) {
      watermarkDataUrl = watermarks[0].dataUrl
    }
  }

  // Step 3: High-precision CMS copy canvas crop fallback
  // In CMS copy PDFs, the photo is located on the upper-right (x: 60% to 98%, y: 4% to 38%)
  if ((!photoDataUrl || !signDataUrl) && canvas && canvas.width > 200 && canvas.height > 200) {
    try {
      const cw = canvas.width
      const ch = canvas.height
      const scanX1 = Math.round(cw * 0.58)
      const scanX2 = Math.round(cw * 0.99)
      const scanY1 = Math.round(ch * 0.03)
      const scanY2 = Math.round(ch * 0.40)
      const scanW = scanX2 - scanX1
      const scanH = scanY2 - scanY1

      const ctx = canvas.getContext('2d')
      const imgData = ctx.getImageData(scanX1, scanY1, scanW, scanH)
      const d = imgData.data

      // Row density scan for solid portrait block
      let topY = -1, bottomY = -1
      for (let y = 0; y < scanH; y++) {
        let nonWhite = 0
        for (let x = 0; x < scanW; x++) {
          const idx = (y * scanW + x) * 4
          if (d[idx] < 235 || d[idx + 1] < 235 || d[idx + 2] < 235) nonWhite++
        }
        if (nonWhite > scanW * 0.28) {
          if (topY === -1) topY = y
          bottomY = y
        }
      }

      let px = Math.round(cw * 0.73)
      let py = Math.round(ch * 0.08)
      let pw = Math.round(cw * 0.22)
      let ph = Math.round(ch * 0.12)

      if (topY !== -1 && bottomY !== -1 && (bottomY - topY) > 35) {
        let leftX = -1, rightX = -1
        for (let x = 0; x < scanW; x++) {
          let colCount = 0
          for (let y = topY; y <= bottomY; y++) {
            const idx = (y * scanW + x) * 4
            if (d[idx] < 235 || d[idx + 1] < 235 || d[idx + 2] < 235) colCount++
          }
          if (colCount > (bottomY - topY) * 0.28) {
            if (leftX === -1) leftX = x
            rightX = x
          }
        }
        if (leftX !== -1 && rightX !== -1 && (rightX - leftX) > 30) {
          px = scanX1 + leftX
          py = scanY1 + topY
          pw = rightX - leftX
          ph = bottomY - topY
        }
      }

      if (!photoDataUrl) {
        const cropC = document.createElement('canvas')
        cropC.width = pw
        cropC.height = ph
        const cCtx = cropC.getContext('2d')
        cCtx.drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph)
        photoDataUrl = cropC.toDataURL('image/jpeg', 0.95)
      }

      if (!signDataUrl) {
        const sx = px
        const sy = py + ph + Math.round(ph * 0.03)
        const sw = pw
        const sh = Math.round(ph * 0.42)
        const cropC = document.createElement('canvas')
        cropC.width = sw
        cropC.height = sh
        const cCtx = cropC.getContext('2d')
        cCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
        const rawSign = cropC.toDataURL('image/png')
        signDataUrl = await cleanSignatureTransparency(rawSign)
      }
    } catch (cropErr) {
      console.warn('Adaptive canvas crop notice:', cropErr)
    }
  }

  if (signDataUrl) {
    try {
      signDataUrl = await cleanSignatureTransparency(signDataUrl)
    } catch {}
  }

  return { photoDataUrl, signDataUrl, logoDataUrl, watermarkDataUrl }
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
      if (extractedImages.logoDataUrl) {
        result.logoDataUrl = extractedImages.logoDataUrl
      }
      if (extractedImages.watermarkDataUrl) {
        result.watermarkDataUrl = extractedImages.watermarkDataUrl
      }

      if (combinedText.trim()) {
        // If CMS portal format detected, use dedicated CMS parser first
        if (/National\s*ID|Status\s*printed|Permanent\s*Address|Present\s*Address|Tag\s*left_out|Election\s*Commission/i.test(combinedText)) {
          const cmsData = parseCmsRawText(combinedText)
          if (cmsData) {
            if (cmsData.registration_no) result.registration_no = cmsData.registration_no
            if (cmsData.book_no) result.book_no = cmsData.book_no
            if (cmsData.name_bn) result.name_bn = cmsData.name_bn
            if (cmsData.name_en) result.name_en = cmsData.name_en
            if (cmsData.dob) result.dob = cmsData.dob
            if (cmsData.birth_place) result.birth_place = cmsData.birth_place
            if (cmsData.father_name_bn) result.father_name_bn = cmsData.father_name_bn
            if (cmsData.mother_name_bn) result.mother_name_bn = cmsData.mother_name_bn
            if (cmsData.gender_blood) result.gender_blood = cmsData.gender_blood
            if (cmsData.address) result.address = cmsData.address
          }
        }

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

        // 10. Present Address extraction (Strictly Present Address ONLY, never Permanent Address)
        if (!result.address) {
          if (text.includes('Present Address') || text.includes('বর্তমান ঠিকানা')) {
            const splitKey = text.includes('Present Address') ? 'Present Address' : 'বর্তমান ঠিকানা'
            const sec = text.split(splitKey)[1].split(/Permanent Address|স্থায়ী ঠিকানা|স্থায়ী ঠিকানা|Education|Blood Group|TIN|Driving|Passport|Laptop|NID Father/i)[0]

            const holdingMatch = sec.match(/(?:Home\/Holding\s*No|Home\/Holding|বাসা\/হোল্ডিং)[\s:.-]*([^\n,]{1,20})/i)
            const addlVillageMatch = sec.match(/(?:Additional\s*Village\/Road|অতিরিক্ত\s*গ্রাম\/রাস্তা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,40})/i)
            const mouzaMatch = sec.match(/(?:Mouza\/Moholla|মৌজা\/মহল্লা|গ্রাম\/রাস্তা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,40})/i)
            const poMatch = sec.match(/(?:Post\s*Office|ডাকঘর)[\s:.-]*([ঀ-৿A-Za-z\s]{2,40})/i)
            const pcMatch = sec.match(/(?:Postal\s*Code|পোস্ট\s*কোড)[\s:.-]*([0-9০-৯]{4})/i)
            const upoMatch = sec.match(/(?:Upozila|Upazila|উপজেলা|থানা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,30})/i)
            const distMatch = sec.match(/(?:District|জেলা)[\s:.-]*([ঀ-৿A-Za-z\s]{2,30})/i)

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
            if (parts.length > 1) {
              result.address = cleanCmsBanglaText(parts.join(', '))
            }
          } else {
            const presentMatch = text.match(/(?:Present\s*Address|বর্তমান\s*ঠিকানা)[\s:.-]*([ঀ-৿A-Za-z0-9\s,:.-]{10,140})/i)
            if (presentMatch) {
              result.address = cleanCmsBanglaText(presentMatch[1].trim())
            }
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
    logoDataUrl: '',
    watermarkDataUrl: '',
  }
}

// ------------------------------------------------------------
// Signature Transparency Cleaner (Removes white/grey boxes with smart adaptive ink thresholding)
// ------------------------------------------------------------
function cleanSignatureTransparency(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return resolve(dataUrl)
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth || img.width
        c.height = img.naturalHeight || img.height
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, c.width, c.height)
        const data = imgData.data

        // Step 1: Compute background luminosity from border perimeter (4 corners and borders)
        let bgSum = 0
        let bgCount = 0
        const w = c.width
        const h = c.height
        for (let x = 0; x < w; x++) {
          // Top row
          let idx = x * 4
          bgSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          // Bottom row
          idx = ((h - 1) * w + x) * 4
          bgSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          bgCount += 2
        }
        for (let y = 0; y < h; y++) {
          // Left edge
          let idx = (y * w) * 4
          bgSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          // Right edge
          idx = (y * w + (w - 1)) * 4
          bgSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          bgCount += 2
        }
        const avgBgLum = bgCount > 0 ? (bgSum / bgCount) : 240
        // Threshold dynamically tuned to background lightness (default ~180-210)
        const threshold = Math.max(160, Math.min(220, avgBgLum - 25))

        let minX = w, maxX = 0, minY = h, maxY = 0
        let hasInk = false

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4
            const r = data[i], g = data[i + 1], b = data[i + 2]
            const lum = 0.299 * r + 0.587 * g + 0.114 * b

            if (lum > threshold) {
              data[i + 3] = 0 // Transparent background
            } else {
              // Darken ink to crisp deep black (#050505) for laser-sharp NID print
              data[i] = Math.min(r, 15)
              data[i + 1] = Math.min(g, 15)
              data[i + 2] = Math.min(b, 15)
              // Soft alpha gradient for anti-aliased edge smoothing
              const factor = Math.max(0, (threshold - lum) / 45)
              data[i + 3] = Math.min(255, Math.round(factor * 255))

              if (data[i + 3] > 30) {
                hasInk = true
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0)

        // If ink was found, trim extra empty whitespace margins for crisp placement
        if (hasInk && (maxX > minX + 5) && (maxY > minY + 5)) {
          const pad = 4
          const cropX = Math.max(0, minX - pad)
          const cropY = Math.max(0, minY - pad)
          const cropW = Math.min(w - cropX, (maxX - minX) + pad * 2)
          const cropH = Math.min(h - cropY, (maxY - minY) + pad * 2)

          const trimCanvas = document.createElement('canvas')
          trimCanvas.width = cropW
          trimCanvas.height = cropH
          trimCanvas.getContext('2d').drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
          resolve(trimCanvas.toDataURL('image/png'))
        } else {
          resolve(c.toDataURL('image/png'))
        }
      } catch (e) {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// ------------------------------------------------------------
// Election Commission CMS Raw Text Normalizer & Parser
// ------------------------------------------------------------
function cleanCmsBanglaText(str) {
  if (!str) return ''
  let s = str.replace(/\r?\n/g, ' ').trim()
  
  // Standardize মোঃ
  s = s.replace(/মো[ঃ:]+/g, 'মোঃ ').replace(/মো[ঃ:]+/g, 'মোঃ ')
  
  // Fix known split syllables/words commonly found in EC CMS copies
  s = s.replace(/এমরা\s*ন/g, 'এমরান')
  s = s.replace(/কবি\s*র/g, 'কবির')
  s = s.replace(/রি\s*পন/g, 'রিপন')
  s = s.replace(/লি\s*লু/g, 'লিলু')
  s = s.replace(/মি\s*য়া/g, 'মিয়া')
  s = s.replace(/রহি\s*মা/g, 'রহিমা')
  s = s.replace(/খা\s*তুন/g, 'খাতুন')
  s = s.replace(/সা\s*ধে\s*র/g, 'সাধের')
  s = s.replace(/জং\s*গলবা\s*ড়ি/g, 'জঙ্গলবাড়ি')
  s = s.replace(/জং\s*গল/g, 'জঙ্গল')
  s = s.replace(/শ্রীরা\s*মপুর/g, 'শ্রীরামপুর')
  s = s.replace(/জা\s*ফ্রা\s*বা\s*দ/g, 'জাফরাবাদ')
  s = s.replace(/করি\s*মগঞ্জ/g, 'করিমগঞ্জ')
  s = s.replace(/কি\s*শো\s*রগঞ্জ/g, 'কিশোরগঞ্জ')
  s = s.replace(/ঢা\s*কা/g, 'ঢাকা')
  s = s.replace(/ময়মনসিং\s*হ/g, 'ময়মনসিংহ')

  // Connect vowel kar signs attached with stray spaces (e.g. "ক ি" -> "কি")
  s = s.replace(/([ঀ-৿])\s+([া-ৌ্ৎংঃঁ])/g, '$1$2')

  // Connect isolated single consonants attached to preceding word
  s = s.replace(/([ঀ-৿]{2,}[া-ৌ্ৎংঃঁ]?)\s+([ক-হড়-য়ৎংঃঁ])(?=\s|$)/g, '$1$2')

  // Clean consecutive duplicate words
  s = s.replace(/\b(মোঃ\s*)+/g, 'মোঃ ')
  s = s.replace(/\b(\S+)\s+\1\b/g, '$1')

  return s.replace(/\s{2,}/g, ' ').trim()
}

function parseCmsRawText(text) {
  if (!text) return null
  const bnToEn = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' }

  // 1. National ID (10 to 17 digits)
  const nidMatch = text.match(/(?:National\s*Id|National\s*ID|জাতীয়\s*পরিচয়পত্র\s*নম্বর|জাতীয়\s*পরিচয়পত্র\s*নং|জাতীয়\s*পরিচয়পত্র|এনআইডি\s*নং|এনআইডি|NID\s*No|NID)[\s:.-]*([0-9০-৯]{10,17})/i)
  const regNo = nidMatch ? nidMatch[1].replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch) : ''

  // 2. PIN No (17 digits)
  const pinMatch = text.match(/(?:Pin|পিন\s*নম্বর|পিন\s*নং|পিন|PIN\s*No|PIN|Book)[\s:.-]*([0-9০-৯]{17})/i)
  const pinNo = pinMatch ? pinMatch[1].replace(/[০-৯]/g, (ch) => bnToEn[ch] || ch) : ''

  // 3. Name (Bangla)
  const bnMatch = text.match(/(?:Name\s*\(Bangla\)|নাম\s*\(বাংলা\)|ব্যক্তির\s*নাম)[\s:.-]*([^\n\r]+?)(?=\s*(?:Name\s*\(English\)|Name|Father|পিতা|Date|$))/i) ||
    text.match(/(?:নাম)[\s:.-]*([ঀ-৿\s.]{2,50})/i)

  // 4. Name (English)
  const enMatch = text.match(/(?:Name\s*\(English\)|নাম\s*\(ইংরেজি\)|Name\s*in\s*English)[\s:.-]*([A-Za-z\s.]{2,40}?)(?=\s*(?:Date|Birth|Father|Mother|Gender|\n|\r|$))/i) ||
    text.match(/(?:Name)[\s:.-]*([A-Za-z\s.]{2,40})/i)

  // 5. Date of Birth
  const dobMatch = text.match(/(?:Date\s*of\s*Birth|জন্ম\s*তারিখ|DOB)[\s:.-]*([0-9০-৯]{4}[-\/.][0-9০-৯]{1,2}[-\/.][0-9০-৯]{1,2}|[0-9০-৯]{1,2}[-\/.\s][A-Za-z0-9০-৯]{2,4}[-\/.\s][0-9০-৯]{4})/i)

  // 6. Birth Place
  const bpMatch = text.match(/(?:Birth\s*Place|জন্মস্থান|Place\s*of\s*Birth)[\s:.-]*([^\n\r]+?)(?=\s*(?:Birth\s*Other|Birth\s*Reg|Father|পিতা|$))/i)

  // 7. Father Name
  const fMatch = text.match(/(?:Father\s*Name|পিতার\s*নাম|পিতা)[\s:.-]*([^\n\r]+?)(?=\s*(?:Mother\s*Name|Mother|মাতা|Spouse|Gender|$))/i)

  // 8. Mother Name
  const mMatch = text.match(/(?:Mother\s*Name|মাতার\s*নাম|মাতা)[\s:.-]*([^\n\r]+?)(?=\s*(?:Spouse\s*Name|Spouse|স্বামী|স্ত্রী|Gender|$))/i)

  // 9. Blood Group
  const bgMatch = text.match(/(?:Blood\s*Group|রক্তের\s*গ্রুপ)[\s:.-]*\s*([ABO][+-]|AB[+-])/i)

  // 10. Address (Present Address / বর্তমান ঠিকানা First Priority as per NID rules)
  function parseSectionAddress(secText) {
    if (!secText) return ''
    const stopPattern = '(?=\\s*(?:Home\\/Holding|Additional\\s+Village|Village\\/Road|Additional\\s+Mouza|Mouza\\/Moholla|Ward\\s+For|Union\\/Ward|City\\s+Corporation|Post\\s+Office|Postal\\s+Code|Region|Upozila|District|Division|\\n|$))'

    function getField(pattern) {
      const reg = new RegExp(pattern + '[\\s:.-]*([\\s\\S]*?)' + stopPattern, 'i')
      const m = secText.match(reg)
      return m ? cleanCmsBanglaText(m[1].replace(/[-]/g, '').trim()) : ''
    }

    const holdingMatch = secText.match(/(?:Home\/Holding\s*(?:No)?|বাসা\/হোল্ডিং)[\s:.-]*([0-9০-৯A-Za-z\s\/-]+?)(?=\s*(?:Village|Post|Additional|$|\n))/i)
    const holding = holdingMatch ? holdingMatch[1].trim().replace(/^[-–—]+$/, '') : ''

    const addVillage = getField('Additional\\s+Village\\/Road')
    const village = getField('(?:(?<!Additional\\s+)Village\\/Road|গ্রাম\\/রাস্তা)')
    const mouza = getField('(?:(?<!Additional\\s+)Mouza\\/Moholla|মৌজা\\/মহল্লা)')
    const po = getField('(?:Post\\s*Office|ডাকঘর)')
    const pcMatch = secText.match(/(?:Postal\s*Code|পোস্ট\s*কোড)[\s:.-]*([0-9০-৯]{4})/i)
    const pc = pcMatch ? pcMatch[1].trim() : ''
    const upo = getField('(?:Upozila|Upazila|উপজেলা|থানা)')
    const dist = getField('(?:District|জেলা)')

    const roadItems = [addVillage, village, mouza].filter(Boolean)
    const uniqueRoadItems = Array.from(new Set(roadItems))
    const roadStr = uniqueRoadItems.join(', ')

    const parts = []
    parts.push(`বাসা/হোল্ডিং: ${holding}`)
    if (roadStr) parts.push(`গ্রাম/রাস্তা: ${roadStr}`)
    if (po) parts.push(`ডাকঘর: ${po}${pc ? ' - ' + pc : ''}`)
    if (upo) parts.push(upo)
    if (dist) parts.push(dist)

    if (parts.length > 1 && (roadStr || po || upo || dist)) {
      return parts.join(', ')
    }
    return ''
  }

  // 10. Address (Strictly Present Address / বর্তমান ঠিকানা ONLY as per Bangladesh NID regulations)
  // Permanent Address is NEVER printed or used on the back of Bangladesh NID card.
  let extractedAddress = ''
  if (text.includes('Present Address') || text.includes('বর্তমান ঠিকানা')) {
    const splitKey = text.includes('Present Address') ? 'Present Address' : 'বর্তমান ঠিকানা'
    const sec = text.split(splitKey)[1].split(/Permanent Address|স্থায়ী ঠিকানা|স্থায়ী ঠিকানা|Education|Blood Group|TIN|Driving|Passport|Laptop|NID Father/i)[0]
    extractedAddress = parseSectionAddress(sec)
  }

  return {
    registration_no: regNo,
    book_no: pinNo || regNo,
    name_bn: bnMatch ? cleanCmsBanglaText(bnMatch[1]) : '',
    name_en: enMatch ? enMatch[1].replace(/\s+/g, ' ').trim() : '',
    dob: dobMatch ? formatNidDob(dobMatch[1]) : '',
    birth_place: bpMatch ? cleanCmsBanglaText(bpMatch[1]) : '',
    father_name_bn: fMatch ? cleanCmsBanglaText(fMatch[1]) : '',
    mother_name_bn: mMatch ? cleanCmsBanglaText(mMatch[1]) : '',
    gender_blood: bgMatch ? bgMatch[1].toUpperCase() : '',
    address: extractedAddress,
  }
}

// ------------------------------------------------------------
// CMS Screenshot / Image Adaptive Cropper & Parser
// ------------------------------------------------------------
async function extractFromCmsImage(imageFile) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      const img = new Image()
      img.onload = async () => {
        try {
          const w = img.naturalWidth || img.width
          const h = img.naturalHeight || img.height
          const result = { photoDataUrl: '', signDataUrl: '' }

          // If tall vertical image (CMS copy screenshot or full document capture)
          if (h > w && h >= 300 && w >= 200) {
            const mainCanvas = document.createElement('canvas')
            mainCanvas.width = w
            mainCanvas.height = h
            const mainCtx = mainCanvas.getContext('2d')
            mainCtx.drawImage(img, 0, 0)

            // High-precision adaptive scan on the right side of CMS screenshot
            let photoBox = null
            let signBox = null

            try {
              // Search zone for Photo: upper right quadrant
              const scanX1 = Math.round(w * 0.58)
              const scanX2 = Math.round(w * 0.99)
              const scanY1 = Math.round(h * 0.03)
              const scanY2 = Math.round(h * 0.40)
              const scanW = scanX2 - scanX1
              const scanH = scanY2 - scanY1

              const imgData = mainCtx.getImageData(scanX1, scanY1, scanW, scanH)
              const d = imgData.data

              // Find horizontal projection of non-white content
              const rowDensity = new Float32Array(scanH)
              for (let y = 0; y < scanH; y++) {
                let nonWhite = 0
                for (let x = 0; x < scanW; x++) {
                  const idx = (y * scanW + x) * 4
                  // Count pixel if not light background
                  if (d[idx] < 238 || d[idx + 1] < 238 || d[idx + 2] < 238) {
                    nonWhite++
                  }
                }
                rowDensity[y] = nonWhite / scanW
              }

              // Scan for contiguous solid block matching portrait photo (aspect ratio ~ 0.75 - 1.25)
              let bestBlock = null
              let curStart = -1
              for (let y = 0; y < scanH; y++) {
                if (rowDensity[y] > 0.25) {
                  if (curStart === -1) curStart = y
                } else {
                  if (curStart !== -1) {
                    const blockH = y - curStart
                    if (blockH >= Math.round(h * 0.06) && blockH <= Math.round(h * 0.22)) {
                      if (!bestBlock || blockH > bestBlock.h) {
                        bestBlock = { startY: curStart, endY: y, h: blockH }
                      }
                    }
                    curStart = -1
                  }
                }
              }
              if (curStart !== -1) {
                const blockH = scanH - curStart
                if (blockH >= Math.round(h * 0.06) && blockH <= Math.round(h * 0.22)) {
                  if (!bestBlock || blockH > bestBlock.h) {
                    bestBlock = { startY: curStart, endY: scanH, h: blockH }
                  }
                }
              }

              if (bestBlock) {
                // Find horizontal bounds for this block
                let minX = scanW, maxX = 0
                for (let y = bestBlock.startY; y < bestBlock.endY; y++) {
                  for (let x = 0; x < scanW; x++) {
                    const idx = (y * scanW + x) * 4
                    if (d[idx] < 235 || d[idx + 1] < 235 || d[idx + 2] < 235) {
                      if (x < minX) minX = x
                      if (x > maxX) maxX = x
                    }
                  }
                }
                if (maxX > minX + 25) {
                  photoBox = {
                    x: scanX1 + minX,
                    y: scanY1 + bestBlock.startY,
                    w: maxX - minX,
                    h: bestBlock.h
                  }
                }
              }
            } catch (e) {
              console.warn('Adaptive photo detection notice:', e)
            }

            // Calibrated fallback or detected photo dimensions
            const px = photoBox ? photoBox.x : Math.round(w * 0.72)
            const py = photoBox ? photoBox.y : Math.round(h * 0.082)
            const pw = photoBox ? photoBox.w : Math.round(w * 0.22)
            const ph = photoBox ? photoBox.h : Math.round(h * 0.11)

            // Crop Photo
            const photoCanvas = document.createElement('canvas')
            photoCanvas.width = pw
            photoCanvas.height = ph
            photoCanvas.getContext('2d').drawImage(img, px, py, pw, ph, 0, 0, pw, ph)
            result.photoDataUrl = photoCanvas.toDataURL('image/jpeg', 0.95)

            // Scan zone for signature right below photo
            try {
              const signSearchY1 = py + ph
              const signSearchY2 = Math.min(h, py + ph + Math.round(ph * 0.65))
              const signSearchX1 = Math.max(0, px - Math.round(pw * 0.1))
              const signSearchX2 = Math.min(w, px + pw + Math.round(pw * 0.1))
              const sW = signSearchX2 - signSearchX1
              const sH = signSearchY2 - signSearchY1

              if (sW > 20 && sH > 15) {
                const sImgData = mainCtx.getImageData(signSearchX1, signSearchY1, sW, sH)
                const sData = sImgData.data

                let sMinX = sW, sMaxX = 0, sMinY = sH, sMaxY = 0
                let sInk = false
                for (let sy = 0; sy < sH; sy++) {
                  for (let sx = 0; sx < sW; sx++) {
                    const idx = (sy * sW + sx) * 4
                    if (sData[idx] < 220 || sData[idx + 1] < 220 || sData[idx + 2] < 220) {
                      sInk = true
                      if (sx < sMinX) sMinX = sx
                      if (sx > sMaxX) sMaxX = sx
                      if (sy < sMinY) sMinY = sy
                      if (sy > sMaxY) sMaxY = sy
                    }
                  }
                }
                if (sInk && (sMaxX > sMinX + 15) && (sMaxY > sMinY + 8)) {
                  const pad = 3
                  signBox = {
                    x: Math.max(0, signSearchX1 + sMinX - pad),
                    y: Math.max(0, signSearchY1 + sMinY - pad),
                    w: Math.min(w - signSearchX1, (sMaxX - sMinX) + pad * 2),
                    h: Math.min(h - signSearchY1, (sMaxY - sMinY) + pad * 2)
                  }
                }
              }
            } catch (e) {
              console.warn('Adaptive signature detection notice:', e)
            }

            // Crop Signature directly below photo
            const sx = signBox ? signBox.x : px
            const sy = signBox ? signBox.y : py + ph + Math.round(ph * 0.035)
            const sw = signBox ? signBox.w : pw
            const sh = signBox ? signBox.h : Math.round(ph * 0.40)

            const signCanvas = document.createElement('canvas')
            signCanvas.width = sw
            signCanvas.height = sh
            signCanvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
            const rawSign = signCanvas.toDataURL('image/png')
            result.signDataUrl = await cleanSignatureTransparency(rawSign)
          } else {
            // Standalone photo
            result.photoDataUrl = dataUrl
          }
          resolve(result)
        } catch (err) {
          resolve({ photoDataUrl: dataUrl, signDataUrl: '' })
        }
      }
      img.onerror = () => resolve({ photoDataUrl: '', signDataUrl: '' })
      img.src = dataUrl
    }
    reader.onerror = () => resolve({ photoDataUrl: '', signDataUrl: '' })
    reader.readAsDataURL(imageFile)
  })
}

