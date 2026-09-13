-- ============================================================
-- Migration 0005 — gateway payments (UddoktaPay auto recharge)
-- ============================================================

CREATE TABLE IF NOT EXISTS gateway_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  recharge_request_id INTEGER,
  gateway_id INTEGER,
  provider_key TEXT NOT NULL DEFAULT 'uddoktapay',
  provider_invoice_id TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',  -- created | paid | failed | expired
  raw TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Fill the sandbox UddoktaPay key on untouched placeholder rows and
-- enable them so the auto-recharge flow is testable out of the box.
UPDATE payment_gateways
SET api_key = COALESCE(api_key, '982d381360a69d419689740d9f2e26ce36fb7a50'),
    status = CASE WHEN status = 'inactive' AND api_key IS NULL THEN 'active' ELSE status END
WHERE provider_key = 'uddoktapay';
