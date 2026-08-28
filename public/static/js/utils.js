// ============================================================
// Shared utility helpers
// ============================================================

const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯']
function toBnDigits(input) {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[+d])
}

function formatMoney(amount, bn = true) {
  const n = Number(amount || 0)
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
  return bn ? '৳' + toBnDigits(formatted) : '৳' + formatted
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = dayjs(dateStr)
  return d.format('DD MMM YYYY, hh:mm A')
}

function timeAgo(dateStr) {
  if (!dateStr) return '-'
  const d = dayjs(dateStr)
  const now = dayjs()
  const diffSec = now.diff(d, 'second')
  if (diffSec < 60) return 'এইমাত্র'
  const diffMin = now.diff(d, 'minute')
  if (diffMin < 60) return `${toBnDigits(diffMin)} মিনিট আগে`
  const diffHr = now.diff(d, 'hour')
  if (diffHr < 24) return `${toBnDigits(diffHr)} ঘন্টা আগে`
  const diffDay = now.diff(d, 'day')
  if (diffDay < 30) return `${toBnDigits(diffDay)} দিন আগে`
  return d.format('DD MMM YYYY')
}

function escapeHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const STATUS_MAP = {
  pending: { label: 'পেন্ডিং', color: 'amber', icon: 'fa-clock' },
  processing: { label: 'প্রসেসিং', color: 'sky', icon: 'fa-spinner fa-spin' },
  completed: { label: 'সম্পন্ন', color: 'brand', icon: 'fa-circle-check' },
  rejected: { label: 'বাতিল', color: 'rose', icon: 'fa-circle-xmark' },
  refunded: { label: 'রিফান্ড', color: 'violet', icon: 'fa-rotate-left' },
  approved: { label: 'অনুমোদিত', color: 'brand', icon: 'fa-circle-check' },
  active: { label: 'সক্রিয়', color: 'brand', icon: 'fa-circle-check' },
  suspended: { label: 'সাসপেন্ড', color: 'amber', icon: 'fa-ban' },
  banned: { label: 'ব্যান', color: 'rose', icon: 'fa-ban' },
  open: { label: 'ওপেন', color: 'sky', icon: 'fa-envelope-open' },
  answered: { label: 'উত্তর দেওয়া হয়েছে', color: 'brand', icon: 'fa-reply' },
  closed: { label: 'বন্ধ', color: 'slate', icon: 'fa-lock' },
}

const STATUS_COLOR_CLASSES = {
  amber: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
  brand: 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30',
  rose: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
  violet: 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30',
  slate: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30',
}

function statusBadge(status) {
  const s = STATUS_MAP[status] || { label: status, color: 'slate', icon: 'fa-circle' }
  const cls = STATUS_COLOR_CLASSES[s.color]
  return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}"><i class="fa-solid ${s.icon} text-[10px]"></i>${s.label}</span>`
}

function debounce(fn, delay = 350) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

function qs(sel, root = document) { return root.querySelector(sel) }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)) }

// Animate a counting-up number
function animateCount(el, target, duration = 900, formatter = (n) => Math.round(n).toLocaleString()) {
  const start = 0
  const startTime = performance.now()
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    el.textContent = formatter(start + (target - start) * eased)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// Cursor spotlight glow that follows mouse (uncommon UI touch)
function initCursorGlow() {
  const glow = document.getElementById('cursor-glow')
  if (!glow) return
  let raf = null
  document.addEventListener('mousemove', (e) => {
    glow.style.opacity = '1'
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      glow.style.transform = `translate(${e.clientX - 210}px, ${e.clientY - 210}px)`
    })
  })
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0' })
}

// Spotlight effect on cards with .spot-card class (CSS var driven)
function initSpotlightCards(root = document) {
  qsa('.spot-card', root).forEach((card) => {
    if (card._spotBound) return
    card._spotBound = true
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--x', `${e.clientX - rect.left}px`)
      card.style.setProperty('--y', `${e.clientY - rect.top}px`)
    })
  })
}

// Ripple effect for .btn-glow buttons
function initRippleButtons(root = document) {
  qsa('.btn-glow', root).forEach((btn) => {
    if (btn._rippleBound) return
    btn._rippleBound = true
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect()
      const ripple = document.createElement('span')
      const size = Math.max(rect.width, rect.height)
      ripple.className = 'ripple'
      ripple.style.width = ripple.style.height = size + 'px'
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px'
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px'
      this.appendChild(ripple)
      setTimeout(() => ripple.remove(), 650)
    })
  })
}

function initPageEffects(root = document) {
  initSpotlightCards(root)
  initRippleButtons(root)
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container')
  if (!container) return
  const colors = {
    success: { bg: 'bg-brand-500/95', icon: 'fa-circle-check' },
    error: { bg: 'bg-rose-500/95', icon: 'fa-circle-xmark' },
    warning: { bg: 'bg-amber-500/95', icon: 'fa-triangle-exclamation' },
    info: { bg: 'bg-sky-500/95', icon: 'fa-circle-info' },
  }
  const c = colors[type] || colors.info
  const toast = document.createElement('div')
  toast.className = `toast-enter ${c.bg} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-sm text-sm font-medium backdrop-blur-md`
  toast.innerHTML = `<i class="fa-solid ${c.icon}"></i><span>${escapeHtml(message)}</span>`
  container.appendChild(toast)
  setTimeout(() => {
    toast.style.transition = 'all .3s ease'
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(40px)'
    setTimeout(() => toast.remove(), 300)
  }, 3800)
}

function getErrorMessage(err) {
  if (err && err.message) return err.message
  return 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।'
}

// ============================================================
// Lazy-load Chart.js only on pages that actually render charts
// (keeps it off the critical path for every other page load)
// ============================================================
let _chartJsPromise = null
function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart)
  if (_chartJsPromise) return _chartJsPromise
  _chartJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
    script.onload = () => resolve(window.Chart)
    script.onerror = reject
    document.head.appendChild(script)
  })
  return _chartJsPromise
}
