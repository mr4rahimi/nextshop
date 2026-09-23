-- قیمت خرید در سفارش تلفنی و فروش ریفری
-- (docs/features/staff-worklist.md بخش ۲۲.۱۰)
--
-- همه‌ی تغییرها افزودنی‌اند و پیش‌فرض دارند؛ سفارش، معامله و قاعده‌ی موجود
-- دقیقاً همان رفتار قبلی را نگه می‌دارند.

ALTER TABLE "Order" ADD COLUMN "isReferral" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffDeal" ADD COLUMN "isReferral" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffCommissionRule" ADD COLUMN "referral" BOOLEAN NOT NULL DEFAULT false;

-- ⚠️ جدول جدا، نه ستون روی OrderItem — قیمت خرید نباید با ردیف‌های سفارش
-- به مسیرهای مشتری برود.
CREATE TABLE "OrderItemCost" (
  "orderItemId" TEXT NOT NULL,
  "cost"        BIGINT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderItemCost_pkey" PRIMARY KEY ("orderItemId")
);

ALTER TABLE "OrderItemCost"
  ADD CONSTRAINT "OrderItemCost_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
