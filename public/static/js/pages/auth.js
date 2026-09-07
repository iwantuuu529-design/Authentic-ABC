// ============================================================
// Auth pages: Login / Register
// ============================================================

function authShellWrap(innerHtml) {
  return `
  <div class="min-h-screen flex items-center justify-center px-4 py-12 page-enter relative overflow-hidden">
    <div class="absolute top-1/4 left-1/4 orb w-64 h-64 bg-brand-500/20 animate-float-slow"></div>
    <div class="absolute bottom-1/4 right-1/4 orb w-64 h-64 bg-violet-500/15 animate-float-slow" style="animation-delay:1s"></div>
    <img src="/static/img/logo.png" alt="" aria-hidden="true" class="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-none opacity-[0.04] blur-[1px]" />
    <div class="w-full max-w-md relative z-10">
      <a href="/" data-link class="flex items-center justify-center gap-2.5 mb-8">
        <img src="/static/img/logo.png" alt="ABC Authentic" class="w-10 h-10 object-contain drop-shadow-[0_2px_10px_rgba(23,184,129,0.35)]" />
      <span class="font-extrabold text-xl tracking-tight">ABC<span class="text-brand-400">Authentic</span></span>
      </a>
      <div class="glass-strong rounded-3xl p-8 shadow-2xl">
        ${innerHtml}
      </div>
    </div>
  </div>`
}

async function renderLoginPage() {
  qs('#app').innerHTML = authShellWrap(`
    <h1 class="text-2xl font-extrabold mb-1.5">স্বাগতম ফিরে!</h1>
    <p class="text-slate-400 text-sm mb-6">আপনার অ্যাকাউন্টে লগইন করুন</p>
    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">মোবাইল নম্বর / ইমেইল</label>
        <div class="relative">
          <i class="fa-solid fa-mobile-screen absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input type="text" id="login-phone" placeholder="01xxxxxxxxx" class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" required />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">পাসওয়ার্ড</label>
        <div class="relative">
          <i class="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input type="password" id="login-password" placeholder="••••••••" class="w-full glass rounded-xl pl-11 pr-4 py-3 text-sm outline-none input-glow" required />
        </div>
      </div>
      <button type="submit" id="login-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2">
        <span>লগইন করুন</span>
      </button>
    </form>
    <p class="text-center text-sm text-slate-400 mt-6">অ্যাকাউন্ট নেই? <a href="/register" data-link class="text-brand-400 font-semibold hover:underline">রেজিস্ট্রেশন করুন</a></p>
  `)

  qs('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#login-submit')
    const phone = qs('#login-phone').value.trim()
    const password = qs('#login-password').value

    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> লগইন হচ্ছে...`
    try {
      const res = await API.post('/auth/login', { phone, password })
      setStoredUser(res.user)
      showToast(res.message, 'success')
      navigate(res.user.role === 'admin' || res.user.role === 'staff' ? '/admin' : '/dashboard', true)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
      btn.innerHTML = `<span>লগইন করুন</span>`
    }
  })
}

async function renderRegisterPage() {
  const urlParams = new URLSearchParams(window.location.search)
  const refCode = urlParams.get('ref') || ''

  qs('#app').innerHTML = authShellWrap(`
    <h1 class="text-2xl font-extrabold mb-1.5">নতুন অ্যাকাউন্ট তৈরি করুন</h1>
    <p class="text-slate-400 text-sm mb-6">মাত্র কয়েক সেকেন্ডে রেজিস্ট্রেশন সম্পন্ন করুন</p>
    <form id="register-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">পূর্ণ নাম</label>
        <input type="text" id="reg-name" placeholder="আপনার নাম" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" required />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">মোবাইল নম্বর</label>
        <input type="text" id="reg-phone" placeholder="01xxxxxxxxx" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" required />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">ইমেইল (ঐচ্ছিক)</label>
        <input type="email" id="reg-email" placeholder="example@mail.com" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">পাসওয়ার্ড</label>
        <input type="password" id="reg-password" placeholder="কমপক্ষে ৬ অক্ষর" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" required />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">রেফারেল কোড (ঐচ্ছিক)</label>
        <input type="text" id="reg-ref" value="${escapeHtml(refCode)}" placeholder="থাকলে দিন" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
      </div>
      <button type="submit" id="register-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25">
        <span>রেজিস্ট্রেশন সম্পন্ন করুন</span>
      </button>
    </form>
    <p class="text-center text-sm text-slate-400 mt-6">ইতোমধ্যে অ্যাকাউন্ট আছে? <a href="/login" data-link class="text-brand-400 font-semibold hover:underline">লগইন করুন</a></p>
  `)

  qs('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#register-submit')
    const payload = {
      name: qs('#reg-name').value.trim(),
      phone: qs('#reg-phone').value.trim(),
      email: qs('#reg-email').value.trim(),
      password: qs('#reg-password').value,
      referral_code: qs('#reg-ref').value.trim(),
    }
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> তৈরি হচ্ছে...`
    try {
      const res = await API.post('/auth/register', payload)
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
      btn.innerHTML = `<span>রেজিস্ট্রেশন সম্পন্ন করুন</span>`
    }
  })
}

function renderPendingApprovalNotice() {
  qs('#app').innerHTML = authShellWrap(`
    <div class="text-center">
      <div class="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-5 text-amber-400 text-2xl">
        <i class="fa-solid fa-clock"></i>
      </div>
      <h1 class="text-xl font-extrabold mb-2">রেজিস্ট্রেশন সফল হয়েছে!</h1>
      <p class="text-slate-400 text-sm leading-relaxed mb-6">আপনার অ্যাকাউন্টটি সফলভাবে তৈরি হয়েছে এবং এখন <b class="text-amber-400">অ্যাডমিন অনুমোদনের অপেক্ষায়</b> আছে। অনুমোদন হয়ে গেলে আপনি লগইন করে সকল সার্ভিস ব্যবহার করতে পারবেন।</p>
      <a href="/login" data-link class="btn-glow inline-flex items-center justify-center gap-2 w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25">
        <i class="fa-solid fa-arrow-right-to-bracket"></i><span>লগইন পেজে যান</span>
      </a>
    </div>
  `)
}
