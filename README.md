# ABC Authentic — সরকারি ডকুমেন্ট সার্ভিস রিসেলার পোর্টাল

## Project Overview
- **Name**: ABC Authentic (দ্রুত, নিরাপদ, নির্ভরযোগ্য) — কোড নেইম: webapp
- **Goal**: BDRIS-স্টাইল বাংলাদেশি সরকারি ডকুমেন্ট সার্ভিস (জন্ম নিবন্ধন, এনআইডি, ভূমি সেবা) রিসেলার প্ল্যাটফর্ম — ইউজার অর্ডার করবে, ওয়ালেট দিয়ে পেমেন্ট করবে, অ্যাডমিন ম্যানুয়াল অথবা কনফিগারযোগ্য API-এর মাধ্যমে অর্ডার সম্পন্ন করবে।
- **Key Features**:
  - ইউজার রেজিস্ট্রেশন/লগইন (JWT + HttpOnly cookie), রেফারেল সিস্টেম (প্রথম রিচার্জে বোনাস)
  - ওয়ালেট: ম্যানুয়াল রিচার্জ (bKash/Nagad/Rocket/Upay — সেন্ডার নাম্বার + হোয়াটসঅ্যাপ নাম্বার + প্রুফ আপলোড → অ্যাডমিন অনুমোদন) **এবং** অটো পেমেন্ট গেটওয়ে কাঠামো (UddoktaPay-রেডি, কনফিগারযোগ্য)
  - ডাইনামিক ফর্ম-স্কিমা ভিত্তিক সার্ভিস (অ্যাডমিন যেকোনো নতুন সার্ভিস ফিল্ড-বিল্ডার দিয়ে যোগ করতে পারবে)
  - অ্যাডমিন-কনফিগারযোগ্য API Provider ইঞ্জিন (`fulfillment_mode`: manual/api/hybrid) — কোনো হার্ডকোডেড API ইন্টিগ্রেশন নেই, সব অ্যাডমিন প্যানেল থেকে যোগ/টেস্ট করা যায়
  - সম্পূর্ণ অ্যাডমিন প্যানেল: ড্যাশবোর্ড (Chart.js), অর্ডার ম্যানেজমেন্ট, রিচার্জ অনুমোদন, সার্ভিস+ক্যাটাগরি CRUD, API প্রোভাইডার CRUD+টেস্ট, ইউজার ম্যানেজমেন্ট, কুপন, সাপোর্ট টিকেট, সেটিংস (general/payment-methods/payment-gateways)
  - **"Admin Mode" ভিজ্যুয়াল থিম**: অ্যাডমিন প্যানেল ইউজার প্যানেল থেকে স্পষ্টভাবে আলাদা দেখতে — violet/fuchsia অ্যাকসেন্ট কালার, শীর্ষে shimmer স্ট্রাইপ, পালসিং "Admin Mode" ব্যাজ, শিল্ড আইকন, এবং একটি সতর্কতা চিপ ("এখানে করা পরিবর্তন সরাসরি প্ল্যাটফর্মে প্রভাব ফেলে") — যাতে অ্যাডমিন একনজরেই বুঝতে পারে সে সাধারণ ইউজার প্যানেলে নেই
  - "Uncommon UI": aurora animated background, cursor-follow glow, spotlight cards, ripple buttons, glassmorphism — কোনো রেফারেন্স ভিডিওর হুবহু কপি নয়

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
- **Last Updated**: 2026-08-28 (প্রোডাকশন Cloudflare Pages ডিপ্লয় সম্পন্ন — D1 + R2 লাইভ)

## Frontend Page Files (all completed)
`landing.js`, `auth.js`, `dashboard.js`, `services.js`, `orders.js`, `wallet.js`, `reports.js`, `support.js`, `referral.js`, `profile.js`, `admin.js` (12 admin views: dashboard, orders+detail, recharge, services+categories+form-builder, providers+test, users+detail, coupons, support+detail, settings).

## Admin Panel vs User Panel — RBAC Verified, Visual Distinction Added
ব্যাকএন্ড (`adminRequired` middleware, প্রতিটি `/api/admin/*` রুটে JWT role চেক) এবং ফ্রন্টএন্ড রাউটার (`authRequired`/`adminRequired` route flag) — দুই লেয়ারেই role-based access সঠিকভাবে কাজ করে (curl + কোড রিভিউ + ব্রাউজার টেস্ট দিয়ে যাচাই করা হয়েছে; সাধারণ ইউজার `/api/admin/*` কল করলে 403 পায়, ফ্রন্টএন্ডেও `/admin/*` পেজে redirect হয়ে যায়)। তবে দুই প্যানেলের লেআউট একই "glass" শেল শেয়ার করায় দেখতে প্রায় একইরকম লাগছিল, তাই অ্যাডমিন প্যানেলে আলাদা ভিজ্যুয়াল থিম (violet/fuchsia, উপরে বর্ণিত) যোগ করা হয়েছে।

## Known Issue Fixed This Session
- Hono 4.13.5 upgraded `verify()` in `hono/jwt` to require an explicit `alg` argument (breaking change vs. older Hono versions). This caused every authenticated request (including all admin routes) to fail with "সেশনের মেয়াদ শেষ হয়ে গেছে" even with a fresh, valid token. Fixed in `src/lib/jwt.ts` by passing `'HS256'` explicitly to `verify()`.
- Two admin.js API calls used a trailing slash (`/admin/settings/`) which didn't match the Hono route registered without a trailing slash, causing the SPA fallback HTML to be returned instead of JSON. Fixed by removing the trailing slash.

## Not Yet Implemented / Next Steps
- Real UddoktaPay (or other) auto payment-gateway webhook/callback integration — currently only a placeholder inactive DB row + admin config UI; the actual payment-collect + webhook-verify code path has not been implemented
- End-to-end UI testing of every admin.js modal/flow in a real browser (only API-level curl testing done this session due to sandbox constraints)
- OTP/SMS provider integration for phone verification (currently `otp_codes` table exists but no real SMS gateway wired up)
