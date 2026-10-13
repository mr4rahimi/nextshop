-- برگشت دقیق apply-fixes.sql (۱۴۰۵/۰۷/۲۱)
-- اجرا: ssh root@185.164.73.224 "sudo -u postgres psql -d mahamprinter_db -v ON_ERROR_STOP=1" < rollback-fixes.sql
-- توضیحات دسته‌ها جدا برمی‌گردد (فایلی که apply روی سرور ساخت):
--   ssh root@185.164.73.224 "sudo -u postgres psql -d mahamprinter_db -f /root/backups/mahamprint-seo-20261013/category-desc-rollback.sql"

BEGIN;

UPDATE "Redirect" SET destination = 'https://mahamprint.com/mag/Digital-Signature-Pad-Usage-Selection-and-Setup', "updatedAt" = now()
WHERE source = '/mag/انواع-قلم-نوری';
UPDATE "Redirect" SET destination = 'https://mahamprint.com/mag/the-best-color-printer', "updatedAt" = now()
WHERE source = '/mag/تست-پرینت-سیاه-سفید-و-رنگی';

DELETE FROM "Redirect" WHERE id IN ('seo1013r0001','seo1013r0002','seo1013r0003','seo1013r0004','seo1013r0005');
UPDATE "Redirect" SET destination = 'https://mahamprint.com/collections/khrid-printrhai-johrafshan',
  note = replace(note, ' | سئو ۱۴۰۵/۰۷/۲۱: مقصد از johrafshan عوض شد', ''), "updatedAt" = now()
WHERE note LIKE '%سئو ۱۴۰۵/۰۷/۲۱: مقصد از johrafshan عوض شد%';

UPDATE "LandingPage" SET "isIndexable" = true, "updatedAt" = now() WHERE slug IN ('label-printer','receipt-printer');
UPDATE "LandingPage" SET "isActive" = true, "updatedAt" = now() WHERE slug IN ('khrid-printrhai-svzni','khrid-printrhai-johrafshan');
UPDATE "LandingPage" SET filters = jsonb_set(filters::jsonb, '{brand}', '"hp"')::json, "updatedAt" = now()
WHERE slug = 'printr-lizri-chharkarh-canon';

-- کارهای محتوا: فقط اگر هنوز در همان وضعیت‌اند (بعد از «در حال انتشار» برگشت معنی ندارد)
UPDATE "ContentTask" t SET "blogPostId" = NULL, "updatedAt" = now()
WHERE code IN (1,3,4,6,7) AND status IN ('ASSIGNED','WRITING')
  AND EXISTS (SELECT 1 FROM "ContentTaskEvent" e WHERE e."taskId" = t.id AND e.id LIKE 'seo1013e%');
DELETE FROM "ContentTaskEvent" WHERE id LIKE 'seo1013e%';

COMMIT;
