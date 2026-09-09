// ============================================================
// Reports — spending trend, service distribution, status breakdown (Chart.js)
// ============================================================

let _reportCharts = {}

function destroyReportCharts() {
  Object.values(_reportCharts).forEach((chart) => { try { chart.destroy() } catch {} })
  _reportCharts = {}
}

const CHART_PALETTE = ['#17b881', '#8b5cf6', '#0ea5e9', '#f59e0b', '#f43f5e', '#3ed49c', '#a78bfa', '#38bdf8']

async function renderReportsPage() {
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(USER_NAV, '/dashboard/reports')}</div>`
  bindShellEvents()
  destroyReportCharts()

  const content = qs('#page-content')
  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">রিপোর্ট ও পরিসংখ্যান</h1>
      <p class="text-slate-400 text-sm mt-1">আপনার ব্যবহারের ধরন বিশ্লেষণ করুন</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2">${skeletonCard('h-80')}</div>
      <div>${skeletonCard('h-80')}</div>
    </div>
    ${skeletonCard('h-80')}
  `

  let data
  try {
    data = await ReportService.overview()
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'রিপোর্ট লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const dailySpending = data.daily_spending || []
  const serviceDist = data.service_distribution || []
  const statusBreak = data.status_breakdown || []

  const hasAnyData = dailySpending.length || serviceDist.length || statusBreak.length

  if (!hasAnyData) {
    content.innerHTML = emptyState('fa-chart-pie', 'এখনো কোনো তথ্য নেই', 'অর্ডার করা শুরু করলে এখানে বিস্তারিত রিপোর্ট দেখা যাবে।', `<a href="/dashboard/services" data-link class="btn-glow bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">সার্ভিস দেখুন</a>`)
    return
  }

  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold">রিপোর্ট ও পরিসংখ্যান</h1>
      <p class="text-slate-400 text-sm mt-1">আপনার ব্যবহারের ধরন বিশ্লেষণ করুন (সর্বশেষ ১৪ দিন)</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2 glass rounded-2xl p-6">
        <h3 class="font-bold mb-4"><i class="fa-solid fa-chart-line text-brand-400 mr-2"></i>দৈনিক খরচের ধারা</h3>
        ${dailySpending.length ? `<canvas id="chart-spending" height="230"></canvas>` : `<p class="text-sm text-slate-500 text-center py-16">কোনো খরচের তথ্য নেই</p>`}
      </div>
      <div class="glass rounded-2xl p-6">
        <h3 class="font-bold mb-4"><i class="fa-solid fa-chart-pie text-violet-400 mr-2"></i>অর্ডার স্ট্যাটাস</h3>
        ${statusBreak.length ? `<canvas id="chart-status" height="230"></canvas>` : `<p class="text-sm text-slate-500 text-center py-16">কোনো অর্ডার নেই</p>`}
      </div>
    </div>

    <div class="glass rounded-2xl p-6">
      <h3 class="font-bold mb-4"><i class="fa-solid fa-layer-group text-sky-400 mr-2"></i>সার্ভিস অনুযায়ী বিতরণ</h3>
      ${serviceDist.length ? `<canvas id="chart-services" height="240"></canvas>` : `<p class="text-sm text-slate-500 text-center py-16">কোনো সার্ভিস অর্ডার করা হয়নি</p>`}
    </div>
  `

  // Lazy-load Chart.js only when this page actually needs charts
  await loadChartJs()
  Chart.defaults.color = '#94a3b8'
  Chart.defaults.font.family = "'Hind Siliguri', 'Manrope', sans-serif"
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'

  if (dailySpending.length && qs('#chart-spending')) {
    const ctx = qs('#chart-spending').getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 0, 230)
    gradient.addColorStop(0, 'rgba(23,184,129,0.35)')
    gradient.addColorStop(1, 'rgba(23,184,129,0)')
    _reportCharts.spending = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailySpending.map((d) => dayjs(d.day).format('DD MMM')),
        datasets: [{
          label: 'খরচ (৳)',
          data: dailySpending.map((d) => d.total),
          borderColor: '#17b881',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#17b881',
          pointBorderColor: '#0a0e14',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => '৳' + c.parsed.y.toLocaleString() } } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } },
        },
      },
    })
  }

  if (statusBreak.length && qs('#chart-status')) {
    _reportCharts.status = new Chart(qs('#chart-status').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: statusBreak.map((s) => (STATUS_MAP[s.status]?.label || s.status)),
        datasets: [{
          data: statusBreak.map((s) => s.count),
          backgroundColor: CHART_PALETTE,
          borderColor: '#0a0e14',
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } } },
      },
    })
  }

  if (serviceDist.length && qs('#chart-services')) {
    _reportCharts.services = new Chart(qs('#chart-services').getContext('2d'), {
      type: 'bar',
      data: {
        labels: serviceDist.map((s) => s.service_name),
        datasets: [{
          label: 'অর্ডার সংখ্যা',
          data: serviceDist.map((s) => s.count),
          backgroundColor: CHART_PALETTE[0],
          borderRadius: 8,
          maxBarThickness: 44,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } },
        },
      },
    })
  }
}
