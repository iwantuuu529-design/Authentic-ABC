// ============================================================
// Wallet — balance overview, manual recharge, coupon redeem, history
// ============================================================

const RECHARGE_METHOD_LABELS = {
  bkash: { label: 'বিকাশ', icon: 'fa-mobile-screen', color: 'from-pink-500 to-rose-600' },
  nagad: { label: 'নগদ', icon: 'fa-mobile-screen', color: 'from-orange-500 to-amber-600' },
  rocket: { label: 'রকেট', icon: 'fa-mobile-screen', color: 'from-purple-500 to-violet-600' },
  upay: { label: 'উপায়', icon: 'fa-mobile-screen', color: 'from-sky-500 to-blue-600' },
  other: { label: 'অন্যান্য', icon: 'fa-wallet', color: 'from-slate-500 to-slate-600' },
}

async function renderWalletPage() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/wallet')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">ওয়ালেট</h1>
      <p class="text-slate-400 text-sm mt-1">ব্যালেন্স রিচার্জ করুন ও লেনদেনের হিসাব দেখুন</p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      ${Array(3).fill(0).map(() => skeletonCard('h-28')).join('')}
    </div>
    ${skeletonCard('h-96')}
  `

  let summary
  try {
    summary = await WalletService.summary()
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'তথ্য লোড করা যায়নি', getErrorMessage(err))
    return
  }

  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">ওয়ালেট</h1>
        <p class="text-slate-400 text-sm mt-1">ব্যালেন্স রিচার্জ করুন ও লেনদেনের হিসাব দেখুন</p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      ${statCard({ icon: 'fa-wallet', label: 'বর্তমান ব্যালেন্স', value: '', gradient: 'from-brand-400 to-brand-600', id: 'w-stat-balance' })}
      ${statCard({ icon: 'fa-money-bill-trend-up', label: 'মোট রিচার্জ', value: '', gradient: 'from-sky-400 to-sky-600', id: 'w-stat-recharge' })}
      ${statCard({ icon: 'fa-receipt', label: 'মোট খরচ', value: '', gradient: 'from-violet-400 to-violet-600', id: 'w-stat-spent' })}
    </div>

    <div class="flex flex-wrap gap-2 mb-6" id="wallet-tabs">
      <button data-tab="recharge" class="wallet-tab-btn btn-glow px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 text-white"><i class="fa-solid fa-circle-plus mr-1.5"></i>রিচার্জ করুন</button>
      <button data-tab="requests" class="wallet-tab-btn btn-glow px-5 py-2.5 rounded-xl text-sm font-semibold glass text-slate-300"><i class="fa-solid fa-clock-rotate-left mr-1.5"></i>রিচার্জ হিস্ট্রি</button>
      <button data-tab="transactions" class="wallet-tab-btn btn-glow px-5 py-2.5 rounded-xl text-sm font-semibold glass text-slate-300"><i class="fa-solid fa-list mr-1.5"></i>লেনদেন হিস্ট্রি</button>
    </div>

    <div id="wallet-tab-content"></div>
  `

  animateCount(qs('#w-stat-balance'), summary.balance || 0, 800, (n) => formatMoney(n))
  animateCount(qs('#w-stat-recharge'), summary.total_recharge || 0, 800, (n) => formatMoney(n))
  animateCount(qs('#w-stat-spent'), summary.total_spent || 0, 800, (n) => formatMoney(n))

  const tabsEl = qs('#wallet-tabs')
  const tabContent = qs('#wallet-tab-content')

  function setActiveTab(tab) {
    qsa('.wallet-tab-btn', tabsEl).forEach((b) => {
      const active = b.dataset.tab === tab
      b.classList.toggle('bg-brand-500', active)
      b.classList.toggle('text-white', active)
      b.classList.toggle('glass', !active)
      b.classList.toggle('text-slate-300', !active)
    })
    if (tab === 'recharge') renderRechargeTab(tabContent)
    else if (tab === 'requests') renderRechargeHistoryTab(tabContent)
    else renderTransactionsTab(tabContent)
  }

  qsa('.wallet-tab-btn', tabsEl).forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab))
  })

  setActiveTab('recharge')
}

// ------------------------------------------------------------
// Tab: Recharge (manual proof-based + coupon redeem)
// ------------------------------------------------------------
async function renderRechargeTab(container) {
  container.innerHTML = skeletonCard('h-96')

  let data
  try {
    data = await WalletService.paymentMethods()
  } catch (err) {
    container.innerHTML = emptyState('fa-triangle-exclamation', 'পেমেন্ট পদ্ধতি লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const methods = data.methods || []
  const autoGateways = data.auto_gateways || []

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">

        ${autoGateways.length ? `
        <div class="glass rounded-2xl p-6">
          <h3 class="font-bold mb-4"><i class="fa-solid fa-bolt text-brand-400 mr-2"></i>দ্রুত অটো রিচার্জ</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${autoGateways.map((g) => `
              <button disabled class="btn-glow glass rounded-xl p-4 flex items-center gap-3 opacity-60 cursor-not-allowed text-left">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center"><i class="fa-solid fa-bolt text-white"></i></div>
                <div>
                  <p class="font-semibold text-sm">${escapeHtml(g.name)}</p>
                  <p class="text-[11px] text-slate-500">শীঘ্রই আসছে</p>
                </div>
              </button>`).join('')}
          </div>
        </div>` : ''}

        <div class="glass rounded-2xl p-6 bg-sky-500/5 border-sky-500/10">
          <h3 class="font-bold mb-4 text-sm"><i class="fa-solid fa-circle-info text-sky-400 mr-2"></i>ম্যানুয়াল রিচার্জ পদ্ধতি</h3>
          <p class="text-xs text-slate-400 mb-4">নিচের যেকোনো নম্বরে "Send Money" করে ট্রানজেকশন আইডি ও প্রুফ সহ ফর্মটি পূরণ করুন। এডমিন যাচাই করার পর ব্যালেন্স যোগ হবে।</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${methods.map((m) => {
              const meta = RECHARGE_METHOD_LABELS[m.method] || RECHARGE_METHOD_LABELS.other
              return `
              <div class="glass rounded-xl p-4">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0"><i class="fa-solid ${meta.icon} text-white"></i></div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-sm">${escapeHtml(meta.label)} <span class="text-[10px] text-slate-500 font-normal">(${escapeHtml(m.account_type || 'Personal')})</span></p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <p class="text-sm font-mono font-bold text-brand-400 truncate">${escapeHtml(m.account_number)}</p>
                      <button type="button" class="copy-account-btn shrink-0 w-7 h-7 rounded-lg glass flex items-center justify-center text-slate-400 hover:text-brand-400 transition-colors" data-account="${escapeHtml(m.account_number)}" title="নম্বর কপি করুন" aria-label="নম্বর কপি করুন">
                        <i class="fa-regular fa-copy text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
                ${m.instructions_bn ? `<p class="text-[11px] text-slate-500">${escapeHtml(m.instructions_bn)}</p>` : ''}
              </div>`
            }).join('') || `<p class="text-sm text-slate-500 col-span-2">বর্তমানে কোনো ম্যানুয়াল পেমেন্ট পদ্ধতি সক্রিয় নেই।</p>`}
          </div>
        </div>

        <div class="glass rounded-2xl p-6">
          <h3 class="font-bold mb-4"><i class="fa-solid fa-paper-plane text-brand-400 mr-2"></i>রিচার্জ রিকুয়েস্ট সাবমিট করুন</h3>
          <form id="recharge-form" class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">পেমেন্ট মেথড <span class="text-rose-400">*</span></label>
              <select id="rf-method" name="method" required class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">
                <option value="">নির্বাচন করুন</option>
                ${methods.map((m) => `<option value="${m.method}">${escapeHtml((RECHARGE_METHOD_LABELS[m.method] || RECHARGE_METHOD_LABELS.other).label)}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">যে নম্বর থেকে পাঠিয়েছেন <span class="text-rose-400">*</span></label>
                <input type="text" id="rf-sender" name="sender_number" required placeholder="01XXXXXXXXX" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">আপনার WhatsApp নম্বর <span class="text-rose-400">*</span></label>
                <input type="text" id="rf-whatsapp" name="whatsapp_number" required placeholder="01XXXXXXXXX" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">ট্রানজেকশন আইডি <span class="text-rose-400">*</span></label>
                <input type="text" id="rf-txnid" name="transaction_id" required placeholder="যেমন: 8N7A6X5B4C" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">পরিমাণ (৳) <span class="text-rose-400">*</span></label>
                <input type="number" id="rf-amount" name="amount" min="10" required placeholder="সর্বনিম্ন ১০ টাকা" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">পেমেন্ট প্রুফ (স্ক্রিনশট) <span class="text-rose-400">*</span></label>
              <label for="rf-proof" id="rf-proof-dz" class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-xl px-4 py-6 cursor-pointer hover:border-brand-400/50 hover:bg-white/[0.02] transition-colors">
                <i class="fa-solid fa-cloud-arrow-up text-2xl text-slate-500"></i>
                <span class="text-xs text-slate-400 text-center" id="rf-proof-label">স্ক্রিনশট আপলোড করুন অথবা এখানে টেনে আনুন</span>
              </label>
              <input type="file" id="rf-proof" name="proof_file" accept="image/*,.pdf" required class="hidden" />
            </div>
            <button type="submit" id="recharge-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2">
              <i class="fa-solid fa-paper-plane"></i> রিকুয়েস্ট সাবমিট করুন
            </button>
          </form>
        </div>
      </div>

      <div class="space-y-6">
        <div class="glass rounded-2xl p-6">
          <h3 class="font-bold mb-3 text-sm"><i class="fa-solid fa-ticket text-violet-400 mr-2"></i>কুপন কোড রিডিম করুন</h3>
          <form id="coupon-form" class="flex gap-2">
            <input type="text" id="coupon-code" placeholder="কুপন কোড লিখুন" class="flex-1 glass rounded-xl px-4 py-2.5 text-sm outline-none input-glow uppercase" />
            <button type="submit" class="btn-glow bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shrink-0">রিডিম</button>
          </form>
        </div>
        <div class="glass rounded-2xl p-6 bg-amber-500/5 border-amber-500/10">
          <div class="flex items-start gap-2.5">
            <i class="fa-solid fa-shield-halved text-amber-400 mt-0.5"></i>
            <div>
              <p class="text-xs font-semibold text-amber-300 mb-1">নিরাপত্তা সতর্কতা</p>
              <p class="text-xs text-slate-400">সঠিক ট্রানজেকশন আইডি ও স্পষ্ট স্ক্রিনশট দিন। ভুল তথ্য দিলে রিকুয়েস্ট বাতিল হতে পারে।</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  qsa('.copy-account-btn', container).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const num = btn.dataset.account || ''
      copyToClipboard(num, 'নম্বরটি কপি হয়েছে!')
      const icon = btn.querySelector('i')
      if (icon) {
        icon.className = 'fa-solid fa-check text-xs text-brand-400'
        setTimeout(() => { icon.className = 'fa-regular fa-copy text-xs' }, 1500)
      }
    })
  })

  bindFileDropzones(container)
  qs('#rf-proof', container)?.addEventListener('change', () => {
    const f = qs('#rf-proof', container).files[0]
    if (f) qs('#rf-proof-label', container).textContent = f.name
  })

  qs('#recharge-form', container).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#recharge-submit', container)
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`
    try {
      const fd = new FormData(qs('#recharge-form', container))
      const res = await WalletService.createRechargeRequest(fd)
      showToast(res.message, 'success')
      qs('#recharge-form', container).reset()
      qs('#rf-proof-label', container).textContent = 'স্ক্রিনশট আপলোড করুন অথবা এখানে টেনে আনুন'
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> রিকুয়েস্ট সাবমিট করুন`
    }
  })

  qs('#coupon-form', container).addEventListener('submit', async (e) => {
    e.preventDefault()
    const code = qs('#coupon-code', container).value.trim()
    if (!code) return
    try {
      const res = await WalletService.redeemCoupon(code)
      showToast(res.message, 'success')
      qs('#coupon-code', container).value = ''
      const u = getStoredUser()
      if (u) { try { const me = await AuthService.me(); setStoredUser({ ...u, balance: me.balance }) } catch {} }
      const bal = qs('#w-stat-balance')
      if (bal) { try { const s = await WalletService.summary(); animateCount(bal, s.balance || 0, 600, (n) => formatMoney(n)) } catch {} }
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  })
}

// ------------------------------------------------------------
// Tab: Recharge request history
// ------------------------------------------------------------
async function renderRechargeHistoryTab(container) {
  container.innerHTML = skeletonCard('h-96')
  let data
  try {
    data = await WalletService.rechargeRequests()
  } catch (err) {
    container.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
    return
  }
  const list = data.requests || []
  if (!list.length) {
    container.innerHTML = emptyState('fa-clock-rotate-left', 'কোনো রিচার্জ রিকুয়েস্ট নেই', 'উপরের ফর্ম দিয়ে প্রথম রিচার্জ রিকুয়েস্ট পাঠান।')
    return
  }
  container.innerHTML = `
    <div class="glass rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/5 text-slate-400 text-xs">
              <th class="text-left px-5 py-3 font-medium">রিকুয়েস্ট নং</th>
              <th class="text-left px-5 py-3 font-medium">মেথড</th>
              <th class="text-left px-5 py-3 font-medium">পরিমাণ</th>
              <th class="text-left px-5 py-3 font-medium">অবস্থা</th>
              <th class="text-left px-5 py-3 font-medium">তারিখ</th>
              <th class="text-left px-5 py-3 font-medium">নোট</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((r) => `
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td class="px-5 py-3.5 font-mono text-xs">${r.request_no}</td>
                <td class="px-5 py-3.5">${escapeHtml((RECHARGE_METHOD_LABELS[r.method] || RECHARGE_METHOD_LABELS.other).label)}</td>
                <td class="px-5 py-3.5 font-bold">${formatMoney(r.amount)}</td>
                <td class="px-5 py-3.5">${statusBadge(r.status)}</td>
                <td class="px-5 py-3.5 text-xs text-slate-400">${timeAgo(r.created_at)}</td>
                <td class="px-5 py-3.5 text-xs text-slate-500 max-w-[160px] truncate">${escapeHtml(r.admin_note || '-')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

// ------------------------------------------------------------
// Tab: Transaction ledger (paginated)
// ------------------------------------------------------------
async function renderTransactionsTab(container) {
  let currentPage = 1
  container.innerHTML = `<div id="txn-list">${skeletonCard('h-96')}</div><div id="txn-pagination"></div>`

  async function load() {
    const listEl = qs('#txn-list', container)
    const pagEl = qs('#txn-pagination', container)
    listEl.innerHTML = skeletonCard('h-96')
    let data
    try {
      data = await WalletService.transactions(currentPage)
    } catch (err) {
      listEl.innerHTML = emptyState('fa-triangle-exclamation', 'লোড করা যায়নি', getErrorMessage(err))
      return
    }
    const list = data.transactions || []
    if (!list.length) {
      listEl.innerHTML = emptyState('fa-list', 'কোনো লেনদেন নেই', 'আপনার এখনো কোনো লেনদেন হয়নি।')
      return
    }
    listEl.innerHTML = `
      <div class="glass rounded-2xl divide-y divide-white/5">
        ${list.map((t) => `
          <div class="flex items-center gap-4 px-5 py-4">
            <div class="w-10 h-10 rounded-xl ${t.amount > 0 ? 'bg-brand-500/10' : 'bg-rose-500/10'} flex items-center justify-center shrink-0">
              <i class="fa-solid ${t.amount > 0 ? 'fa-arrow-down text-brand-400' : 'fa-arrow-up text-rose-400'}"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">${escapeHtml(t.description || t.type)}</p>
              <p class="text-xs text-slate-500">${formatDate(t.created_at)}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="font-bold ${t.amount > 0 ? 'text-brand-400' : 'text-rose-400'}">${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)}</p>
              <p class="text-[10px] text-slate-500">ব্যালেন্স: ${formatMoney(t.balance_after)}</p>
            </div>
          </div>`).join('')}
      </div>`

    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20)))
    pagEl.innerHTML = pagination(currentPage, totalPages, 'data-page')
    qsa('.page-btn', pagEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10)
        if (!p || p < 1 || p > totalPages) return
        currentPage = p
        load()
      })
    })
  }

  load()
}
