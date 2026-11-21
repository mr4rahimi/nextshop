-- پاک‌سازی ریدایرکت‌های کش‌شده در مرورگر — docs/features/redirects.md بخش «کش مرورگر» (افزایشی)
ALTER TABLE "StoreSettings" ADD COLUMN "redirectCachePurgeAt" TIMESTAMP(3);
-- یک بار برای همه‌ی سایت‌ها روشن می‌شود: ریدایرکت‌های دائمی که قبلاً حذف شده‌اند
-- ممکن است هنوز در مرورگر مشتری‌ها مانده باشند. هزینه‌اش فقط یک بار دانلود دوباره‌ی
-- فایل‌های ثابت برای هر بازدیدکننده است.
UPDATE "StoreSettings" SET "redirectCachePurgeAt" = NOW();
