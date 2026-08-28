# ABC Authentic — সরকারি ডকুমেন্ট সার্ভিস রিসেলার পোর্টাল

## Project Overview
- **Name**: ABC Authentic (দ্রুত, নিরাপদ, নির্ভরযোগ্য) — কোড নেইম: webapp
- **Goal**: BDRIS-স্টাইল বাংলাদেশি সরকারি ডকুমেন্ট সার্ভিস (জন্ম নিবন্ধন, এনআইডি, ভূমি সেবা) রিসেলার প্ল্যাটফর্ম — ইউজার অর্ডার করবে, ওয়ালেট দিয়ে পেমেন্ট করবে, অ্যাডমিন ম্যানুয়াল অথবা কনফিগারযোগ্য API-এর মাধ্যমে অর্ডার সম্পন্ন করবে।
- **Key Features**:
  - **ইউজার রেজিস্ট্রেশন/লগইন**: নতুন সাইনআপ সরাসরি `pending` স্ট্যাটাসে তৈরি হয় (অটো-লগইন হয় না) — অ্যাডমিন প্যানেল থেকে অনুমোদন (`pending → active`) না হওয়া পর্যন্ত ইউজার লগইন করতে পারবে না (লগইন/সেশন-মিডলওয়্যার দুই জায়গায় স্পষ্ট "অনুমোদনের অপেক্ষায়" বার্তা দেখায়); রেজিস্ট্রেশন সফল হলে একটি সুন্দর "অনুমোদনের অপেক্ষায়" নোটিস পেজ দেখানো হয়। অ্যাডমিন ইউজার-ম্যানেজমেন্টে "পেন্ডিং" ফিল্টার + এক-ক্লিক "অনুমোদন করুন" বাটন আছে, অনুমোদনের সাথে সাথে ইউজারকে নোটিফিকেশন পাঠানো হয়। JWT + HttpOnly cookie ভিত্তিক সেশন, রেফারেল সিস্টেম (প্রথম রিচার্জে বোনাস)
  - **সরাসরি হোয়াটসঅ্যাপ যোগাযোগ**: ইউজার ড্যাশবোর্ডের নিচে-ডানে সবসময় ভাসমান বৃত্তাকার WhatsApp বাটন (অ্যাডমিন প্যানেলে দেখায় না) — অ্যাডমিন-সেটিংসের `support_whatsapp` নম্বরে সরাসরি লিংক করে, ধীর "watery" অ্যামবিয়েন্ট রিং-পালস সবসময় চলে এবং হোভারে জেলি-সদৃশ বর্ডার-রেডিয়াস মরফ + দ্রুত রিপল-ব্লুম ইফেক্ট দেখায়। **স্ক্রল-ফিক্স**: বাটনটি body-লেভেল অ্যাংকার (SPA `#app` div-এর বাইরে) হিসেবে বসানো হয়েছে, যাতে `.page-enter`-এর CSS `transform` অ্যানিমেশন এর জন্য নতুন containing-block তৈরি না করে — এখন পেজ স্ক্রল করলেও বাটনটি সবসময় viewport-এর নির্ধারিত কোণায় স্থির থাকে (Playwright scripted scroll-টেস্টে বাটনের bounding box স্ক্রলের আগে/পরে সম্পূর্ণ অভিন্ন প্রমাণিত)
  - **ব্র্যান্ড লোগো**: AI-জেনারেটেড কাস্টম "ABC Authentic" লোগো (শিল্ড + চেকমার্ক মোটিফ, ব্র্যান্ড green→violet গ্রেডিয়েন্ট, গ্লাসি হাইলাইট) — সাইডবার হেডার, লগইন/রেজিস্ট্রেশন হেডার, ল্যান্ডিং পেজ ন্যাভ + ফুটার — এই ৪টি জায়গায় বসানো হয়েছে; ব্রাউজার favicon-ও (৩২/৬৪/১৯২px, ডার্ক রাউন্ডেড-স্কয়ার ব্যাকড্রপ সহ) নতুন লোগো দিয়ে আপডেট করা হয়েছে; এবং লগইন/রেজিস্ট্রেশন পেজে অতি-হালকা (৪% opacity) ব্যাকগ্রাউন্ড ওয়াটারমার্ক হিসেবেও ব্যবহার করা হয়েছে
  - ওয়ালেট: ম্যানুয়াল রিচার্জ (bKash/Nagad/Rocket/Upay — সেন্ডার নাম্বার + হোয়াটসঅ্যাপ নাম্বার + প্রুফ আপলোড → অ্যাডমিন অনুমোদন) **এবং** অটো পেমেন্ট গেটওয়ে কাঠামো (UddoktaPay-রেডি, কনফিগারযোগ্য)
  - ডাইনামিক ফর্ম-স্কিমা ভিত্তিক সার্ভিস (অ্যাডমিন যেকোনো নতুন সার্ভিস ফিল্ড-বিল্ডার দিয়ে যোগ করতে পারবে)
  - অ্যাডমিন-কনফিগারযোগ্য API Provider ইঞ্জিন (`fulfillment_mode`: manual/api/hybrid) — কোনো হার্ডকোডেড API ইন্টিগ্রেশন নেই, সব অ্যাডমিন প্যানেল থেকে যোগ/টেস্ট করা যায়
  - সম্পূর্ণ অ্যাডমিন প্যানেল: ড্যাশবোর্ড (Chart.js), অর্ডার ম্যানেজমেন্ট, রিচার্জ অনুমোদন, সার্ভিস+ক্যাটাগরি CRUD, API প্রোভাইডার CRUD+টেস্ট, ইউজার ম্যানেজমেন্ট, কুপন, সাপোর্ট টিকেট, সেটিংস (general/payment-methods/payment-gateways)
  - **"Admin Mode" ভিজ্যুয়াল থিম**: অ্যাডমিন প্যানেল ইউজার প্যানেল থেকে স্পষ্টভাবে আলাদা দেখতে — violet/fuchsia অ্যাকসেন্ট কালার, শীর্ষে shimmer স্ট্রাইপ, পালসিং "Admin Mode" ব্যাজ, শিল্ড আইকন, এবং একটি সতর্কতা চিপ ("এখানে করা পরিবর্তন সরাসরি প্ল্যাটফর্মে প্রভাব ফেলে") — যাতে অ্যাডমিন একনজরেই বুঝতে পারে সে সাধারণ ইউজার প্যানেলে নেই
  - "Uncommon UI": aurora animated background, cursor-follow glow, **প্রিমিয়াম hover cards** — কার্ডের ১.৫px বর্ডার-রিংয়ে ধিরে ঘূর্ণায়মান মাল্টি-স্টপ লাইট (কার্ডের ভেতরে কখনো ছড়ায় না, `mask-composite: exclude` দিয়ে কনফাইন করা) + খুব হালকা ৭s ডায়াগোনাল শাইন-সুইপ + মাউস-ফলো গ্লো + hover lift — অ্যাডমিন (ভায়োলেট) ও ইউজার (গ্রিন) উভয় ড্যাশবোর্ডে ব্র্যান্ড-কালারে প্রযোজ্য, ripple buttons, glassmorphism — কোনো রেফারেন্স সাইট/ভিডিওর হুবহু কপি নয়, শুধু কৌশল (নেস্টেড রিং কনফাইনমেন্ট + শাইন-সুইপ) থেকে অনুপ্রাণিত ও আমাদের নিজস্ব ব্র্যান্ড-প্যালেটে পুনর্নির্মিত
  - **পারফরম্যান্স অপ্টিমাইজেশন**: সব পেজ-স্ক্রিপ্ট `defer` করা হয়েছে (HTML পার্সিং ব্লক হয় না), Chart.js শুধু রিপোর্ট/অ্যাডমিন ড্যাশবোর্ড পেজে লেজি-লোড হয় (অন্য কোনো পেজে লোড হয় না), CDN রিসোর্সে `preconnect` হিন্ট যোগ করা হয়েছে

## URLs
- **Local Sandbox Preview**: (see GetServiceUrl output in this session — service running on port 3000)
- **Production**: https://docflow-bd.pages.dev (Cloudflare Pages, BYOK deploy)
- **GitHub**: https://github.com/iwantuuu529-design/Authentic-ABC

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) — single relational database, **free tier**. No KV usage (settings stored as D1 key-value table).
- **File storage**: Cloudflare R2 (`FILES` binding) — payment proofs, order result files, attachments. **Free tier** (10GB storage, no egress fee).
- **Why this stack is free-tier friendly**: D1 (5GB storage, 25M row reads/day free), R2 (10GB storage free, no egress), Workers (100k requests/day free) — this app's expected traffic comfortably fits within Cloudflare's free allowances.
- **Key tables**: `users`, `services`, `service_categories`, `api_providers`, `orders`, `order_logs`, `transactions` (wallet ledger — source of truth for balance), `recharge_requests`, `payment_methods`, `payment_gateways`, `coupons`, `coupon_usages`, `notifications`, `support_tickets`, `support_messages`, `referrals`, `settings` (key-value), `otp_codes`.
- **Wallet model**: `transactions` table is the ledger; `users.balance` is a cached/denormalized value updated via `creditWallet()`/`debitWallet()` helpers — never mutated directly.
- **Order fulfillment**: `services.fulfillment_mode` (`manual` | `api` | `hybrid`) + `services.api_provider_id` → `callApiProvider()` reads the provider's configurable `request_template` (with `{{field}}` placeholders), calls the configured `base_url`/`http_method`/`auth_type`, and extracts success/result/error via configurable JSON-path fields — fully admin-driven, no per-service hardcoded integration code.

## User Guide
1. ভিজিটর হোমপেজ থেকে রেজিস্টার করে ড্যাশবোর্ডে যাবে।
2. ওয়ালেট পেজ থেকে ম্যানুয়াল রিচার্জ রিকোয়েস্ট পাঠাবে (সেন্ডার নাম্বার + হোয়াটসঅ্যাপ + প্রুফ ছবি) — অথবা ভবিষ্যতে অটো গেটওয়ে সক্রিয় হলে সরাসরি পেমেন্ট করবে।
3. অ্যাডমিন রিচার্জ অনুমোদন করলে ওয়ালেট ব্যালেন্স যোগ হবে (এবং রেফারেল থাকলে প্রথম রিচার্জে বোনাস)।
4. সার্ভিস পেজ থেকে সার্ভিস বেছে ডাইনামিক ফর্ম পূরণ করে অর্ডার দেবে — ব্যালেন্স থেকে টাকা কাটবে।
5. অ্যাডমিন অর্ডারটি ম্যানুয়ালি সম্পন্ন করবে অথবা কনফিগার করা API স্বয়ংক্রিয়ভাবে কল হবে।
6. ইউজার অর্ডার স্ট্যাটাস, রিপোর্ট, রেফারেল লিংক, সাপোর্ট টিকেট নিজের ড্যাশবোর্ড থেকে দেখতে পারবে।
7. **অ্যাডমিন লগইন (seed data)**: ফোন `01700000000`, পাসওয়ার্ড `Admin@12345`।

## Deployment
- **Platform**: Cloudflare Pages + Workers (Hono framework)
- **Status**: ✅ Deployed to production Cloudflare Pages (BYOK — user's own Cloudflare account, project name `docflow-bd`). ✅ Also running locally in sandbox via PM2 + `wrangler pages dev --local`.
- **Production resources**:
  - Pages project: `docflow-bd` → https://docflow-bd.pages.dev
  - D1 database: `webapp-production` (id `9c2e960d-2d99-41f5-861f-ddebe7005c08`), migrated + seeded
  - R2 bucket: `webapp-files` (binding `FILES`)
- **Tech Stack**: Hono (TypeScript backend) + vanilla-JS SPA frontend (custom router, no framework) + Tailwind CSS (CDN) + Chart.js (CDN) + Cloudflare D1 + Cloudflare R2
- **Local dev commands**:
  ```bash
  npm install
  npx wrangler d1 migrations apply webapp-production --local
  npx wrangler d1 execute webapp-production --local --file=./seed.sql
  npm run build
  pm2 start ecosystem.config.cjs
  curl http://localhost:3000
  ```
- **Production redeploy commands**:
  ```bash
  npm run build
  npx wrangler pages deploy dist --project-name docflow-bd
  # After schema changes, also run against --remote:
  npx wrangler d1 migrations apply webapp-production --remote
  ```
- **Last Updated**: 2026-08-28 (রেজিস্ট্রেশন এখন pending-approval ফ্লো — অ্যাডমিন অনুমোদন ছাড়া লগইন সম্ভব নয়; ইউজার ড্যাশবোর্ডে সবসময়-দৃশ্যমান বৃত্তাকার WhatsApp ফ্লোটিং বাটন, watery/liquid-ripple হোভার ইফেক্ট সহ — কোড কমিট, পুশ ও **প্রোডাকশন ডিপ্লয় সম্পন্ন**)
- **Bug Fix (2026-08-28)**: WhatsApp ফ্লোটিং বাটন স্ক্রল করলে নির্ধারিত স্থান থেকে সরে যাচ্ছিল (bug: `.page-enter` wrapper-এর CSS `transform` অ্যানিমেশন `position: fixed` চাইল্ডের জন্য নতুন containing block তৈরি করছিল, ফলে বাটনটি viewport-এর বদলে সেই transformed div-এর সাপেক্ষে ফিক্সড হয়ে যাচ্ছিল)। **সমাধান**: বাটনটি SPA-এর `#app` div-এর বাইরে, body-লেভেলে (`src/index.tsx`) স্থানান্তর করা হয়েছে — এখন এটি সত্যিকারের viewport-fixed, স্ক্রল করলেও নির্ধারিত স্থানেই থাকে (bottom-right corner)। দৃশ্যমানতা নিয়ন্ত্রিত হয় `syncWhatsappFloatButton()` (dashboardShell থেকে কল হয়) + রাউটার-লেভেল সেফটি-নেট দিয়ে (non-dashboard পেজে স্বয়ংক্রিয়ভাবে hidden)। Playwright দিয়ে scripted scroll test করে visually + প্রোগ্রাম্যাটিকালি যাচাই করা হয়েছে (bounding box scroll-এর আগে/পরে অভিন্ন) এবং **প্রোডাকশনে ডিপ্লয় সম্পন্ন** (`https://f7d82151.docflow-bd.pages.dev` → `docflow-bd.pages.dev`)।

## Frontend Page Files (all completed)
`landing.js`, `auth.js`, `dashboard.js`, `services.js`, `orders.js`, `wallet.js`, `reports.js`, `support.js`, `referral.js`, `profile.js`, `admin.js` (12 admin views: dashboard, orders+detail, recharge, services+categories+form-builder, providers+test, users+detail, coupons, support+detail, settings).

## Admin Panel vs User Panel — RBAC Verified, Visual Distinction Added
ব্যাকএন্ড (`adminRequired` middleware, প্রতিটি `/api/admin/*` রুটে JWT role চেক) এবং ফ্রন্টএন্ড রাউটার (`authRequired`/`adminRequired` route flag) — দুই লেয়ারেই role-based access সঠিকভাবে কাজ করে (curl + কোড রিভিউ + ব্রাউজার টেস্ট দিয়ে যাচাই করা হয়েছে; সাধারণ ইউজার `/api/admin/*` কল করলে 403 পায়, ফ্রন্টএন্ডেও `/admin/*` পেজে redirect হয়ে যায়)। তবে দুই প্যানেলের লেআউট একই "glass" শেল শেয়ার করায় দেখতে প্রায় একইরকম লাগছিল, তাই অ্যাডমিন প্যানেলে আলাদা ভিজ্যুয়াল থিম (violet/fuchsia, উপরে বর্ণিত) যোগ করা হয়েছে।

## Known Issue Fixed This Session
- Hono 4.13.5 upgraded `verify()` in `hono/jwt` to require an explicit `alg` argument (breaking change vs. older Hono versions). This caused every authenticated request (including all admin routes) to fail with "সেশনের মেয়াদ শেষ হয়ে গেছে" even with a fresh, valid token. Fixed in `src/lib/jwt.ts` by passing `'HS256'` explicitly to `verify()`.
- Two admin.js API calls used a trailing slash (`/admin/settings/`) which didn't match the Hono route registered without a trailing slash, causing the SPA fallback HTML to be returned instead of JSON. Fixed by removing the trailing slash.

## New Feature (2026-08-28): Live Notice ticker + Promo/Offer card + Wallet copy buttons
- **পেমেন্ট নম্বর কপি বাটন**: ওয়ালেট পেজের "ম্যানুয়াল রিচার্জ পদ্ধতি" কার্ডে প্রতিটি bKash/Nagad/Rocket/Upay নম্বরের পাশে এখন একটি কপি বাটন আছে (`renderRechargeTab()` in `wallet.js`, `copyToClipboard()` reused from `referral.js`)।
- **Live Notice ticker**: সাইটের সবচেয়ে উপরে একটি ফুল-উইথ স্ক্রলিং নোটিস ব্যানার (lovablecredit.com রেফারেন্স স্টাইলে) — ডিফল্টভাবে **hidden**, শুধু অ্যাডমিন সক্রিয় করলে ও টেক্সট দিলে দেখায়। Body-level anchor (`#live-notice-bar` in `src/index.tsx`, normal document flow — sticky nav-কে push করে দেয়, overlap করে না)।
- **Promo/Offer পপ-আপ কার্ড**: আকর্ষণীয় গ্র্যাডিয়েন্ট-বর্ডার মোডাল কার্ড, অফার/নতুন সেবা ঘোষণার জন্য — ডিফল্টভাবে **hidden**, অ্যাডমিন টাইটেল দিয়ে সক্রিয় করলেই দেখায়। বন্ধ করলে সেই কনটেন্টের জন্য আর দেখাবে না (localStorage fingerprint dismiss), কিন্তু নতুন/পরিবর্তিত অফার আবার দেখাবে।
- **Admin নিয়ন্ত্রণ**: Admin → সেটিংস → নতুন "নোটিস ও অফার" ট্যাব (`loadNoticeTab()` in `admin.js`) — enable/disable toggle + টেক্সট/টাইটেল/বিবরণ/বাটন ফিল্ড, generic `/api/admin/settings` PUT endpoint ব্যবহার করে (কোনো backend route পরিবর্তন প্রয়োজন হয়নি)।
- **JS sync logic**: `syncLiveNoticeBar()` + `syncPromoCard()` in `components.js`, বুটস্ট্র্যাপে (`app.js`) একবার কল হয় — সব পেজে (landing/dashboard/admin) কাজ করে, রাউট পরিবর্তনে টিকে থাকে।
- **মোবাইল রেসপন্সিভ**: দুটোই ডেস্কটপ (1280px) ও মোবাইল (390px) ভিউপোর্টে Playwright দিয়ে visually যাচাই করা হয়েছে — নোটিস ব্যানার ও প্রোমো কার্ড উভয়ই ছোট স্ক্রিনে সঠিকভাবে scale/wrap হয়।
- **নতুন settings keys** (seed.sql, সব ডিফল্ট disabled/empty): `live_notice_enabled`, `live_notice_text`, `promo_card_enabled`, `promo_card_badge`, `promo_card_title`, `promo_card_desc`, `promo_card_cta_label`, `promo_card_cta_url`।

## Bug Fix + Feature (2026-08-28): অর্ডার ফর্মের DOM-selector crash ফিক্স + জন্ম নিবন্ধনে বাংলা+ইংরেজি ফিল্ড
- **সমস্যা রিপোর্ট**: অ্যাডমিন প্যানেল থেকে "জন্ম নিবন্ধন" সার্ভিসে বাংলা+ইংরেজি ফিল্ড (যেমন "Father/Mother Documents") যোগ করার পর, কাস্টমার-facing অর্ডার ফর্ম পুরনো বাংলা-অনলি ফরম্যাটেই থেকে যাচ্ছিল এবং ডকুমেন্ট আপলোড সম্পূর্ণ ভেঙে গিয়েছিল, ব্রাউজার কনসোলে এরর: `Failed to execute 'querySelector' on 'Element': '#dropzone-Father/Mother Documents' is not a valid selector.`
- **রুট কজ**: `components.js`-এ `renderFormField()`/`bindFileDropzones()` অ্যাডমিনের টাইপ করা raw `field.name` (যেখানে স্পেস/স্ল্যাশ থাকতে পারে) সরাসরি CSS/DOM selector স্ট্রিং-এর ভেতরে (`#dropzone-${field.name}`, `.file-label-${field.name}`) বসাচ্ছিল — এটি invalid CSS syntax, ফলে `querySelector` সিঙ্ক্রোনাসভাবে exception থ্রো করে পুরো ফর্ম-পেজ setup সিকোয়েন্স (captcha লোড, সাবমিট হ্যান্ডলার বাইন্ডিং) ভেঙে দিচ্ছিল।
- **সমাধান**: `utils.js`-এ নতুন `fieldDomId(name)` sanitizer হেল্পার যোগ করা হয়েছে, যা যেকোনো ফিল্ড-নেইমকে CSS-সেফ টোকেনে (শুধু alphanumeric/আন্ডারস্কোর/হাইফেন) রূপান্তর করে — এটি **শুধুমাত্র** DOM id/class/selector ওয়্যারিংয়ের জন্য ব্যবহৃত হয়, আসল `field.name` অপরিবর্তিত থেকে HTML `name` অ্যাট্রিবিউট ও `form_data` JSON কী হিসেবে ব্যবহৃত হতে থাকে (submit করা ডেটার কী-তে কোনো প্রভাব পড়ে না)। `components.js` (`renderFormField`, `bindFileDropzones`) ও `services.js` (ফর্ম-ভ্যালু রিডার) — দুই জায়গায় এই হেল্পার প্রয়োগ করা হয়েছে। ব্যাকএন্ড (`admin/services.ts`, `orders.ts`) সম্পূর্ণ generic থাকায় কোনো পরিবর্তন প্রয়োজন হয়নি।
- **জন্ম নিবন্ধন সার্ভিসের নতুন ফর্ম-স্কিমা**: এখন ১০টি ফিল্ড আছে — নাম (বাংলা+ইংরেজি), লিঙ্গ, জন্ম স্থান, জন্মসাল, মাতার নাম (বাংলা+ইংরেজি), পিতার নাম (বাংলা+ইংরেজি), ডকুমেন্ট আপলোড — প্রোডাকশন ও লোকাল D1 দুই জায়গাতেই আপডেট করা হয়েছে।
- **যাচাইকরণ**: Playwright দিয়ে সম্পূর্ণ ফ্লো টেস্ট করা হয়েছে — ফর্ম রেন্ডার (সব ১০ ফিল্ড ঠিকমতো দেখাচ্ছে), ফাইল আপলোড/ড্রপজোন (কোনো JS এরর ছাড়া), অর্ডার সাবমিট (বাংলা+ইংরেজি উভয় ডেটা ঠিকভাবে `form_data`-তে সেভ হচ্ছে), ইউজার-facing অর্ডার-ডিটেইল পেজ ও অ্যাডমিন-facing অর্ডার-ডিটেইল পেজ — উভয়ই সঠিকভাবে বাংলা+ইংরেজি ডেটা প্রদর্শন করছে।
- **গুরুত্বপূর্ণ নোট**: এই ফিক্স সাধারণীকৃত — ভবিষ্যতে অ্যাডমিন যত অস্বাভাবিক নামেই (স্পেস/স্ল্যাশ/স্পেশাল ক্যারেক্টার সহ) ফিল্ড তৈরি করুক, আর কখনো এই ধরনের crash হবে না।

## Final QA Audit + Bug Fixes (2026-08-28): Admin promo/notice bug + Mobile WhatsApp FAB overlap
এই সেশনে সম্পূর্ণ সাইটের একটি ব্যাপক ফাইনাল QA অডিট করা হয়েছে (Playwright দিয়ে JS error scan, sidebar responsive test, AI-assisted visual design review)।

- **যা টেস্ট করা হয়েছে ও ক্লিন পাওয়া গেছে**: ইউজার ড্যাশবোর্ড (৮ পেজ) ও অ্যাডমিন প্যানেল (৯ পেজ) — সব মিলিয়ে ১৮টি পেজ কম্বিনেশনে **কোনো JS console/page error পাওয়া যায়নি**। ডেস্কটপ (1440px), ট্যাবলেট (834px), মোবাইল (390px) — তিন ভিউপোর্টেই সাইডবার collapse/expand/overlay-close ঠিকমতো কাজ করে, কোনো horizontal overflow বাগ নেই।
- **কনফার্মড বাগ #১ — Admin panel এ promo/notice card ভুলভাবে দেখাচ্ছিল**: `syncLiveNoticeBar()` ও `syncPromoCard()` (`components.js`) এ কোনো role check ছিল না, ফলে কাস্টমার-facing মার্কেটিং popup অ্যাডমিন ড্যাশবোর্ডেও দেখাত এবং ক্লিক ব্লক করত। এছাড়া এই sync ফাংশনগুলো শুধু `app.js` bootstrap এ একবার চলত — SPA route change এ re-check হতো না। **ফিক্স**: দুই ফাংশনেই `getStoredUser().role === 'admin'/'staff'` চেক যোগ করা হয়েছে, এবং `router.js`-এর `renderRoute()` এ প্রতি route change এ re-sync কল করা হয়েছে।
- **কনফার্মড বাগ #২ — Mobile এ WhatsApp FAB, সার্ভিস কার্ডের "অর্ডার করুন" বাটনের উপর overlap করছিল**: Playwright দিয়ে ২১টি scroll position চেক করে প্রতিটিতে overlap কনফার্ম হয়েছে। রুট কারণ: Tailwind CDN স্টাইলশিট `app.css`-এর পরে inject হয় বলে মোবাইল মিডিয়া-কোয়েরি override (`width`/`height`/`bottom`/`right`) সবসময় Tailwind এর inline `w-14 h-14 bottom-6 right-6` ক্লাসের কাছে হেরে যেত। **ফিক্স**: `!important` যোগ করা হয়েছে এবং মোবাইলে FAB-কে bottom-right থেকে bottom-left এ move করা হয়েছে (অ্যাপের সব action/CTA বাটন right-aligned, বাম পাশ সম্পূর্ণ ফ্রি) — এখন কোনো scroll position এ overlap নেই।
- **যাচাইকরণ**: উভয় ফিক্স Playwright দিয়ে verify করা হয়েছে (guest/user/admin তিন role এ notice+promo সঠিক আচরণ, admin panel এ initial-load ও SPA-nav উভয় ক্ষেত্রে hidden, মোবাইল সার্ভিস পেজে ফুল-স্ক্রল overlap-test)। বিল্ড + কমিট + GitHub push + Cloudflare Pages প্রোডাকশন ডিপ্লয় সম্পন্ন এবং প্রোডাকশন থেকে curl দিয়ে দুটো ফিক্সই কনফার্ম করা হয়েছে।
- **এই সেশনে সম্পন্ন করা যায়নি (ভবিষ্যতে করণীয়)**: API Provider সিস্টেম (`/admin/providers`) এর end-to-end লাইভ টেস্ট (কোনো provider যুক্ত করে সার্ভিসে বেঁধে অর্ডার প্লেস করে দেখা), এবং AI ভিজ্যুয়াল রিভিউ-এ পাওয়া অন্য ছোটখাটো ডিজাইন সাজেশনগুলো (প্রোমো CTA বাটনের কনট্রাস্ট, ট্যাবলেট সার্চবার widths, ক্যাটাগরি-পিল wrapping ইত্যাদি) — এগুলো সাবজেক্টিভ/লো-প্রায়োরিটি বলে এই ফাইনাল-পাস সেশনে অগ্রাধিকার দেওয়া হয়নি।

## Admin Self-Service: Login Phone (ID) Change + Password Change + Email (2026-08-28)
এই সেশনে অ্যাডমিন নিজের লগইন মোবাইল নম্বর (ID), পাসওয়ার্ড এবং ইমেইল UI থেকে পরিবর্তন করার সুবিধা যাচাই ও সম্পন্ন করা হয়েছে।

- **রুট কারণ (কেন অ্যাডমিন প্রোফাইল পেজে যেতে পারছিল না)**: `components.js`-এর টপবার ইউজার-ড্রপডাউনে "প্রোফাইল" লিংকটি `isAdmin` হলে সম্পূর্ণ হাইড করা ছিল (`${isAdmin ? '' : '<a href="/dashboard/profile">...'}`) — ব্যাকএন্ড রুট ও পেজ নিজে ঠিকই কাজ করত, কিন্তু UI-তে ঢোকার কোনো পথ ছিল না। **ফিক্স**: লিংকটি এখন অ্যাডমিন ও ইউজার দুজনের জন্যই সবসময় দেখায়।
- **প্রোফাইল পেজ শেল ফিক্স**: `profile.js`-এর `renderProfilePage()` আগে সবসময় `USER_NAV`/`isAdmin=false` দিয়ে শেল রেন্ডার করত, রোল যা-ই হোক। এখন `getStoredUser().role` চেক করে অ্যাডমিন/স্টাফ হলে `ADMIN_NAV`+`isAdmin=true` (ভায়োলেট থিম) দিয়ে রেন্ডার করে।
- **নতুন ফিচার — লগইন মোবাইল নম্বর (ID) পরিবর্তন**: এটি আগে বিদ্যমান ছিলই না। প্রোফাইল পেজে মোবাইল নম্বর ফিল্ডের পাশে "পরিবর্তন করুন" টগল বাটন যোগ করা হয়েছে — চালু করলে নম্বর এডিটেবল হয় এবং একটি "বর্তমান পাসওয়ার্ড" কনফার্মেশন ফিল্ড দেখা যায় (নিরাপত্তার জন্য, পাসওয়ার্ড-পরিবর্তনের মতোই)। ব্যাকএন্ডে (`PUT /api/auth/profile`) নতুন নম্বর বাংলাদেশি ফরম্যাট (`01[3-9]XXXXXXXX`) ভ্যালিডেট করা হয়, বর্তমান পাসওয়ার্ড যাচাই করা হয়, এবং অন্য কোনো অ্যাকাউন্টে নম্বরটি ডুপ্লিকেট আছে কিনা চেক করা হয়। সফল হলে ফ্রন্টএন্ড পেজ রিলোড করে যাতে টপবার/সেশন সব জায়গায় নতুন নম্বর প্রতিফলিত হয়।
- **পাসওয়ার্ড পরিবর্তন**: ইতিমধ্যে বিদ্যমান (`POST /api/auth/change-password`) — টেস্ট করে কনফার্ম করা হয়েছে ঠিকভাবে কাজ করে, কোনো ফিক্স লাগেনি।
- **যাচাইকরণ**: Playwright দিয়ে negative-path (পাসওয়ার্ড ছাড়া → রিজেক্ট, ভুল পাসওয়ার্ড → রিজেক্ট) ও positive-path (সঠিক পাসওয়ার্ড → সফল, নতুন নম্বরে লগইন করে কনফার্ম) — সবগুলো সঠিকভাবে কাজ করেছে।
- **অ্যাডমিন ইমেইল সেট করা হয়েছে**: প্রোডাকশন D1-তে সরাসরি SQL দিয়ে অ্যাডমিন অ্যাকাউন্টের (`phone=01700000000`) ইমেইল `admin@docflow.bd` থেকে **`iwantuuu529@gmail.com`**-এ আপডেট করা হয়েছে এবং যাচাই করা হয়েছে।
- **ডিপ্লয়মেন্ট**: বিল্ড + কমিট (`de47512`) + GitHub push + Cloudflare Pages প্রোডাকশন ডিপ্লয় সম্পন্ন; প্রোডাকশন থেকে curl দিয়ে নতুন ফিচারের JS মার্কার ও ইমেইল আপডেট দুটোই কনফার্ম করা হয়েছে।
- **এখনও করণীয়**: API Provider সিস্টেমের (`/admin/providers`) end-to-end লাইভ টেস্ট এখনও বাকি — এই আইটেমটি আগের ফাইনাল-QA সেশন থেকে carry-forward হয়ে এখনো পেন্ডিং।

## Not Yet Implemented / Next Steps
- Real UddoktaPay (or other) auto payment-gateway webhook/callback integration — currently only a placeholder inactive DB row + admin config UI; the actual payment-collect + webhook-verify code path has not been implemented
- End-to-end UI testing of every admin.js modal/flow in a real browser (only API-level curl testing done this session due to sandbox constraints)
- OTP/SMS provider integration for phone verification (currently `otp_codes` table exists but no real SMS gateway wired up)
