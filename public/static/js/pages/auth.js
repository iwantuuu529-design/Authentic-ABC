// ============================================================
// Auth pages: Login / Register — Design System v2
// UX: password visibility toggle, inline validation, password
// strength meter, pending-approval flow with clear next steps.
// ============================================================

function authShellWrap(innerHtml) {
  return `
  <div class="min-h-screen flex items-center justify-center px-4 py-10 page-enter relative overflow-hidden">
    <div class="absolute inset-0 hero-grid-pattern pointer-events-none"></div>
    <div class="absolute top-1/4 left-1/4 orb w-64 h-64 bg-brand-500/20 animate-float-slow"></div>
    <div class="absolute bottom-1/4 right-1/4 orb w-64 h-64 bg-violet-500/15 animate-float-slow" style="animation-delay:1s"></div>
    <img src="/static/img/logo.png" alt="" aria-hidden="true" class="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-none opacity-[0.04] blur-[1px]" />
    <div class="w-full max-w-md relative z-10">
      <a href="/" data-link class="flex items-center justify-center gap-2.5 mb-8">
        <img src="/static/img/logo.png" alt="ABC Authentic" class="w-10 h-10 object-contain drop-shadow-[0_2px_10px_rgba(23,184,129,0.35)]" />
        <span class="font-extrabold text-xl tracking-tight">ABC<span class="text-brand-400">Authentic</span></span>
      </a>
      <div class="glass-strong rounded-3xl p-6 sm:p-8 shadow-2xl">
        ${innerHtml}
      </div>
      <div class="flex items-center justify-center gap-4 mt-6 text-[11px] text-slate-500">
        <span class="flex items-center gap-1.5"><i class="fa-solid fa-shield-halved text-brand-500/80"></i> নিরাপদ লগইন</span>
        <span class="flex items-center gap-1.5"><i class="fa-solid fa-lock text-brand-500/80"></i> এনক্রিপ্টেড সেশন</span>
        <span class="flex items-center gap-1.5"><i class="fa-solid fa-headset text-brand-500/80"></i> ২৪/৭ সাপোর্ট</span>
      </div>
    </div>
  </div>`
}

/** Password input with show/hide toggle. */
function authPasswordField(id, placeholder, autocomplete = 'current-password') {
  return `
  <div class="relative">
    <i class="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
    <input type="password" id="${id}" placeholder="${placeholder}" autocomplete="${autocomplete}"
      class="w-full glass rounded-xl pl-11 pr-12 py-3 text-sm outline-none input-glow" required />
    <button type="button" data-toggle-pw="${id}" aria-label="পাসওয়ার্ড দেখুন/লুকান"
      class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-400 transition-colors">
      <i class="fa-solid fa-eye"></i>
    </button>
  </div>`
}

function bindPasswordToggles(root = document) {
  qsa('[data-toggle-pw]', root).forEach((btn) => {
    if (btn._pwBound) return
    btn._pwBound = true
    btn.addEventListener('click', () => {
      const input = qs('#' + btn.dataset.togglePw, root)
      if (!input) return
      const show = input.type === 'password'
      input.type = show ? 'text' : 'password'
      btn.innerHTML = `<i class="fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`
    })
  })
}

/** Inline error under a field (adds a shake + message). */
function setFieldError(input, message) {
  input.classList.add('ds-invalid')
  let hint = input.closest('.form-field, div')?.querySelector('.ds-field-error')
  if (!hint) {
    hint = document.createElement('p')
    hint.className = 'ds-field-error'
    input.closest('div').parentElement.appendChild(hint)
  }
  hint.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(message)}`
}
function clearFieldError(input) {
  input.classList.remove('ds-invalid')
  input.closest('.form-field, div')?.parentElement?.querySelector('.ds-field-error')?.remove()
}

// ---------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------
async function renderLoginPage() {
  qs('#app').innerHTML = authShellWrap(`
    <h1 class="text-2xl font-extrabold mb-1.5">স্বাগতম ফিরে! 👋</h1>
    <p class="text-slate-400 text-sm mb-6">আপনার অ্যাকাউন্টে লগইন করুন</p>
    <form id="login-form" class="space-y-4" novalidate>
      <div>
        <label for="login-phone" class="block text-sm font-medium text-slate-300 mb-2">মোবাইল নম্বর / ইমেইল</label>
        <div class="relative">
          <i class="fa-solid fa-mobile-screen absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          <input type="text" id="login-phone" placeholder="01xxxxxxxxx" autocomplete="username"
            class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" required />
        </div>
      </div>
      <div>
        <label for="login-password" class="block text-sm font-medium text-slate-300 mb-2">পাসওয়ার্ড</label>
        ${authPasswordField('login-password', '••••••••')}
      </div>
      <button type="submit" id="login-submit" class="btn-glow btn-press w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2">
        <i class="fa-solid fa-arrow-right-to-bracket"></i><span>লগইন করুন</span>
      </button>
    </form>
    <p class="text-center text-sm text-slate-400 mt-6">অ্যাকাউন্ট নেই? <a href="/register" data-link class="text-brand-400 font-semibold hover:underline">রেজিস্ট্রেশন করুন</a></p>
  `)

  bindPasswordToggles()

  qs('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#login-submit')
    const phoneInput = qs('#login-phone')
    const passwordInput = qs('#login-password')
    const phone = phoneInput.value.trim()
    const password = passwordInput.value

    // Client-side inline validation before hitting the server
    clearFieldError(phoneInput)
    clearFieldError(passwordInput)
    if (!phone) { setFieldError(phoneInput, 'মোবাইল নম্বর বা ইমেইল দিন'); phoneInput.focus(); return }
    if (!password) { setFieldError(passwordInput, 'পাসওয়ার্ড দিন'); passwordInput.focus(); return }

    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> লগইন হচ্ছে...`
    try {
      const res = await AuthService.login({ phone, password })
      showToast(res.message, 'success')
      navigate(res.user.role === 'admin' || res.user.role === 'staff' ? '/admin' : '/dashboard', true)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      if (err && err.pending) passwordInput.value = ''
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i><span>লগইন করুন</span>`
    }
  })
}

// ---------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------
async function renderRegisterPage() {
  const urlParams = new URLSearchParams(window.location.search)
  const refCode = urlParams.get('ref') || ''

  qs('#app').innerHTML = authShellWrap(`
    <h1 class="text-2xl font-extrabold mb-1.5">নতুন অ্যাকাউন্ট তৈরি করুন</h1>
    <p class="text-slate-400 text-sm mb-6">মাত্র কয়েক সেকেন্ডে রেজিস্ট্রেশন সম্পন্ন করুন</p>
    <form id="register-form" class="space-y-4" novalidate>
      <div>
        <label for="reg-name" class="block text-sm font-medium text-slate-300 mb-2">পূর্ণ নাম <span class="text-rose-400">*</span></label>
        <div class="relative">
          <i class="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          <input type="text" id="reg-name" placeholder="আপনার নাম" autocomplete="name"
            class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" required />
        </div>
      </div>
      <div>
        <label for="reg-phone" class="block text-sm font-medium text-slate-300 mb-2">মোবাইল নম্বর <span class="text-rose-400">*</span></label>
        <div class="relative">
          <i class="fa-solid fa-mobile-screen absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          <input type="tel" id="reg-phone" placeholder="01xxxxxxxxx" maxlength="11" autocomplete="tel"
            class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" required />
        </div>
      </div>
      <div>
        <label for="reg-email" class="block text-sm font-medium text-slate-300 mb-2">ইমেইল <span class="text-slate-500 font-normal">(ঐচ্ছিক)</span></label>
        <div class="relative">
          <i class="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          <input type="email" id="reg-email" placeholder="example@mail.com" autocomplete="email"
            class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" />
        </div>
      </div>
      <div>
        <label for="reg-password" class="block text-sm font-medium text-slate-300 mb-2">পাসওয়ার্ড <span class="text-rose-400">*</span></label>
        ${authPasswordField('reg-password', 'কমপক্ষে ৬ অক্ষর', 'new-password')}
        <div id="reg-pw-meter" class="mt-2 hidden">
          <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div id="reg-pw-meter-bar" class="h-full w-0 rounded-full transition-all duration-300 bg-rose-500"></div>
          </div>
          <p id="reg-pw-meter-label" class="text-[11px] text-slate-500 mt-1"></p>
        </div>
      </div>
      <div>
        <label for="reg-ref" class="block text-sm font-medium text-slate-300 mb-2">রেফারেল কোড <span class="text-slate-500 font-normal">(ঐচ্ছিক)</span></label>
        <div class="relative">
          <i class="fa-solid fa-gift absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          <input type="text" id="reg-ref" value="${escapeHtml(refCode)}" placeholder="থাকলে দিন"
            class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" />
        </div>
      </div>
      <button type="submit" id="register-submit" class="btn-glow btn-press w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2">
        <i class="fa-solid fa-user-plus"></i><span>রেজিস্ট্রেশন সম্পন্ন করুন</span>
      </button>
      <p class="text-[11px] text-slate-500 text-center leading-relaxed">রেজিস্ট্রেশনের পর অ্যাকাউন্টটি অ্যাডমিন অনুমোদনের অপেক্ষায় থাকবে — অনুমোদন হলে লগইন করতে পারবেন।</p>
    </form>
    <p class="text-center text-sm text-slate-400 mt-6">ইতোমধ্যে অ্যাকাউন্ট আছে? <a href="/login" data-link class="text-brand-400 font-semibold hover:underline">লগইন করুন</a></p>
  `)

  bindPasswordToggles()

  // Live password strength meter
  const pwInput = qs('#reg-password')
  pwInput.addEventListener('input', () => {
    const meter = qs('#reg-pw-meter')
    const bar = qs('#reg-pw-meter-bar')
    const label = qs('#reg-pw-meter-label')
    const v = pwInput.value
    if (!v) { meter.classList.add('hidden'); return }
    meter.classList.remove('hidden')
    let score = 0
    if (v.length >= 6) score++
    if (v.length >= 8) score++
    if (/[0-9]/.test(v)) score++
    if (/[^a-zA-Z0-9]/.test(v) || /[A-Z]/.test(v)) score++
    const levels = [
      { w: '25%', c: '#f43f5e', t: 'দুর্বল পাসওয়ার্ড' },
      { w: '50%', c: '#f59e0b', t: 'মোটামুটি — আরেকটু লম্বা করুন' },
      { w: '75%', c: '#38bdf8', t: 'ভালো' },
      { w: '100%', c: '#17b881', t: 'চমৎকার পাসওয়ার্ড' },
    ]
    const lvl = levels[Math.max(0, Math.min(3, score - 1))]
    bar.style.width = v.length < 6 ? '12%' : lvl.w
    bar.style.background = v.length < 6 ? '#f43f5e' : lvl.c
    label.textContent = v.length < 6 ? 'কমপক্ষে ৬ অক্ষর প্রয়োজন' : lvl.t
  })

  qs('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#register-submit')
    const nameInput = qs('#reg-name')
    const phoneInput = qs('#reg-phone')
    const payload = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      email: qs('#reg-email').value.trim(),
      password: pwInput.value,
      referral_code: qs('#reg-ref').value.trim(),
    }

    // Inline validation mirrors the server rules so users get instant feedback
    clearFieldError(nameInput)
    clearFieldError(phoneInput)
    clearFieldError(pwInput)
    let firstBad = null
    if (payload.name.length < 2) { setFieldError(nameInput, 'সঠিক নাম দিন (কমপক্ষে ২ অক্ষর)'); firstBad = firstBad || nameInput }
    if (!/^01[3-9][0-9]{8}$/.test(payload.phone)) { setFieldError(phoneInput, 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01xxxxxxxxx)'); firstBad = firstBad || phoneInput }
    if (payload.password.length < 6) { setFieldError(pwInput, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); firstBad = firstBad || pwInput }
    if (firstBad) { firstBad.focus(); return }

    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> তৈরি হচ্ছে...`
    try {
      const res = await AuthService.register(payload)
      if (res.pending) {
        renderPendingApprovalNotice()
        return
      }
      setStoredUser(res.user)
      showToast(res.message, 'success')
      navigate('/dashboard', true)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i><span>রেজিস্ট্রেশন সম্পন্ন করুন</span>`
    }
  })
}

// ---------------------------------------------------------------
// Pending approval notice (post-registration)
// ---------------------------------------------------------------
function renderPendingApprovalNotice() {
  qs('#app').innerHTML = authShellWrap(`
    <div class="text-center">
      <div class="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-5 text-amber-400 text-2xl animate-pop-in">
        <i class="fa-solid fa-hourglass-half"></i>
      </div>
      <h1 class="text-xl font-extrabold mb-2">রেজিস্ট্রেশন সফল হয়েছে! 🎉</h1>
      <p class="text-slate-400 text-sm leading-relaxed mb-5">আপনার অ্যাকাউন্টটি সফলভাবে তৈরি হয়েছে এবং এখন <b class="text-amber-400">অ্যাডমিন অনুমোদনের অপেক্ষায়</b> আছে। অনুমোদন হয়ে গেলে আপনি লগইন করে সকল সার্ভিস ব্যবহার করতে পারবেন।</p>
      <div class="glass rounded-xl p-4 mb-6 text-left space-y-2.5">
        <p class="text-xs font-bold text-slate-300 mb-1"><i class="fa-solid fa-list-check text-brand-400 mr-1.5"></i>এরপর কী হবে:</p>
        <p class="text-xs text-slate-400 flex gap-2"><span class="text-brand-400 font-bold">১.</span> আমাদের টিম আপনার তথ্য যাচাই করবে</p>
        <p class="text-xs text-slate-400 flex gap-2"><span class="text-brand-400 font-bold">২.</span> অনুমোদন হলে নোটিফিকেশন পাবেন</p>
        <p class="text-xs text-slate-400 flex gap-2"><span class="text-brand-400 font-bold">৩.</span> এরপর লগইন করে সার্ভিস নিতে পারবেন</p>
      </div>
      <a href="/login" data-link class="btn-glow btn-press inline-flex items-center justify-center gap-2 w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25">
        <i class="fa-solid fa-arrow-right-to-bracket"></i><span>লগইন পেজে যান</span>
      </a>
    </div>
  `)
}
