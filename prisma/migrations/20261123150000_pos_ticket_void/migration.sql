-- ابطال رسید صندوق با تأیید مدیر — docs/plans/inventory-items.md بخش ۱۳.۳ (افزایشی)
ALTER TABLE "AccPosTicket" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "AccPosTicket" ADD COLUMN "voidedByName" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "voidRequestedAt" TIMESTAMP(3);
ALTER TABLE "AccPosTicket" ADD COLUMN "voidRequestedByName" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "voidRequestReason" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "voidRejectNote" TEXT;
CREATE INDEX "AccPosTicket_voidRequestedAt_idx" ON "AccPosTicket"("voidRequestedAt");
