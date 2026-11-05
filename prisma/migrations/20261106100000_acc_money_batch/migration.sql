-- دریافت/پرداخت گروهی — docs/plans/webhesab-parity.md بخش ۱۸ (افزایشی)
ALTER TABLE "AccMoneyDoc" ADD COLUMN "batchId" TEXT;
CREATE INDEX "AccMoneyDoc_batchId_idx" ON "AccMoneyDoc"("batchId");
