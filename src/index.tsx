import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import type { AppEnv } from './types/bindings'

import auth from './routes/auth'
import services from './routes/services'
import orders from './routes/orders'
import wallet from './routes/wallet'
import dashboard from './routes/dashboard'
import notifications from './routes/notifications'
import support from './routes/support'
import reports from './routes/reports'
import referral from './routes/referral'
import misc from './routes/misc'
import admin from './routes/admin'

const app = new Hono<AppEnv>()

// -----------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------
app.route('/api/auth', auth)
app.route('/api/services', services)
app.route('/api/orders', orders)
app.route('/api/wallet', wallet)
app.route('/api/dashboard', dashboard)
app.route('/api/notifications', notifications)
app.route('/api/support', support)
app.route('/api/reports', reports)
app.route('/api/referral', referral)
app.route('/api', misc)
app.route('/api/admin', admin)

// -----------------------------------------------------------------
// Static assets + SPA fallback
// -----------------------------------------------------------------
app.use('/static/*', serveStatic({ root: './public' }))

const HTML_SHELL = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>ABC Authentic — দ্রুত, নিরাপদ, নির্ভরযোগ্য</title>
  <meta name="description" content="ABC Authentic — দ্রুত, নিরাপদ ও নির্ভরযোগ্য জন্ম নিবন্ধন, এনআইডি ও ভূমি সেবা প্ল্যাটফর্ম।">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📄</text></svg>">

  <link rel="preconnect" href="https://cdn.tailwindcss.com">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js" defer></script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Hind Siliguri', 'Manrope', 'sans-serif'],
          },
          colors: {
            ink: {
              950: '#05070a',
              900: '#0a0e14',
              850: '#0f141c',
              800: '#141a24',
              700: '#1c2431',
            },
            brand: {
              50: '#eefdf6',
              100: '#d6fbea',
              200: '#adf5d5',
              300: '#75e9ba',
              400: '#3ed49c',
              500: '#17b881',
              600: '#0d9668',
              700: '#0b7855',
              800: '#0c5f46',
              900: '#0b4e3c',
            },
            violet: {
              400: '#a78bfa',
              500: '#8b5cf6',
              600: '#7c3aed',
            },
          },
          animation: {
            'aurora-1': 'aurora1 22s ease-in-out infinite',
            'aurora-2': 'aurora2 26s ease-in-out infinite',
            'aurora-3': 'aurora3 30s ease-in-out infinite',
            'float-slow': 'floatSlow 8s ease-in-out infinite',
            'fade-up': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
            'shimmer': 'shimmer 2.5s linear infinite',
            'pop-in': 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
          },
          keyframes: {
            aurora1: {
              '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
              '33%': { transform: 'translate(10%, -15%) scale(1.15)' },
              '66%': { transform: 'translate(-8%, 10%) scale(0.95)' },
            },
            aurora2: {
              '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
              '40%': { transform: 'translate(-15%, 12%) scale(1.1)' },
              '75%': { transform: 'translate(12%, -8%) scale(0.9)' },
            },
            aurora3: {
              '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
              '50%': { transform: 'translate(6%, 14%) scale(1.2)' },
            },
            floatSlow: {
              '0%, 100%': { transform: 'translateY(0px)' },
              '50%': { transform: 'translateY(-14px)' },
            },
            fadeUp: {
              '0%': { opacity: '0', transform: 'translateY(16px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' },
            },
            shimmer: {
              '0%': { backgroundPosition: '-200% 0' },
              '100%': { backgroundPosition: '200% 0' },
            },
            popIn: {
              '0%': { opacity: '0', transform: 'scale(0.85)' },
              '100%': { opacity: '1', transform: 'scale(1)' },
            },
          },
        },
      },
    }
  </script>
  <link href="/static/css/app.css" rel="stylesheet">
</head>
<body class="bg-ink-950 text-slate-100 font-sans antialiased min-h-screen overflow-x-hidden">
  <div id="aurora-bg" class="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -left-40 w-[36rem] h-[36rem] bg-brand-500/25 rounded-full blur-[110px] animate-aurora-1"></div>
    <div class="absolute top-1/3 -right-32 w-[30rem] h-[30rem] bg-violet-500/20 rounded-full blur-[110px] animate-aurora-2"></div>
    <div class="absolute bottom-0 left-1/4 w-[28rem] h-[28rem] bg-brand-400/15 rounded-full blur-[100px] animate-aurora-3"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] [background-size:26px_26px]"></div>
  </div>

  <div id="cursor-glow" class="fixed w-[420px] h-[420px] rounded-full pointer-events-none -z-10 opacity-0 transition-opacity duration-500" style="background: radial-gradient(circle, rgba(23,184,129,0.10) 0%, transparent 70%);"></div>

  <div id="toast-container" class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end"></div>

  <a id="whatsapp-float-btn" href="https://wa.me/" target="_blank" rel="noopener"
     class="whatsapp-fab fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full flex items-center justify-center hidden"
     title="হোয়াটসঅ্যাপে অ্যাডমিনের সাথে যোগাযোগ করুন" aria-label="WhatsApp">
    <span class="whatsapp-fab-ripple"></span>
    <span class="whatsapp-fab-ripple whatsapp-fab-ripple-delay"></span>
    <span class="whatsapp-fab-core"><i class="fa-brands fa-whatsapp"></i></span>
  </a>

  <div id="app"></div>

  <script src="/static/js/utils.js" defer></script>
  <script src="/static/js/api.js" defer></script>
  <script src="/static/js/components.js" defer></script>
  <script src="/static/js/pages/landing.js" defer></script>
  <script src="/static/js/pages/auth.js" defer></script>
  <script src="/static/js/pages/dashboard.js" defer></script>
  <script src="/static/js/pages/services.js" defer></script>
  <script src="/static/js/pages/orders.js" defer></script>
  <script src="/static/js/pages/wallet.js" defer></script>
  <script src="/static/js/pages/reports.js" defer></script>
  <script src="/static/js/pages/support.js" defer></script>
  <script src="/static/js/pages/referral.js" defer></script>
  <script src="/static/js/pages/profile.js" defer></script>
  <script src="/static/js/pages/admin.js" defer></script>
  <script src="/static/js/router.js" defer></script>
  <script src="/static/js/app.js" defer></script>
</body>
</html>`

// Serve SPA shell for every non-API, non-static route
app.get('*', (c) => {
  return c.html(HTML_SHELL)
})

export default app
