// ============================================================
// Landing Page — public marketing page with animated hero
// ============================================================

async function renderLandingPage() {
  let services = []
  let categories = []
  try {
    const res = await API.get('/services')
    services = (res.services || []).filter((s) => s.is_featured).slice(0, 6)
    categories = res.categories || []
  } catch {}

  const user = getStoredUser()
  const ctaHref = user ? (user.role === 'admin' || user.role === 'staff' ? '/admin' : '/dashboard') : '/register'
  const ctaLabel = user ? 'ড্যাশবোর্ডে যান' : 'ফ্রি অ্যাকাউন্ট খুলুন'

  qs('#app').innerHTML = `
  <div class="page-enter">
    <!-- Nav -->
    <nav class="sticky top-0 z-40 glass-strong border-b border-white/5">
      <div class="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <a href="/" data-link class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <i class="fa-solid fa-shield-check text-white text-sm"></i>
          </div>
          <span class="font-extrabold text-lg tracking-tight">ABC<span class="text-brand-400">Authentic</span></span>
        </a>
        <div class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#services" class="hover:text-brand-400 transition-colors">সার্ভিসসমূহ</a>
          <a href="#how" class="hover:text-brand-400 transition-colors">কিভাবে কাজ করে</a>
          <a href="#trust" class="hover:text-brand-400 transition-colors">নিরাপত্তা</a>
        </div>
        <div class="flex items-center gap-3">
          ${user ? '' : `<a href="/login" data-link class="hidden sm:inline-block text-sm font-medium text-slate-300 hover:text-white">লগইন</a>`}
          <a href="${ctaHref}" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg shadow-brand-500/25">${ctaLabel}</a>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="relative max-w-7xl mx-auto px-4 lg:px-6 pt-16 pb-24 lg:pt-24 lg:pb-32 text-center overflow-hidden">
      <div class="absolute top-10 left-10 orb w-32 h-32 bg-brand-500/30 animate-float-slow"></div>
      <div class="absolute bottom-10 right-16 orb w-40 h-40 bg-violet-500/25 animate-float-slow" style="animation-delay:1.5s"></div>

      <div class="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-semibold text-brand-400 mb-6 animate-fade-up">
        <span class="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
        দ্রুত, নিরাপদ, নির্ভরযোগ্য
      </div>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 animate-fade-up" style="animation-delay:.08s">
        সরকারি ডকুমেন্ট সেবা এখন<br class="hidden sm:block" />
        <span class="text-gradient">এক ক্লিকেই সহজ</span>
      </h1>
      <p class="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-10 animate-fade-up" style="animation-delay:.16s">
        জন্ম নিবন্ধন, এনআইডি, ভূমি সেবা — সব একটি নিরাপদ ওয়ালেট-ভিত্তিক প্ল্যাটফর্মে। স্বয়ংক্রিয় API এবং দক্ষ টিমের সমন্বয়ে দ্রুততম সেবা পান।
      </p>
      <div class="flex flex-wrap items-center justify-center gap-4 animate-fade-up" style="animation-delay:.24s">
        <a href="${ctaHref}" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-brand-500/30 flex items-center gap-2">
          <i class="fa-solid fa-rocket"></i> ${ctaLabel}
        </a>
        <a href="#services" class="btn-glow glass font-bold px-8 py-4 rounded-2xl flex items-center gap-2">
          <i class="fa-solid fa-play"></i> সার্ভিস দেখুন
        </a>
      </div>

      <div class="grid grid-cols-3 gap-4 max-w-xl mx-auto mt-16 animate-fade-up" style="animation-delay:.32s">
        <div class="glass rounded-2xl p-4">
          <p class="text-2xl font-extrabold text-brand-400" data-counter="15000">০</p>
          <p class="text-xs text-slate-400 mt-1">সম্পন্ন অর্ডার</p>
        </div>
        <div class="glass rounded-2xl p-4">
          <p class="text-2xl font-extrabold text-brand-400" data-counter="98">০</p>
          <p class="text-xs text-slate-400 mt-1">সফলতার হার %</p>
        </div>
        <div class="glass rounded-2xl p-4">
          <p class="text-2xl font-extrabold text-brand-400"><span data-counter="24"></span>/৭</p>
          <p class="text-xs text-slate-400 mt-1">সাপোর্ট চালু</p>
        </div>
      </div>
    </section>

    <!-- Services -->
    <section id="services" class="max-w-7xl mx-auto px-4 lg:px-6 py-20">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-extrabold mb-3">জনপ্রিয় সার্ভিসসমূহ</h2>
        <p class="text-slate-400">আপনার প্রয়োজনীয় সরকারি ডকুমেন্ট সার্ভিস বেছে নিন</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${services.length ? services.map((s, i) => `
          <div class="spot-card glass rounded-2xl p-6 animate-fade-up" style="animation-delay:${i * 0.06}s">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400/20 to-violet-500/20 flex items-center justify-center mb-4">
              <i class="fa-solid ${s.icon || 'fa-file-lines'} text-brand-400 text-lg"></i>
            </div>
            <h3 class="font-bold mb-1.5">${escapeHtml(s.name_bn)}</h3>
            <p class="text-slate-400 text-sm mb-4 line-clamp-2">${escapeHtml(s.description_bn || '')}</p>
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-brand-400">${formatMoney(s.price)}</span>
              <a href="${ctaHref}" data-link class="text-xs font-semibold text-slate-300 hover:text-brand-400">অর্ডার করুন <i class="fa-solid fa-arrow-right ml-1"></i></a>
            </div>
          </div>`).join('') : Array(6).fill(0).map(() => skeletonCard('h-48')).join('')}
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="max-w-7xl mx-auto px-4 lg:px-6 py-20">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-extrabold mb-3">মাত্র ৩ ধাপে সম্পন্ন করুন</h2>
        <p class="text-slate-400">দ্রুত, সহজ ও নিরাপদ প্রক্রিয়া</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        ${[
          { icon: 'fa-wallet', title: 'ওয়ালেট রিচার্জ করুন', desc: 'বিকাশ, নগদ বা অন্য মাধ্যমে সহজেই ব্যালেন্স যোগ করুন — ম্যানুয়াল বা অটো, দুই উপায়ে।' },
          { icon: 'fa-file-pen', title: 'সার্ভিস অর্ডার করুন', desc: 'পছন্দের সার্ভিস বেছে নিয়ে প্রয়োজনীয় তথ্য দিয়ে ফর্ম জমা দিন।' },
          { icon: 'fa-circle-check', title: 'ফলাফল সংগ্রহ করুন', desc: 'স্বয়ংক্রিয়ভাবে অথবা আমাদের টিমের মাধ্যমে দ্রুত ফলাফল পেয়ে যান।' },
        ].map((step, i) => `
        <div class="spot-card glass rounded-2xl p-8 text-center relative animate-fade-up" style="animation-delay:${i * 0.1}s">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-brand-500/20 animate-float-slow" style="animation-delay:${i * 0.3}s">
            <i class="fa-solid ${step.icon} text-white text-xl"></i>
          </div>
          <span class="absolute top-4 right-5 text-4xl font-black text-white/5">০${i + 1}</span>
          <h3 class="font-bold text-lg mb-2">${step.title}</h3>
          <p class="text-slate-400 text-sm">${step.desc}</p>
        </div>`).join('')}
      </div>
    </section>

    <!-- Trust -->
    <section id="trust" class="max-w-7xl mx-auto px-4 lg:px-6 py-20">
      <div class="glass-strong rounded-3xl p-8 lg:p-14 relative overflow-hidden">
        <div class="absolute -top-20 -right-20 w-60 h-60 bg-brand-500/15 rounded-full blur-[100px]"></div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
          <div>
            <h2 class="text-3xl font-extrabold mb-4">নিরাপত্তা ও স্বচ্ছতাই আমাদের অগ্রাধিকার</h2>
            <p class="text-slate-400 mb-6">প্রতিটি লেনদেন এনক্রিপ্টেড ও সম্পূর্ণ অডিট-ট্রেইল সহ সংরক্ষিত। রিয়েল-টাইম নোটিফিকেশনের মাধ্যমে সবসময় আপডেট থাকুন।</p>
            <div class="space-y-3">
              ${[
                'ম্যানুয়াল ও স্বয়ংক্রিয় উভয় পেমেন্ট সিস্টেম সমর্থিত',
                'ব্যর্থ অর্ডারে স্বয়ংক্রিয় রিফান্ড নিশ্চিত',
                'প্রতিটি লেনদেনের সম্পূর্ণ হিস্ট্রি ও রশিদ',
                'সার্বক্ষণিক সাপোর্ট টিকেট সিস্টেম',
              ].map((item) => `
              <div class="flex items-center gap-3">
                <div class="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                  <i class="fa-solid fa-check text-brand-400 text-xs"></i>
                </div>
                <span class="text-sm text-slate-300">${item}</span>
              </div>`).join('')}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${categories.slice(0, 4).map((cat) => `
            <div class="glass rounded-2xl p-6 text-center animate-float-slow" style="animation-delay:${Math.random()}s">
              <i class="fa-solid ${cat.icon} text-2xl text-brand-400 mb-3"></i>
              <p class="text-sm font-semibold">${escapeHtml(cat.name_bn)}</p>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-4xl mx-auto px-4 lg:px-6 py-20 text-center">
      <h2 class="text-3xl font-extrabold mb-4">আজই শুরু করুন</h2>
      <p class="text-slate-400 mb-8">মাত্র কয়েক মিনিটে অ্যাকাউন্ট তৈরি করে সার্ভিস নেওয়া শুরু করুন।</p>
      <a href="${ctaHref}" data-link class="btn-glow inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-10 py-4 rounded-2xl shadow-xl shadow-brand-500/30">
        <i class="fa-solid fa-rocket"></i> ${ctaLabel}
      </a>
    </section>

    <!-- Footer -->
    <footer class="border-t border-white/5 py-10">
      <div class="max-w-7xl mx-auto px-4 lg:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center">
            <i class="fa-solid fa-shield-check text-white text-xs"></i>
          </div>
          <span class="font-bold">ABC<span class="text-brand-400">Authentic</span></span>
        </div>
        <p class="text-xs text-slate-500">© ${new Date().getFullYear()} ABC Authentic — সর্বস্বত্ব সংরক্ষিত।</p>
      </div>
    </footer>
  </div>`

  // Animate counters
  qsa('[data-counter]').forEach((el) => {
    const target = parseInt(el.dataset.counter, 10)
    animateCount(el, target, 1400, (n) => toBnDigits(Math.round(n)))
  })
}
