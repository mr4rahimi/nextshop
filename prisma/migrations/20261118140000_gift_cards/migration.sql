-- بن کارت فروشگاه — docs/plans/webhesab-parity.md بخش ۲۷ (همه افزایشی)
ALTER TYPE "AccSource" ADD VALUE 'GIFT';
ALTER TYPE "AccMoneyMethod" ADD VALUE 'STORE_GIFT';

CREATE TYPE "AccGiftStatus" AS ENUM ('ACTIVE', 'CLOSED', 'RETURNED');
CREATE TYPE "AccGiftTxKind" AS ENUM ('ISSUE', 'SPEND', 'RESTORE', 'RETURN', 'FORFEIT');

ALTER TABLE "AccPosTicket" ADD COLUMN "giftSpent" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "AccPosTicket" ADD COLUMN "giftRestored" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "AccGiftCard" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "batch" TEXT,
    "amount" BIGINT NOT NULL,
    "balance" BIGINT NOT NULL,
    "saleDiscount" BIGINT NOT NULL DEFAULT 0,
    "minInvoice" BIGINT NOT NULL DEFAULT 0,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATE,
    "status" "AccGiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "buyerPartyId" TEXT,
    "issueVoucherId" TEXT,
    "note" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "AccGiftCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccGiftCard_number_key" ON "AccGiftCard"("number");
CREATE INDEX "AccGiftCard_batch_idx" ON "AccGiftCard"("batch");
CREATE INDEX "AccGiftCard_buyerPartyId_idx" ON "AccGiftCard"("buyerPartyId");
CREATE INDEX "AccGiftCard_status_expiresAt_idx" ON "AccGiftCard"("status", "expiresAt");
ALTER TABLE "AccGiftCard" ADD CONSTRAINT "AccGiftCard_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "AccParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AccGiftTx" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "kind" "AccGiftTxKind" NOT NULL,
    "amount" BIGINT NOT NULL,
    "ticketId" TEXT,
    "voucherId" TEXT,
    "note" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccGiftTx_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccGiftTx_cardId_createdAt_idx" ON "AccGiftTx"("cardId", "createdAt");
CREATE INDEX "AccGiftTx_ticketId_idx" ON "AccGiftTx"("ticketId");
ALTER TABLE "AccGiftTx" ADD CONSTRAINT "AccGiftTx_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "AccGiftCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- حساب «بن کارت فروخته‌شده» زیر «پیش‌دریافت‌ها» (۳۳) برای سرفصل‌هایی که هست؛ بقیه هنگام اولین صدور (`ensureGiftAccount`)
INSERT INTO "AccAccount" ("id", "code", "name", "level", "class", "nature", "detailKind", "systemKey", "parentId", "isActive", "createdAt")
SELECT 'acc_gift_liability', '3303', 'بن کارت فروخته‌شده', 'SUBLEDGER', 'LIABILITY', 'CREDIT', 'NONE', 'GIFT_LIABILITY', p."id", true, now()
FROM "AccAccount" p
WHERE p."code" = '33'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'GIFT_LIABILITY')
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "code" = '3303');
