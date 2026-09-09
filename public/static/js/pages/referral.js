// ============================================================
// Referral — code sharing, referred users list, earnings
// ============================================================

async function renderReferralPage() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/referral')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">রেফারেল প্রোগ্রাম</h1>
      <p class="text-slate-400 text-sm mt-1">বন্ধুদের আমন্ত্রণ জানিয়ে বোনাস আয় করুন</p>
    </div>
    ${skeletonCard('h-40')}
    <div class="mt-6">${skeletonCard('h-64')}</div>
  `

  let data
  try {
    data = await ReferralService.summary()
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'তথ্য লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const refCode = data.referral_code || ''
  const refLink = `${window.location.origin}/register?ref=${refCode}`
  const referredUsers = data.referred_users || []

  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">রেফারেল প্রোগ্রাম</h1>
      <p class="text-slate-400 text-sm mt-1">বন্ধুদের আমন্ত্রণ জানিয়ে বোনাস আয় করুন</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      ${statCard({ icon: 'fa-user-plus', label: 'মোট রেফার', value: toBnDigits(data.total_referred || 0), gradient: 'from-sky-400 to-sky-600' })}
      ${statCard({ icon: 'fa-sack-dollar', label: 'মোট আয়', value: formatMoney(data.total_earned || 0), gradient: 'from-brand-400 to-brand-600' })}
    </div>

    <div class="glass rounded-2xl p-6 mb-6 relative overflow-hidden spot-card">
      <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-brand-400/20 to-violet-500/20 blur-3xl"></div>
      <div class="relative">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center shadow-lg animate-float-slow">
            <i class="fa-solid fa-gift text-white text-lg"></i>
          </div>
          <div>
            <h3 class="font-bold">আপনার রেফারেল কোড</h3>
            <p class="text-xs text-slate-400">বন্ধুরা প্রথম রিচার্জ সম্পন্ন করলে আপনি বোনাস পাবেন</p>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1.5">রেফারেল কোড</label>
          <div class="flex gap-2">
            <div class="flex-1 glass rounded-xl px-4 py-3 font-mono font-bold text-lg tracking-widest text-brand-400">${escapeHtml(refCode)}</div>
            <button id="copy-code-btn" class="btn-glow glass rounded-xl px-4 py-3 hover:text-brand-400" title="কপি করুন"><i class="fa-solid fa-copy"></i></button>
          </div>
        </div>

        <div>
          <label class="block text-xs text-slate-400 mb-1.5">রেফারেল লিংক</label>
          <div class="flex gap-2">
            <input readonly value="${escapeHtml(refLink)}" class="flex-1 glass rounded-xl px-4 py-3 text-sm outline-none truncate" />
            <button id="copy-link-btn" class="btn-glow glass rounded-xl px-4 py-3 hover:text-brand-400" title="কপি করুন"><i class="fa-solid fa-link"></i></button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-4">
          <a id="share-whatsapp" target="_blank" class="btn-glow flex items-center gap-2 bg-[#25D366]/15 text-[#25D366] text-xs font-semibold px-4 py-2.5 rounded-xl ring-1 ring-[#25D366]/30"><i class="fa-brands fa-whatsapp"></i> WhatsApp এ শেয়ার করুন</a>
          <a id="share-facebook" target="_blank" class="btn-glow flex items-center gap-2 bg-[#1877F2]/15 text-[#1877F2] text-xs font-semibold px-4 py-2.5 rounded-xl ring-1 ring-[#1877F2]/30"><i class="fa-brands fa-facebook"></i> Facebook এ শেয়ার করুন</a>
        </div>
      </div>
    </div>

    <div class="glass rounded-2xl p-6">
      <h3 class="font-bold mb-4"><i class="fa-solid fa-users text-brand-400 mr-2"></i>রেফার করা ইউজারগণ</h3>
      <div id="referred-list" class="space-y-2">
        ${referredUsers.length ? referredUsers.map((u) => `
          <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5">
            ${iconAvatar(u.name, 40)}
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">${escapeHtml(u.name)}</p>
              <p class="text-xs text-slate-500">${timeAgo(u.created_at)} যোগদান করেছেন</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-bold ${u.status === 'credited' ? 'text-brand-400' : 'text-amber-400'}">${u.status === 'credited' ? '+' + formatMoney(u.bonus_amount) : 'অপেক্ষমান'}</p>
              <p class="text-[10px] text-slate-500">${u.status === 'credited' ? 'বোনাস প্রদান হয়েছে' : 'প্রথম রিচার্জের অপেক্ষায়'}</p>
            </div>
          </div>`).join('') : emptyState('fa-user-group', 'এখনো কেউ রেফার হয়নি', 'আপনার লিংক শেয়ার করে বন্ধুদের আমন্ত্রণ জানান')}
      </div>
    </div>
  `

  qs('#copy-code-btn').addEventListener('click', () => copyToClipboard(refCode, 'রেফারেল কোড কপি হয়েছে!'))
  qs('#copy-link-btn').addEventListener('click', () => copyToClipboard(refLink, 'রেফারেল লিংক কপি হয়েছে!'))
  qs('#share-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`আমার রেফারেল লিংক দিয়ে জয়েন করুন এবং বোনাস পান: ${refLink}`)}`
  qs('#share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`
}

function copyToClipboard(text, successMsg) {
  navigator.clipboard?.writeText(text).then(
    () => showToast(successMsg, 'success'),
    () => showToast('কপি করা যায়নি।', 'error')
  )
}
