-- ============================================================
-- Migration 0003 — per-service fulfillment logic
--
-- Gives EVERY catalog service its appropriate processing mode:
--
--   AUTO document-generation services (the Super-Fast designer
--   produces the document client-side; the server completes the
--   order instantly instead of dumping it into the manual queue):
--     nid-create / nibandan-pdf-create / nid-make
--
--   LOOKUP / verification services become HYBRID with a correct
--   field_mapping: they auto-dispatch to an admin-configured,
--   ACTIVE API provider when one exists, and otherwise fall back
--   safely to the manual queue. Results always come from the
--   configured provider — never fabricated by the platform.
--
--   Human-processed services (birth-registration-application,
--   nid-user-pass, custom-request, nid-smart-card-pdf) stay manual:
--   that IS their correct logic.
-- ============================================================

-- 1) Instant document generation
UPDATE services SET fulfillment_mode = 'auto' WHERE slug IN ('nid-create', 'nibandan-pdf-create', 'nid-make');

-- 2) Lookup services -> hybrid + correct field mapping
UPDATE services
SET fulfillment_mode = 'hybrid',
    field_mapping = '{"ubrn":"ubrn","dob":"dob"}'
WHERE slug = 'birth-certificate-search';

UPDATE services
SET fulfillment_mode = 'hybrid',
    field_mapping = '{"name":"name","father_name":"father_name","year_from":"year_from","year_to":"year_to","gender":"gender"}'
WHERE slug = 'birth-ministry-data';

UPDATE services
SET fulfillment_mode = 'hybrid',
    field_mapping = '{"nid_number":"nid_number","dob":"dob"}'
WHERE slug = 'nid-sign-copy';

UPDATE services
SET fulfillment_mode = 'hybrid',
    field_mapping = '{"district":"district","upazila":"upazila","mouza":"mouza","khatian_no":"khatian_no","owner_name":"owner_name"}'
WHERE slug = 'land-dakhila-finder';

-- nid-server-copy already uses api mode with provider 1; just make sure
-- its mapping is present.
UPDATE services
SET field_mapping = '{"nid_number":"nid_number","dob":"dob"}'
WHERE slug = 'nid-server-copy' AND (field_mapping IS NULL OR field_mapping = '');
