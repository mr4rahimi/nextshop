-- سفارش فروش — docs/plans/webhesab-parity.md بخش ۳۱ (افزایشی)
-- همان جدول سفارش خرید با «نوع»؛ سفارش‌های موجود همه خریدند.
ALTER TABLE "AccPurchaseOrder" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PURCHASE';
CREATE INDEX "AccPurchaseOrder_kind_status_date_idx" ON "AccPurchaseOrder"("kind", "status", "date");
-- شماره یکتا در هر نوع، نه سراسری
DROP INDEX "AccPurchaseOrder_number_key";
CREATE UNIQUE INDEX "AccPurchaseOrder_kind_number_key" ON "AccPurchaseOrder"("kind", "number");
