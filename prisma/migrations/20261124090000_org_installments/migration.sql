-- اقساط سازمانی — docs/plans/org-installments.md (افزایشی)
-- CreateEnum
CREATE TYPE "AccOrgContractStatus" AS ENUM ('ACTIVE', 'DONE', 'VOID');

-- AlterEnum
ALTER TYPE "AccMoneyMethod" ADD VALUE 'ORG_INSTALLMENT';

-- AlterTable
ALTER TABLE "AccMoneyItem" ADD COLUMN     "counterPartyId" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "orgInstallment" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "AccPosTicket" ADD COLUMN "orgId" TEXT;

-- CreateTable
CREATE TABLE "AccInstallmentOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 6,
    "commissionBp" INTEGER NOT NULL DEFAULT 0,
    "capPerCustomer" BIGINT,
    "capTotal" BIGINT,
    "minPurchase" BIGINT,
    "firstDueMonths" INTEGER NOT NULL DEFAULT 1,
    "dueDay" INTEGER NOT NULL DEFAULT 1,
    "roundTo" INTEGER NOT NULL DEFAULT 1000,
    "requireRef" BOOLEAN NOT NULL DEFAULT true,
    "contractNo" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "note" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccInstallmentOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccOrgContract" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "orgId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "mobile" TEXT,
    "nationalId" TEXT,
    "employeeCode" TEXT,
    "letterNo" TEXT,
    "invoiceId" TEXT,
    "posTicketId" TEXT,
    "moneyDocId" TEXT NOT NULL,
    "total" BIGINT NOT NULL,
    "commissionBp" INTEGER NOT NULL,
    "commission" BIGINT NOT NULL,
    "net" BIGINT NOT NULL,
    "months" INTEGER NOT NULL,
    "firstDue" DATE NOT NULL,
    "status" "AccOrgContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "note" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccOrgContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccOrgInstallment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "paid" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "AccOrgInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccOrgSettlement" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "moneyDocId" TEXT NOT NULL,
    "note" TEXT,
    "fileName" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "AccOrgSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccOrgSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "AccOrgSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccInstallmentOrg_name_key" ON "AccInstallmentOrg"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccInstallmentOrg_partyId_key" ON "AccInstallmentOrg"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccOrgContract_number_key" ON "AccOrgContract"("number");

-- CreateIndex
CREATE UNIQUE INDEX "AccOrgContract_moneyDocId_key" ON "AccOrgContract"("moneyDocId");

-- CreateIndex
CREATE INDEX "AccOrgContract_orgId_status_idx" ON "AccOrgContract"("orgId", "status");

-- CreateIndex
CREATE INDEX "AccOrgContract_partyId_idx" ON "AccOrgContract"("partyId");

-- CreateIndex
CREATE INDEX "AccOrgInstallment_dueDate_idx" ON "AccOrgInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccOrgInstallment_contractId_seq_key" ON "AccOrgInstallment"("contractId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "AccOrgSettlement_number_key" ON "AccOrgSettlement"("number");

-- CreateIndex
CREATE UNIQUE INDEX "AccOrgSettlement_moneyDocId_key" ON "AccOrgSettlement"("moneyDocId");

-- CreateIndex
CREATE INDEX "AccOrgSettlement_orgId_period_idx" ON "AccOrgSettlement"("orgId", "period");

-- CreateIndex
CREATE INDEX "AccOrgSettlementLine_installmentId_idx" ON "AccOrgSettlementLine"("installmentId");

-- AddForeignKey
ALTER TABLE "AccOrgContract" ADD CONSTRAINT "AccOrgContract_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccInstallmentOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccOrgInstallment" ADD CONSTRAINT "AccOrgInstallment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "AccOrgContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccOrgSettlement" ADD CONSTRAINT "AccOrgSettlement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccInstallmentOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccOrgSettlementLine" ADD CONSTRAINT "AccOrgSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "AccOrgSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccOrgSettlementLine" ADD CONSTRAINT "AccOrgSettlementLine_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "AccOrgInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- حساب «کارمزد فروش اقساطی سازمانی» زیر «هزینه‌های فروش» (۸۱) برای سرفصل‌هایی که هست؛ بقیه هنگام اولین فروش (`ensureOrgFeeAccount`)
INSERT INTO "AccAccount" ("id", "code", "name", "level", "class", "nature", "detailKind", "systemKey", "parentId", "isActive", "createdAt")
SELECT 'acc_org_installment_fee', '8106', 'کارمزد فروش اقساطی سازمانی', 'SUBLEDGER', 'EXPENSE', 'DEBIT', 'NONE', 'ORG_INSTALLMENT_FEE', p."id", true, now()
FROM "AccAccount" p
WHERE p."code" = '81'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'ORG_INSTALLMENT_FEE')
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "code" = '8106');
