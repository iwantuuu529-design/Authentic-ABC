-- ============================================================
-- BDRIS-Pro | Initial Database Schema
-- Cloudflare D1 (SQLite dialect)
-- ============================================================

-- -----------------------------
-- USERS
-- -----------------------------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE NOT NULL,
  whatsapp TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',              -- user | admin | staff
  balance REAL NOT NULL DEFAULT 0,
  avatar_url TEXT,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  kyc_status TEXT NOT NULL DEFAULT 'unverified',  -- unverified | pending | verified | rejected
  kyc_nid_number TEXT,
  kyc_doc_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',          -- active | suspended | banned
  phone_verified INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until DATETIME,
  last_login_at DATETIME,
  last_login_ip TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- -----------------------------
-- OTP CODES (phone/email verification, password reset)
-- -----------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,        -- phone or email
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,           -- register | login | reset_password | verify_phone
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used INTEGER NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_codes(identifier, purpose);

-- -----------------------------
-- SERVICE CATEGORIES
-- -----------------------------
CREATE TABLE IF NOT EXISTS service_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT 'fa-layer-group',
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- API PROVIDERS (admin-configurable 3rd-party auto engines)
-- -----------------------------
CREATE TABLE IF NOT EXISTS api_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST',      -- GET | POST
  auth_type TEXT NOT NULL DEFAULT 'header',      -- header | query | bearer | basic | none
  auth_key_name TEXT,                             -- e.g. "X-API-KEY" or "api_key"
  auth_key_value TEXT,                            -- secret value (encrypted at rest ideally)
  request_template TEXT,                          -- JSON template string with {{field}} placeholders
  response_success_path TEXT,                     -- dot-path to check success, e.g. "status"
  response_success_value TEXT,                    -- expected value, e.g. "ok"
  response_result_path TEXT,                      -- dot-path to extract result payload
  response_error_path TEXT,                       -- dot-path to extract error message
  timeout_ms INTEGER DEFAULT 15000,
  status TEXT NOT NULL DEFAULT 'active',          -- active | inactive
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- SERVICES (dynamic form schema based)
-- -----------------------------
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description_bn TEXT,
  description_en TEXT,
  icon TEXT DEFAULT 'fa-file-lines',
  price REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,             -- internal cost (for profit reports)
  fulfillment_mode TEXT NOT NULL DEFAULT 'manual', -- manual | api | hybrid
  api_provider_id INTEGER,
  field_mapping TEXT,                              -- JSON: maps form fields -> API request fields
  form_schema TEXT NOT NULL,                       -- JSON schema array describing dynamic form fields
  avg_delivery_minutes INTEGER DEFAULT 60,
  requires_captcha INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',           -- active | inactive | maintenance
  total_orders INTEGER NOT NULL DEFAULT 0,
  success_orders INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES service_categories(id),
  FOREIGN KEY (api_provider_id) REFERENCES api_providers(id)
);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);

-- -----------------------------
-- ORDERS
-- -----------------------------
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  form_data TEXT NOT NULL,                 -- JSON of submitted form values
  price REAL NOT NULL,
  fulfillment_mode TEXT NOT NULL,          -- manual | api | hybrid (snapshot at order time)
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | rejected | refunded
  result_data TEXT,                        -- JSON or text result content
  result_file_key TEXT,                    -- R2 object key for generated file
  api_raw_response TEXT,                   -- raw API response (debugging/audit)
  admin_note TEXT,
  processed_by INTEGER,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (processed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_service ON orders(service_id);

-- -----------------------------
-- ORDER LOGS (timeline / activity trail per order)
-- -----------------------------
CREATE TABLE IF NOT EXISTS order_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,   -- system | user | admin
  actor_id INTEGER,
  action TEXT NOT NULL,       -- created | auto_processing | api_success | api_failed | approved | rejected | refunded | note
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_order_logs_order ON order_logs(order_id);

-- -----------------------------
-- TRANSACTIONS (wallet ledger - single source of truth)
-- -----------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,                 -- recharge | order_payment | refund | referral_bonus | coupon_bonus | admin_adjustment
  amount REAL NOT NULL,               -- positive = credit, negative = debit
  balance_before REAL NOT NULL,
  balance_after REAL NOT NULL,
  reference_type TEXT,                -- order | recharge_request | coupon | referral | manual
  reference_id INTEGER,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- -----------------------------
-- PAYMENT METHODS (admin-configured receiving numbers for manual recharge)
-- -----------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT NOT NULL,             -- bkash | nagad | rocket | upay | other
  account_number TEXT NOT NULL,
  account_type TEXT DEFAULT 'personal', -- personal | merchant
  instructions_bn TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- AUTO PAYMENT GATEWAYS (pluggable, e.g. Uddoktapay/SSLCommerz)
-- -----------------------------
CREATE TABLE IF NOT EXISTS payment_gateways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_key TEXT UNIQUE NOT NULL,   -- 'uddoktapay' | 'sslcommerz' | 'bkash_merchant' etc.
  name TEXT NOT NULL,
  api_base_url TEXT,
  api_key TEXT,
  api_secret TEXT,
  config TEXT,                          -- JSON blob for provider-specific extra config
  is_auto INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'inactive', -- active | inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- RECHARGE REQUESTS (manual top-up flow)
-- -----------------------------
CREATE TABLE IF NOT EXISTS recharge_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_no TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  payment_method_id INTEGER,
  method TEXT NOT NULL,              -- bkash | nagad | rocket | upay | other | auto_gateway
  sender_number TEXT,
  whatsapp_number TEXT,
  transaction_id TEXT,
  proof_file_key TEXT,               -- R2 object key of screenshot
  amount REAL NOT NULL,
  is_auto INTEGER NOT NULL DEFAULT 0,
  gateway_provider TEXT,             -- if auto: provider key
  gateway_reference TEXT,            -- if auto: external payment id
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_note TEXT,
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_recharge_user ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_status ON recharge_requests(status);

-- -----------------------------
-- COUPONS
-- -----------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed',   -- fixed | percentage
  value REAL NOT NULL,
  min_recharge REAL DEFAULT 0,
  max_discount REAL,
  usage_limit INTEGER DEFAULT 0,        -- 0 = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,
  applicable_to TEXT NOT NULL DEFAULT 'recharge', -- recharge | order
  expires_at DATETIME,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reference_type TEXT,      -- recharge_request | order
  reference_id INTEGER,
  amount_discounted REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- -----------------------------
-- NOTIFICATIONS
-- -----------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',  -- info | success | warning | error
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- -----------------------------
-- SUPPORT TICKETS
-- -----------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'general',   -- general | payment | order | technical | other
  order_id INTEGER,
  priority TEXT DEFAULT 'normal',     -- low | normal | high | urgent
  status TEXT NOT NULL DEFAULT 'open', -- open | answered | closed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,   -- user | admin
  sender_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  attachment_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

-- -----------------------------
-- REFERRALS
-- -----------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referred_id INTEGER NOT NULL UNIQUE,
  bonus_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | credited
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);

-- -----------------------------
-- SETTINGS (key-value site config; replaces need for KV on hosted deploy)
-- -----------------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- ADMIN / AUDIT LOGS
-- -----------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  note TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
