-- چند کارتخوان و کارت به کارت در صندوق — docs/plans/inventory-items.md بخش ۱۳.۱ (افزایشی)
ALTER TABLE "AccPosTerminal" ADD COLUMN "moreCardTreasuryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AccPosTerminal" ADD COLUMN "transferTreasuryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AccPosTicket" ADD COLUMN "cardTreasuryId" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "transfer" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "AccPosTicket" ADD COLUMN "transferTreasuryId" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "transferRef" TEXT;
-- رسیدهای قبلی: کارتخوان همان پیشخوان
UPDATE "AccPosTicket" t SET "cardTreasuryId" = p."cardTreasuryId" FROM "AccPosTerminal" p WHERE t."terminalId" = p."id" AND t."card" <> 0;
