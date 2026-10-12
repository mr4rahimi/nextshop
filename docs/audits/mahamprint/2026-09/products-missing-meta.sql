-- فهرست محصولات فعال بدون عنوان سئو یا بدون توضیحات متا (کار سئوی «متای محصولات بدون متا»)
-- فقط خواندنی است. اولویت: پرینتر، اسکنر، لیبل پرینتر؛ بعد بقیه.
-- اجرا (خروجی CSV روی لپ‌تاپ):
--   ssh root@185.164.73.224 "sudo -u postgres psql -d mahamprinter_db -A -F, -P footer=off" \
--     < docs/audits/mahamprint/2026-09/products-missing-meta.sql > products-missing-meta.csv
-- همین فهرست در پنل هم هست: محصولات ← «بدون عنوان سئو» / «بدون توضیحات متا» (+ فیلتر دسته)
SELECT
  CASE
    WHEN c.title ILIKE '%لیبل%' OR pc.title ILIKE '%لیبل%' THEN '3 لیبل پرینتر'
    WHEN c.title ILIKE '%اسکنر%' OR pc.title ILIKE '%اسکنر%' THEN '2 اسکنر'
    WHEN c.title ILIKE '%پرینتر%' OR pc.title ILIKE '%پرینتر%' THEN '1 پرینتر'
    ELSE '4 سایر'
  END                                                        AS "اولویت",
  c.title                                                    AS "دسته",
  b.title                                                    AS "برند",
  p.title                                                    AS "محصول",
  CASE WHEN coalesce(trim(p."seoTitle"), '') = '' THEN 'ندارد' ELSE 'دارد' END       AS "عنوان سئو",
  CASE WHEN coalesce(trim(p."seoDescription"), '') = '' THEN 'ندارد' ELSE 'دارد' END AS "توضیحات متا",
  'https://mahamprint.com/admin/products/' || p.id           AS "ویرایش",
  'https://mahamprint.com/products/' || p.slug               AS "صفحه"
FROM "Product" p
JOIN "Category" c       ON c.id = p."categoryId"
LEFT JOIN "Category" pc ON pc.id = c."parentId"
LEFT JOIN "Brand" b     ON b.id = p."brandId"
WHERE p."isActive"
  AND (coalesce(trim(p."seoTitle"), '') = '' OR coalesce(trim(p."seoDescription"), '') = '')
ORDER BY 1, c.title, p.title;
