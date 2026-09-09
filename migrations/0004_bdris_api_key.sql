-- ============================================================
-- Migration 0004 — BDRIS lookup API key (SkSeba)
-- Editable later from Admin → Settings (key: bdris_api_key).
-- ============================================================

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('bdris_api_key', '2f5b625b1c1864256f418c8c00ad5307');
