// ============================================================
// Support — ticket list, create, detail thread with reply
// ============================================================

const SUPPORT_CATEGORIES = [
  { key: 'general', label: 'সাধারণ' },
  { key: 'order', label: 'অর্ডার সংক্রান্ত' },
  { key: 'payment', label: 'পেমেন্ট সংক্রান্ত' },
  { key: 'account', label: 'একাউন্ট সংক্রান্ত' },
  { key: 'other', label: 'অন্যান্য' },
]

async function renderSupportPage() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/support')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">সাপোর্ট</h1>
        <p class="text-slate-400 text-sm mt-1">আপনার সমস্যা বা প্রশ্ন জানান</p>
      </div>
      <button id="new-ticket-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2">
        <i class="fa-solid fa-plus"></i> নতুন টিকেট
      </button>
    </div>
    <div id="tickets-list" class="space-y-3">
      ${Array(4).fill(0).map(() => skeletonCard('h-20')).join('')}
    </div>
  `

  qs('#new-ticket-btn').addEventListener('click', openNewTicketModal)

  let data
  try {
    data = await SupportService.listTickets()
  } catch (err) {
    qs('#tickets-list').innerHTML = emptyState('fa-triangle-exclamation', 'টিকেট লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const list = data.tickets || []
  const listEl = qs('#tickets-list')
  if (!list.length) {
    listEl.innerHTML = emptyState('fa-headset', 'কোনো টিকেট নেই', 'কোনো সমস্যা হলে নতুন টিকেট খুলে আমাদের জানান।', `<button id="empty-new-ticket-btn" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">নতুন টিকেট খুলুন</button>`)
    qs('#empty-new-ticket-btn')?.addEventListener('click', openNewTicketModal)
    return
  }

  listEl.innerHTML = list.map((t, i) => `
    <a href="/dashboard/support/${t.id}" data-link class="spot-card glass rounded-2xl p-4 flex items-center gap-4 animate-fade-up block" style="animation-delay:${Math.min(i * 0.05, 0.3)}s">
      <div class="w-11 h-11 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
        <i class="fa-solid fa-ticket text-sky-400"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm truncate">${escapeHtml(t.subject)}</p>
        <p class="text-xs text-slate-500">${t.ticket_no} • ${timeAgo(t.updated_at)}</p>
      </div>
      ${statusBadge(t.status)}
      <i class="fa-solid fa-chevron-right text-slate-600 text-xs hidden sm:block"></i>
    </a>`).join('')

  initPageEffects(listEl)
}

function openNewTicketModal() {
  const modal = openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-5"><i class="fa-solid fa-ticket text-brand-400 mr-2"></i>নতুন সাপোর্ট টিকেট</h3>
      <form id="new-ticket-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">ক্যাটাগরি</label>
          <select id="nt-category" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow">
            ${SUPPORT_CATEGORIES.map((c) => `<option value="${c.key}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">বিষয় <span class="text-rose-400">*</span></label>
          <input type="text" id="nt-subject" required placeholder="সংক্ষেপে বিষয় লিখুন" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">বিস্তারিত বার্তা <span class="text-rose-400">*</span></label>
          <textarea id="nt-message" required rows="4" placeholder="আপনার সমস্যা বিস্তারিত লিখুন..." class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow"></textarea>
        </div>
        <button type="submit" id="nt-submit" class="btn-glow w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
          <i class="fa-solid fa-paper-plane"></i> টিকেট সাবমিট করুন
        </button>
      </form>
    </div>`, { maxWidth: 'max-w-lg' })

  qs('#new-ticket-form', modal).addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#nt-submit', modal)
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`
    try {
      const res = await SupportService.createTicket({
        category: qs('#nt-category', modal).value,
        subject: qs('#nt-subject', modal).value,
        message: qs('#nt-message', modal).value,
      })
      showToast(res.message, 'success')
      closeModal()
      navigate(`/dashboard/support/${res.ticket_id}`)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> টিকেট সাবমিট করুন`
    }
  })
}

// ------------------------------------------------------------
// Ticket detail — message thread
// ------------------------------------------------------------
async function renderSupportDetailPage(params) {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/support')}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `<div class="max-w-3xl mx-auto space-y-4">${skeletonCard('h-24')}${skeletonCard('h-96')}</div>`

  async function load() {
    let data
    try {
      data = await SupportService.getTicket(params.id)
    } catch (err) {
      content.innerHTML = emptyState('fa-triangle-exclamation', 'টিকেট পাওয়া যায়নি', getErrorMessage(err), `<a href="/dashboard/support" data-link class="btn-glow bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সব টিকেট</a>`)
      return
    }

    const ticket = data.ticket
    const messages = data.messages || []
    const isClosed = ticket.status === 'closed'

    content.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        <a href="/dashboard/support" data-link class="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5"><i class="fa-solid fa-arrow-left"></i> সব টিকেট</a>

        <div class="glass rounded-2xl p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-lg font-extrabold">${escapeHtml(ticket.subject)}</h1>
            <p class="text-slate-400 text-xs mt-1">${ticket.ticket_no} • খোলা হয়েছে ${formatDate(ticket.created_at)}</p>
          </div>
          ${statusBadge(ticket.status)}
        </div>

        <div class="glass rounded-2xl p-6">
          <div id="ticket-messages" class="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            ${messages.map((m) => `
              <div class="flex ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] ${m.sender_type === 'user' ? 'bg-brand-500/15 ring-1 ring-brand-500/20' : 'glass'} rounded-2xl px-4 py-3">
                  <p class="text-xs font-semibold mb-1 ${m.sender_type === 'user' ? 'text-brand-400' : 'text-violet-400'}">${m.sender_type === 'user' ? 'আপনি' : m.sender_type === 'admin' ? 'সাপোর্ট টিম' : 'সিস্টেম'}</p>
                  <p class="text-sm whitespace-pre-wrap">${escapeHtml(m.message)}</p>
                  <p class="text-[10px] text-slate-500 mt-1.5">${timeAgo(m.created_at)}</p>
                </div>
              </div>`).join('')}
          </div>

          ${isClosed ? `
            <div class="mt-5 pt-5 border-t border-white/5 text-center text-sm text-slate-500">
              <i class="fa-solid fa-lock mr-1.5"></i>এই টিকেটটি বন্ধ করা হয়েছে
            </div>` : `
            <form id="reply-form" class="mt-5 pt-5 border-t border-white/5 flex gap-2">
              <input type="text" id="reply-input" placeholder="উত্তর লিখুন..." class="flex-1 glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
              <button type="submit" id="reply-submit" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 rounded-xl font-semibold shrink-0"><i class="fa-solid fa-paper-plane"></i></button>
            </form>`}
        </div>
      </div>
    `

    const msgBox = qs('#ticket-messages')
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight

    qs('#reply-form')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const input = qs('#reply-input')
      const msg = input.value.trim()
      if (!msg) return
      const btn = qs('#reply-submit')
      btn.disabled = true
      try {
        await SupportService.reply(params.id, msg)
        input.value = ''
        await load()
      } catch (err) {
        showToast(getErrorMessage(err), 'error')
      } finally {
        btn.disabled = false
      }
    })
  }

  load()
}
