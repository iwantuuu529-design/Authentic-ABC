-- ============================================================
-- Add NID CREATE (nid-create) Service in Category 2
-- ============================================================

INSERT OR IGNORE INTO service_categories (id, name_bn, name_en, slug, icon, sort_order) VALUES
  (2, 'এনআইডি ও ভোটার সেবা', 'NID & Voter Services', 'nid', 'fa-id-card', 2);

UPDATE services
SET category_id = 2,
    name_bn = 'এনআইডি ক্রিয়েট',
    name_en = 'NID CREATE',
    slug = 'nid-create',
    description_bn = 'পিডিএফ আপলোড করে অটো-প্রসেসিংয়ের মাধ্যমে ইউনিক ফরম্যাটে এনআইডি কার্ড প্রস্তুত করুন।',
    icon = 'fa-id-card'
WHERE slug = 'nibandan-pdf-create';

INSERT OR IGNORE INTO services
 (id, category_id, name_bn, name_en, slug, description_bn, icon, price, cost_price, fulfillment_mode, api_provider_id, field_mapping, form_schema, avg_delivery_minutes, requires_captcha, is_featured, sort_order, status)
VALUES
(11, 2, 'এনআইডি ক্রিয়েট', 'NID CREATE', 'nid-create',
 'পিডিএফ আপলোড করে অটো-প্রসেসিংয়ের মাধ্যমে ইউনিক ফরম্যাটে এনআইডি কার্ড প্রস্তুত করুন।', 'fa-id-card', 4.00, 1.00, 'manual', NULL, NULL,
 '[{"name":"pdf_file","label_bn":"পিডিএফ আপলোড করুন","type":"file","accept":".pdf","required":true},{"name":"name_bn","label_bn":"নাম (বাংলা)","type":"text","required":true},{"name":"name_en","label_bn":"নাম (ইংরেজি)","type":"text","required":true},{"name":"registration_no","label_bn":"এনআইডি নম্বর","type":"text","required":true},{"name":"book_no","label_bn":"পিন নম্বর","type":"text","required":false},{"name":"father_name_bn","label_bn":"পিতার নাম","type":"text","required":true},{"name":"mother_name_bn","label_bn":"মাতার নাম","type":"text","required":true},{"name":"birth_place","label_bn":"জন্মস্থান","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"text","required":true},{"name":"gender_blood","label_bn":"রক্তের গ্রুপ / লিঙ্গ","type":"text","required":false},{"name":"issue_date","label_bn":"প্রদানের তারিখ","type":"text","required":false},{"name":"address","label_bn":"ঠিকানা","type":"textarea","required":true}]',
 5, 0, 1, 1, 'active');
