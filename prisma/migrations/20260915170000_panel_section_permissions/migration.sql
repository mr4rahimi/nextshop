-- دروازه‌ی بخش‌های پنل (کارتابل فاز ۹) — docs/features/staff-worklist.md بخش ۲۳
--
-- ⚠️ سازگاری عقب‌رو: تا امروز هر نقشی همه‌ی بخش‌های قدیمی پنل را باز می‌کرد.
-- اگر این مجوزها را به نقش‌های موجود ندهیم، روز دیپلوی کارمندانی که نقش دارند
-- بی‌صدا از محصولات، سفارش‌ها و … بیرون می‌افتند. پس رفتار فعلی حفظ می‌شود و
-- بستن هر بخش تصمیم آگاهانه‌ی مدیر از صفحه‌ی «نقش‌ها و دسترسی‌ها» است.
-- مجوزهای حساس تازه (DEAL_*، COMMISSION_*، CUSTOMER_*) عمداً اینجا داده نمی‌شوند.

UPDATE "StaffRole"
SET "permissions" = ARRAY(
  SELECT DISTINCT unnest(
    "permissions" || ARRAY[
      'PANEL_CATALOG', 'PANEL_ORDERS', 'PANEL_CONTENT', 'PANEL_USERS',
      'PANEL_CLUB', 'PANEL_INTEGRATION', 'PANEL_SETTINGS', 'PANEL_REPORTS'
    ]::text[]
  )
);
