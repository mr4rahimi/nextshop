-- ادغام اشخاص تکراری — docs/plans/webhesab-parity.md بخش ۱۷ (افزایشی)
ALTER TABLE "AccParty" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "AccParty" ADD COLUMN "mergedAt" TIMESTAMP(3);
CREATE INDEX "AccParty_mergedIntoId_idx" ON "AccParty"("mergedIntoId");
