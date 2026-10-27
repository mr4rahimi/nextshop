-- حواله‌ی دو مرحله‌ای — docs/plans/webhesab-parity.md بخش ۸ (افزایشی؛ حواله‌های قبلی یک‌مرحله‌ای می‌مانند)
ALTER TABLE "AccWarehouse" ADD COLUMN "receiveConfirm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccTransfer" ADD COLUMN "needsReceipt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccTransfer" ADD COLUMN "receivedAt" TIMESTAMP(3);
ALTER TABLE "AccTransfer" ADD COLUMN "receiveDate" DATE;
ALTER TABLE "AccTransfer" ADD COLUMN "receivedByName" TEXT;
ALTER TABLE "AccTransfer" ADD COLUMN "receiveNote" TEXT;
ALTER TABLE "AccTransfer" ADD COLUMN "shortageMode" TEXT;
ALTER TABLE "AccTransfer" ADD COLUMN "shortageAdjustId" TEXT;
CREATE INDEX "AccTransfer_needsReceipt_receivedAt_idx" ON "AccTransfer"("needsReceipt", "receivedAt");
ALTER TABLE "AccTransferLine" ADD COLUMN "receivedQty" INTEGER;
