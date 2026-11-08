-- ورودی سریع (سند الگو) — docs/plans/webhesab-parity.md بخش ۱۹ (افزایشی)
CREATE TYPE "AccTemplateSide" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AccTemplateAmount" AS ENUM ('BASE', 'PERCENT', 'FIXED', 'ASK', 'REMAINDER');

CREATE TABLE "AccVoucherTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseLabel" TEXT NOT NULL DEFAULT 'مبلغ',
    "baseAmount" BIGINT NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccVoucherTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccVoucherTemplate_name_key" ON "AccVoucherTemplate"("name");

CREATE TABLE "AccVoucherTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "side" "AccTemplateSide" NOT NULL,
    "kind" "AccTemplateAmount" NOT NULL,
    "percentBps" INTEGER,
    "fixedAmount" BIGINT,
    "partyId" TEXT,
    "treasuryId" TEXT,
    "description" TEXT,
    CONSTRAINT "AccVoucherTemplateLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccVoucherTemplateLine_templateId_idx" ON "AccVoucherTemplateLine"("templateId");
CREATE INDEX "AccVoucherTemplateLine_partyId_idx" ON "AccVoucherTemplateLine"("partyId");

ALTER TABLE "AccVoucherTemplateLine" ADD CONSTRAINT "AccVoucherTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AccVoucherTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccVoucherTemplateLine" ADD CONSTRAINT "AccVoucherTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccVoucherTemplateLine" ADD CONSTRAINT "AccVoucherTemplateLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccVoucherTemplateLine" ADD CONSTRAINT "AccVoucherTemplateLine_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "AccTreasury"("id") ON DELETE SET NULL ON UPDATE CASCADE;
