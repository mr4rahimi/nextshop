-- فهرست سرویس‌های یکپارچه‌سازی روی هر سایت (قبلاً فقط با prisma/seed-integration.ts ساخته می‌شد
-- و سایتی که seed نگرفته بود صفحه‌ی اتصالات خالی داشت). فقط سرویس‌های دارای adapter.
-- ON CONFLICT: ردیف موجود (نام، isActive) دست نمی‌خورد.
INSERT INTO "IntegPlatform" ("code", "name", "type") VALUES
  ('hesaban',    'وب‌حسابان', 'ACCOUNTING'),
  ('basalam',    'باسلام',    'MARKETPLACE'),
  ('digikala',   'دیجیکالا',  'MARKETPLACE'),
  ('snappshop',  'اسنپ‌شاپ',  'MARKETPLACE'),
  ('tapsi_shop', 'تپسی‌شاپ',  'MARKETPLACE')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "IntegSettings" ("id", "updatedAt") VALUES ('singleton', NOW())
ON CONFLICT ("id") DO NOTHING;
