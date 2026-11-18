-- خروجی سامانه‌ی مودیان — docs/plans/webhesab-parity.md بخش ۳۰ (همه افزایشی)
ALTER TABLE "AccSettings" ADD COLUMN "sellerBranchCode" TEXT;
ALTER TABLE "AccSettings" ADD COLUMN "moadianSstid" TEXT;
ALTER TABLE "AccSettings" ADD COLUMN "moadianShippingSstid" TEXT;
ALTER TABLE "AccItemGroup" ADD COLUMN "taxCode" TEXT;
ALTER TABLE "AccInvoice" ADD COLUMN "moadianInno" TEXT;
ALTER TABLE "AccInvoice" ADD COLUMN "moadianInty" INTEGER;
ALTER TABLE "AccInvoice" ADD COLUMN "moadianAt" TIMESTAMP(3);
ALTER TABLE "AccInvoice" ADD COLUMN "moadianNote" TEXT;
CREATE UNIQUE INDEX "AccInvoice_moadianInno_key" ON "AccInvoice"("moadianInno");
CREATE INDEX "AccInvoice_taxStatus_idx" ON "AccInvoice"("taxStatus");
