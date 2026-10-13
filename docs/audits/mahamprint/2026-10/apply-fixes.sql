-- اصلاحات فنی سئوی مهام پرینت — ۱۴۰۵/۰۷/۲۱ (۲۰۲۶-۱۰-۱۳)
-- اجرا: ssh root@185.164.73.224 "sudo -u postgres psql -d mahamprinter_db -v ON_ERROR_STOP=1" < apply-fixes.sql
-- برگشت: rollback-fixes.sql — بکاپ جدول‌ها: /root/backups/mahamprint-seo-20261013/
-- همه‌ی یادداشت‌ها با «سئو ۱۴۰۵/۰۷/۲۱» شروع می‌شوند.

-- مقدار قبلی توضیحات دسته‌ها (بند ۴) برای برگشت دقیق، روی خود سرور نوشته می‌شود
\t on
\a
-- (psql با کاربر postgres اجرا می‌شود و به /root دسترسی ندارد؛ بعد از اجرا به /root/backups/mahamprint-seo-20261013/ منتقل شود)
\o /tmp/maham-category-desc-rollback.sql
SELECT format('UPDATE "Category" SET "seoDescription" = %L WHERE slug = %L;', "seoDescription", slug)
FROM "Category" WHERE "seoDescription" ~ '^\s*\.';
\o
\t off
\a

BEGIN;

-- ۱. سه آدرس قدیمی که مقاله‌ی جایگزینشان حالا منتشر شده (طبق بریف کارهای محتوای ۶ و ۷)
UPDATE "Redirect" SET destination = 'https://mahamprint.com/mag/what-is-a-digital-pen-and-what-is-it-used-for',
  note = 'سئو ۱۴۰۵/۰۷/۲۱ — مقصد به مقاله‌ی تازه‌ی «قلم نوری چیست» عوض شد (قبلاً پد امضا)', "updatedAt" = now()
WHERE source = '/mag/انواع-قلم-نوری';
UPDATE "Redirect" SET destination = 'https://mahamprint.com/mag/color-and-black-and-white-print-test-download-printer-test-page',
  note = 'سئو ۱۴۰۵/۰۷/۲۱ — مقصد به مقاله‌ی تازه‌ی «تست پرینت» عوض شد (قبلاً بهترین پرینتر رنگی)', "updatedAt" = now()
WHERE source = '/mag/تست-پرینت-سیاه-سفید-و-رنگی';

-- ۲. آدرس‌های قدیمی که هنوز در نتایج گوگل‌اند و ۴۰۴ می‌دادند
INSERT INTO "Redirect"(id,source,destination,"statusCode","matchType","isActive",hits,note,"createdAt","updatedAt") VALUES
 ('seo1013r0001','/category/113/کارت-پی-وی-سی','https://mahamprint.com/categories/labelprinter',301,'EXACT',true,0,'سئو ۱۴۰۵/۰۷/۲۱ — دسته‌ی قدیم کارت PVC (هنوز در نتایج گوگل)',now(),now()),
 ('seo1013r0002','/news/تفاوت-پرینترهای-جوهرافشان-و-لیزری','https://mahamprint.com/mag/inkjet-vs-laser-printer',301,'EXACT',true,0,'سئو ۱۴۰۵/۰۷/۲۱ — خبر قدیم (هنوز در نتایج گوگل)',now(),now()),
 ('seo1013r0003','/page/fasp','https://mahamprint.com/contact-us',301,'EXACT',true,0,'سئو ۱۴۰۵/۰۷/۲۱ — برگه‌ی قدیم پرسش‌های متداول (۹ نمایش در گوگل)',now(),now())
ON CONFLICT (source) DO UPDATE SET destination=EXCLUDED.destination,"isActive"=true,note=EXCLUDED.note,"updatedAt"=now();

-- ۳. دو لندینگ بدون فیلتر، کپی کامل دسته‌ی خودشان‌اند (۱۲ از ۱۲ محصول یکسان، H1 یکسان) → noindex تا فیلتر بگیرند
UPDATE "LandingPage" SET "isIndexable" = false, "updatedAt" = now()
WHERE slug IN ('label-printer','receipt-printer') AND filters::text = '{}';

-- ۳ب. فیلتر لندینگ «پرینتر لیزری چهارکاره canon» برند hp بود و محصولات HP نشان می‌داد (کپی لندینگ HP)
UPDATE "LandingPage" SET filters = jsonb_set(filters::jsonb, '{brand}', '"canon"')::json, "updatedAt" = now()
WHERE slug = 'printr-lizri-chharkarh-canon' AND filters::jsonb ->> 'brand' = 'hp';

-- ۳ج. دو جفت لندینگ تکراری (فیلتر یکسان، محصولات یکسان) — یکی می‌ماند، دیگری ۳۰۱ می‌شود
UPDATE "LandingPage" SET "isActive" = false, "updatedAt" = now()
WHERE slug IN ('khrid-printrhai-svzni','khrid-printrhai-johrafshan');
INSERT INTO "Redirect"(id,source,destination,"statusCode","matchType","isActive",hits,note,"createdAt","updatedAt") VALUES
 ('seo1013r0004','/collections/khrid-printrhai-svzni','https://mahamprint.com/collections/printr-svzni',301,'EXACT',true,0,'سئو ۱۴۰۵/۰۷/۲۱ — لندینگ تکراری پرینتر سوزنی ادغام شد',now(),now()),
 ('seo1013r0005','/collections/khrid-printrhai-johrafshan','https://mahamprint.com/collections/khrid-printrhai-jvhrafshan',301,'EXACT',true,0,'سئو ۱۴۰۵/۰۷/۲۱ — لندینگ تکراری پرینتر جوهرافشان ادغام شد',now(),now())
ON CONFLICT (source) DO UPDATE SET destination=EXCLUDED.destination,"isActive"=true,note=EXCLUDED.note,"updatedAt"=now();
-- ریدایرکت‌های قدیمی که به لندینگ حذف‌شده می‌رفتند، مستقیم به مقصد نهایی (بدون زنجیره)
UPDATE "Redirect" SET destination = 'https://mahamprint.com/collections/khrid-printrhai-jvhrafshan',
  note = coalesce(note, '') || ' | سئو ۱۴۰۵/۰۷/۲۱: مقصد از johrafshan عوض شد', "updatedAt" = now()
WHERE destination = 'https://mahamprint.com/collections/khrid-printrhai-johrafshan';

-- ۴. نقطه‌ی اول توضیحات متای دسته‌ها (در نتیجه‌ی گوگل با «.» شروع می‌شد)
UPDATE "Category" SET "seoDescription" = btrim(regexp_replace("seoDescription", '^\s*\.\s*', ''), E' \n\r\t'), "updatedAt" = now()
WHERE "seoDescription" ~ '^\s*\.';

-- ۵. وصل کردن کارهای محتوا به مقاله‌هایی که مستقیم در مجله منتشر شدند،
--    تا گردش کار پنل (ارسال ← انتشار ← تأیید) و مقایسه‌ی اثر روی همان مقاله بنشیند.
--    قاعده‌ی ۲ (content-publish.ts): از وقتی مقاله وصل است، body خالی و متن فقط در BlogPost است.
WITH m(code, slug) AS (VALUES
  (1, 'best-3-in-1-printers-for-home-and-office'),
  (4, 'home-printer-buying-guide'),
  (6, 'what-is-a-digital-pen-and-what-is-it-used-for'),
  (7, 'color-and-black-and-white-print-test-download-printer-test-page'),
  (3, 'what-is-a-thermal-label-printer-the-difference-between-direct-thermal-and-therma')
), linked AS (
  UPDATE "ContentTask" t SET "blogPostId" = p.id, body = NULL,
    "wordCount" = coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(p.content, '<[^>]+>', ' ', 'g')), '\s+'), 1), 0),
    "updatedAt" = now()
  FROM m JOIN "BlogPost" p ON p.slug = m.slug
  WHERE t.code = m.code AND t."blogPostId" IS NULL AND t."deletedAt" IS NULL
  RETURNING t.id, t.status, p.slug
)
INSERT INTO "ContentTaskEvent"(id, "taskId", "actorId", "actorName", action, "fromStatus", "toStatus", note, "createdAt")
SELECT 'seo1013e' || substr(md5(id), 1, 12), id, 'cmp72zxxi00014y9sk7q1u5nz', 'مهدی رحیمی', 'SYSTEM', status, status,
  'سئو ۱۴۰۵/۰۷/۲۱ — مقاله‌ی /mag/' || slug || ' مستقیم در مجله منتشر شده بود؛ به این کار وصل شد تا مراحل ارسال، انتشار و تأیید از پنل ثبت شود', now()
FROM linked;

-- بررسی: باید ۲ | ۵ | ۴ | ۲ | ۰ | ۵ باشد
SELECT
  (SELECT count(*) FROM "Redirect" WHERE note LIKE 'سئو ۱۴۰۵/۰۷/۲۱%' AND source LIKE '/mag/%') AS mag_redirects,
  (SELECT count(*) FROM "Redirect" WHERE id LIKE 'seo1013r%') AS new_redirects,
  (SELECT count(*) FROM "Redirect" WHERE destination LIKE '%khrid-printrhai-jvhrafshan') AS to_inkjet,
  (SELECT count(*) FROM "LandingPage" WHERE slug IN ('label-printer','receipt-printer') AND NOT "isIndexable") AS noindexed,
  (SELECT count(*) FROM "Category" WHERE "seoDescription" ~ '^\s*\.') AS dots_left,
  (SELECT count(*) FROM "ContentTask" WHERE code IN (1,3,4,6,7) AND "blogPostId" IS NOT NULL) AS linked_tasks;

COMMIT;
