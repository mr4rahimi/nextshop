-- روشن کردن «محصولات مرتبط» (هم‌دسته + هم‌برند) روی همه‌ی محصولات مهام پرینت
-- چرا: پیش‌فرض {} یعنی خاموش؛ ۲۸۰۴ از ۲۸۰۵ محصول در HTML هیچ لینکی به محصول دیگر ندارند
-- و صفحه‌ی محصول برای گوگل بن‌بست است. (ممیزی ۱۴۰۵/۰۷/۰۷ — docs/audits/mahamprint/2026-09/)
-- بکاپ: /root/backups/mahamprint-seo-20260929/  (جدول Product را قبل از اجرا جدا dump کنید)
BEGIN;
UPDATE "Product"
   SET "relatedSettings" = '{"categoryEnabled": true, "categorySort": "newest", "brandEnabled": true, "brandSort": "newest"}'::jsonb,
       "updatedAt" = now()
 WHERE "isActive"
   AND coalesce(("relatedSettings"->>'categoryEnabled')::boolean, false) = false
   AND coalesce(("relatedSettings"->>'brandEnabled')::boolean, false) = false;
SELECT count(*) FILTER (WHERE ("relatedSettings"->>'categoryEnabled')::boolean) AS enabled, count(*) AS total FROM "Product" WHERE "isActive";
COMMIT;
