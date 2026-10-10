-- تکمیل فاز ۴ تنوع — docs/plans/inventory-items.md. همه افزایشی با پیش‌فرض ثابت.

-- کارت فهرست: «انتخاب» و «از X تومان» برای محصول تنوع‌دار (فقط با کلید روشن پر می‌شود)
ALTER TABLE "Product" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceFrom" BIGINT;

-- «موجود شد خبرم کن» برای یک تنوع. قید تازه پیش از برداشتن قبلی؛ داده‌ی موجود
-- (variantKey = '') زیر قید قبلی یکتا بود، پس زیر این هم هست.
ALTER TABLE "StockAlert" ADD COLUMN     "variantKey" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "StockAlert_productId_variantKey_phone_key" ON "StockAlert"("productId", "variantKey", "phone");
DROP INDEX "StockAlert_productId_phone_key";

-- محصول‌هایی که از ۲.۷۹.۰ تنوع دارند — اگر کلید روشن است همین حالا پر شوند
UPDATE "Product" p SET "hasVariants" = true
WHERE EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive")
  AND EXISTS (SELECT 1 FROM "StoreSettings" s WHERE s."variantsEnabled");
