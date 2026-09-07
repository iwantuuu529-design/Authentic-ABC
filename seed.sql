-- ============================================================
-- BDRIS-Pro | Seed Data
-- ============================================================

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_name', 'DocFlow BD'),
  ('site_tagline', 'দ্রুত, নিরাপদ ও স্মার্ট সরকারি ডকুমেন্ট সার্ভিস'),
  ('referral_bonus_amount', '20'),
  ('min_recharge_amount', '50'),
  ('captcha_enabled', '1'),
  ('support_whatsapp', '8801700000000'),
  ('live_notice_enabled', '0'),
  ('live_notice_text', ''),
  ('promo_card_enabled', '0'),
  ('promo_card_badge', ''),
  ('promo_card_title', ''),
  ('promo_card_desc', ''),
  ('promo_card_cta_label', ''),
  ('promo_card_cta_url', '');

-- Default admin account
-- Login phone: 01835414122  |  password: 52944820
-- (PBKDF2-SHA256, 100k iterations — verified natively by Cloudflare Workers Web Crypto, no native bcrypt dependency)
INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role, balance, referral_code, kyc_status, phone_verified, email_verified, status)
VALUES (1, 'Super Admin', 'admin@docflow.bd', '01835414122', 'pbkdf2$100000$7c03cb6c27aef72ac2c8b8607ff85be5$3beab32737447cad4c4b05f20511a166cc464c559b762f60ec0e355a518a1c30', 'admin', 10000, 'ADMIN001', 'verified', 1, 1, 'active');

-- Service Categories
INSERT OR IGNORE INTO service_categories (id, name_bn, name_en, slug, icon, sort_order) VALUES
  (1, 'জন্ম নিবন্ধন', 'Birth Registration', 'birth', 'fa-baby', 1),
  (2, 'এনআইডি ও ভোটার সেবা', 'NID & Voter Services', 'nid', 'fa-id-card', 2),
  (3, 'ভূমি সেবা', 'Land Services', 'land', 'fa-map-location-dot', 3),
  (4, 'অন্যান্য সেবা', 'Other Services', 'others', 'fa-layer-group', 4);

-- API Providers (example placeholder — admin fills real key later)
INSERT OR IGNORE INTO api_providers (id, name, base_url, http_method, auth_type, auth_key_name, auth_key_value, request_template, response_success_path, response_success_value, response_result_path, response_error_path, status)
VALUES (1, 'Demo Verification API', 'https://api.example.com/v1/verify', 'POST', 'header', 'X-API-KEY', 'CHANGE_ME', '{"ubrn":"{{ubrn}}","dob":"{{dob}}"}', 'status', 'success', 'data', 'message', 'inactive');

-- Services
INSERT OR IGNORE INTO services
 (id, category_id, name_bn, name_en, slug, description_bn, icon, price, cost_price, fulfillment_mode, api_provider_id, field_mapping, form_schema, avg_delivery_minutes, requires_captcha, is_featured, sort_order, status)
VALUES
(1, 1, 'জন্ম নিবন্ধন যাচাই', 'Birth Certificate Search', 'birth-certificate-search',
 'জন্ম নিবন্ধন নম্বর ও জন্ম তারিখ দিয়ে সরকারি তথ্য যাচাই করুন।', 'fa-magnifying-glass', 2.00, 0.50, 'manual', NULL, NULL,
 '[{"name":"ubrn","label_bn":"জন্ম নিবন্ধন নম্বর (UBRN)","type":"text","required":true,"pattern":"^[0-9]{17}$","placeholder":"১৭ ডিজিটের নম্বর দিন"},{"name":"dob","label_bn":"জন্ম তারিখ","type":"date","required":true}]',
 15, 1, 1, 1, 'active'),

(2, 1, 'জন্ম নিবন্ধন আবেদন', 'Birth Registration Application', 'birth-registration-application',
 'নতুন জন্ম নিবন্ধনের জন্য সম্পূর্ণ আবেদন ফরম পূরণ করুন।', 'fa-file-signature', 50.00, 20.00, 'manual', NULL, NULL,
 '[{"name":"child_name_bn","label_bn":"শিশুর নাম (বাংলা)","type":"text","required":true},{"name":"child_name_en","label_bn":"Child Name (English)","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"date","required":true},{"name":"gender","label_bn":"লিঙ্গ","type":"select","options":["পুরুষ","মহিলা","অন্যান্য"],"required":true},{"name":"father_name_bn","label_bn":"পিতার নাম (বাংলা)","type":"text","required":true},{"name":"mother_name_bn","label_bn":"মাতার নাম (বাংলা)","type":"text","required":true},{"name":"address","label_bn":"স্থায়ী ঠিকানা","type":"textarea","required":true}]',
 1440, 0, 1, 2, 'active'),

(3, 1, 'জন্ম নিবন্ধন মন্ত্রণালয় তথ্য', 'Birth Ministry Data Lookup', 'birth-ministry-data',
 'নাম, পিতার নাম, জন্ম সাল দিয়ে বিস্তারিত অনুসন্ধান।', 'fa-database', 130.00, 60.00, 'manual', NULL, NULL,
 '[{"name":"name","label_bn":"নাম","type":"text","required":true},{"name":"father_name","label_bn":"পিতার নাম","type":"text","required":false},{"name":"year_from","label_bn":"জন্ম সাল (শুরু)","type":"number","required":false},{"name":"year_to","label_bn":"জন্ম সাল (শেষ)","type":"number","required":false},{"name":"gender","label_bn":"লিঙ্গ","type":"select","options":["পুরুষ","মহিলা"],"required":false}]',
 720, 1, 0, 3, 'active'),

(4, 2, 'এনআইডি মেক', 'NID Make', 'nid-make',
 'পিডিএফ আপলোড করে এনআইডি কার্ড তৈরি করুন।', 'fa-id-badge', 2.00, 0.50, 'manual', NULL, NULL,
 '[{"name":"pdf_file","label_bn":"পিডিএফ আপলোড করুন","type":"file","accept":".pdf","required":true}]',
 20, 0, 1, 4, 'active'),

(5, 2, 'এনআইডি ইউজার পাস (ফেস ভেরিফিকেশন)', 'NID User Pass (Face Verify)', 'nid-user-pass',
 'ফেস ভেরিফিকেশনের মাধ্যমে এনআইডি পোর্টাল অ্যাক্সেস।', 'fa-face-viewfinder', 30.00, 15.00, 'manual', NULL, NULL,
 '[{"name":"nid_number","label_bn":"এনআইডি নম্বর","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"date","required":true},{"name":"face_photo","label_bn":"ছবি আপলোড করুন","type":"file","accept":"image/*","required":true}]',
 60, 1, 0, 5, 'active'),

(6, 2, 'এনআইডি স্মার্ট কার্ড পিডিএফ', 'NID Smart Card PDF', 'nid-smart-card-pdf',
 'সাইন কপি থেকে স্মার্ট কার্ড ফরম্যাট জেনারেট করুন।', 'fa-credit-card', 25.00, 10.00, 'manual', NULL, NULL,
 '[{"name":"sign_copy_file","label_bn":"সাইন কপি আপলোড করুন","type":"file","accept":".pdf,image/*","required":true}]',
 45, 0, 0, 6, 'active'),

(7, 2, 'এনআইডি সার্ভার কপি', 'NID Server Copy', 'nid-server-copy',
 'এনআইডি সার্ভার থেকে সরাসরি কপি সংগ্রহ করুন।', 'fa-server', 30.00, 15.00, 'api', 1, '{"nid_number":"nid_number","dob":"dob"}',
 '[{"name":"nid_number","label_bn":"এনআইডি নম্বর (১০/১৩/১৭ ডিজিট)","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"date","required":true}]',
 5, 1, 1, 7, 'active'),

(8, 2, 'এনআইডি সাইন কপি', 'NID Sign Copy', 'nid-sign-copy',
 'সরকারি ডাটাবেজ থেকে স্বাক্ষর কপি সংগ্রহ করুন।', 'fa-signature', 20.00, 8.00, 'manual', NULL, NULL,
 '[{"name":"nid_number","label_bn":"এনআইডি নম্বর","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"date","required":true}]',
 45, 1, 0, 8, 'active'),

(9, 3, 'ভূমি দাখিলা ফাইন্ডার', 'Land Dakhila Finder', 'land-dakhila-finder',
 'জমির খতিয়ান ও দাখিলা তথ্য খুঁজুন।', 'fa-map-pin', 150.00, 70.00, 'manual', NULL, NULL,
 '[{"name":"district","label_bn":"জেলা","type":"text","required":true},{"name":"upazila","label_bn":"উপজেলা","type":"text","required":true},{"name":"mouza","label_bn":"মৌজা","type":"text","required":true},{"name":"khatian_no","label_bn":"খতিয়ান নম্বর","type":"text","required":false},{"name":"owner_name","label_bn":"মালিকের নাম","type":"text","required":false}]',
 2880, 1, 0, 9, 'active'),

(10, 4, 'অন্যান্য কাস্টম সার্ভিস', 'Custom Request Service', 'custom-request',
 'তালিকায় নেই এমন যেকোনো সরকারি ডকুমেন্ট সংক্রান্ত অনুরোধ জানান।', 'fa-headset', 0.00, 0.00, 'manual', NULL, NULL,
 '[{"name":"request_title","label_bn":"অনুরোধের বিষয়","type":"text","required":true},{"name":"details","label_bn":"বিস্তারিত বর্ণনা","type":"textarea","required":true},{"name":"attachment","label_bn":"সংযুক্তি (ঐচ্ছিক)","type":"file","accept":".pdf,image/*","required":false}]',
 1440, 0, 0, 10, 'active'),

(11, 1, 'নিবন্ধন পিডিএফ তৈরি', 'NIBANDAN PDF CREATE', 'nibandan-pdf-create',
 'পিডিএফ আপলোড করে অটো-প্রসেসিংয়ের মাধ্যমে ইউনিক ফরম্যাটে জন্ম নিবন্ধন সনদ প্রস্তুত করুন।', 'fa-file-pdf', 4.00, 1.00, 'manual', NULL, NULL,
 '[{"name":"pdf_file","label_bn":"পিডিএফ আপলোড করুন","type":"file","accept":".pdf","required":true},{"name":"name_bn","label_bn":"নাম (বাংলা)","type":"text","required":true},{"name":"name_en","label_bn":"নাম (ইংরেজি)","type":"text","required":true},{"name":"registration_no","label_bn":"নিবন্ধন নম্বর","type":"text","required":true},{"name":"book_no","label_bn":"পিন / বুক নম্বর","type":"text","required":false},{"name":"father_name_bn","label_bn":"পিতার নাম","type":"text","required":true},{"name":"mother_name_bn","label_bn":"মাতার নাম","type":"text","required":true},{"name":"birth_place","label_bn":"জন্মস্থান","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"text","required":true},{"name":"gender_blood","label_bn":"লিঙ্গ / রক্তের গ্রুপ","type":"text","required":false},{"name":"issue_date","label_bn":"প্রদানের তারিখ","type":"text","required":false},{"name":"address","label_bn":"ঠিকানা","type":"textarea","required":true}]',
 5, 0, 1, 1, 'active');

-- Payment methods (manual)
INSERT OR IGNORE INTO payment_methods (id, method, account_number, account_type, instructions_bn, sort_order) VALUES
  (1, 'bkash', '01700000000', 'personal', 'বিকাশ সেন্ড মানি অপশনে টাকা পাঠিয়ে ট্রানজেকশন আইডি ও স্ক্রিনশট জমা দিন।', 1),
  (2, 'nagad', '01700000000', 'personal', 'নগদ সেন্ড মানি অপশনে টাকা পাঠিয়ে ট্রানজেকশন আইডি ও স্ক্রিনশট জমা দিন।', 2);

-- Auto payment gateway placeholder (inactive until admin configures)
INSERT OR IGNORE INTO payment_gateways (id, provider_key, name, api_base_url, is_auto, status) VALUES
  (1, 'uddoktapay', 'UddoktaPay', 'https://sandbox.uddoktapay.com/api', 1, 'inactive');
