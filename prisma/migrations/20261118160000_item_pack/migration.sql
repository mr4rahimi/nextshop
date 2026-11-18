-- واحد بسته‌ی کالا (کارتن = ۱۲ عدد) — docs/plans/webhesab-parity.md بخش ۲۹ (همه افزایشی)
ALTER TABLE "AccItem" ADD COLUMN "packUnit" TEXT;
ALTER TABLE "AccItem" ADD COLUMN "packSize" INTEGER;
ALTER TABLE "AccInvoiceLine" ADD COLUMN "packSize" INTEGER;
ALTER TABLE "AccPurchaseOrderLine" ADD COLUMN "packSize" INTEGER;
