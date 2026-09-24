-- حسابداری — فاز ۲: هسته‌ی دفتر (docs/plans/accounting.md بخش ۶ و ۲۰)
-- سال مالی، سرفصل، اشخاص، خزانه، سند. همه افزودنی.

-- CreateEnum
CREATE TYPE "AccYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccLevel" AS ENUM ('GROUP', 'LEDGER', 'SUBLEDGER');

-- CreateEnum
CREATE TYPE "AccNature" AS ENUM ('DEBIT', 'CREDIT', 'BOTH');

-- CreateEnum
CREATE TYPE "AccClass" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccDetailKind" AS ENUM ('NONE', 'PARTY', 'TREASURY');

-- CreateEnum
CREATE TYPE "AccPersonType" AS ENUM ('REAL', 'LEGAL');

-- CreateEnum
CREATE TYPE "AccTreasuryKind" AS ENUM ('CASH', 'BANK', 'POS', 'GATEWAY');

-- CreateEnum
CREATE TYPE "AccVoucherStatus" AS ENUM ('POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "AccSource" AS ENUM ('MANUAL', 'SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_RETURN', 'PURCHASE_RETURN', 'RECEIPT', 'PAYMENT', 'EXPENSE', 'TRANSFER', 'CHEQUE', 'INVENTORY', 'PAYOUT', 'OPENING', 'CLOSING', 'IMPORT');

-- AlterTable
ALTER TABLE "AccSettings" ADD COLUMN     "currentYearId" TEXT,
ADD COLUMN     "invoiceFooterNote" TEXT,
ADD COLUMN     "lockDate" DATE,
ADD COLUMN     "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellerAddress" TEXT,
ADD COLUMN     "sellerEconomicCode" TEXT,
ADD COLUMN     "sellerName" TEXT,
ADD COLUMN     "sellerNationalId" TEXT,
ADD COLUMN     "sellerPhone" TEXT,
ADD COLUMN     "sellerPostalCode" TEXT,
ADD COLUMN     "sellerRegNo" TEXT,
ADD COLUMN     "signatureImage" TEXT,
ADD COLUMN     "stampImage" TEXT,
ADD COLUMN     "vatRateBp" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "AccFiscalYear" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "AccYearStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccFiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccSequence" (
    "yearId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AccSequence_pkey" PRIMARY KEY ("yearId","key")
);

-- CreateTable
CREATE TABLE "AccAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "AccLevel" NOT NULL,
    "parentId" TEXT,
    "class" "AccClass" NOT NULL,
    "nature" "AccNature" NOT NULL,
    "detailKind" "AccDetailKind" NOT NULL DEFAULT 'NONE',
    "systemKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hesabanId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccParty" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "personType" "AccPersonType" NOT NULL DEFAULT 'REAL',
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "nationalId" TEXT,
    "economicCode" TEXT,
    "regNo" TEXT,
    "mobile" TEXT,
    "phone" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "city" TEXT,
    "isCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "isEmployee" BOOLEAN NOT NULL DEFAULT false,
    "isMarketplace" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" BIGINT,
    "userId" TEXT,
    "supplierId" TEXT,
    "platformCode" TEXT,
    "hesabanId" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccTreasury" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "kind" "AccTreasuryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNo" TEXT,
    "sheba" TEXT,
    "cardNo" TEXT,
    "settleToId" TEXT,
    "providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hesabanId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccTreasury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccVoucher" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AccVoucherStatus" NOT NULL DEFAULT 'POSTED',
    "source" "AccSource" NOT NULL,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "totalDebit" BIGINT NOT NULL,
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccVoucherLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "partyId" TEXT,
    "treasuryId" TEXT,
    "debit" BIGINT NOT NULL DEFAULT 0,
    "credit" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "date" DATE NOT NULL,
    "yearId" TEXT NOT NULL,
    "isVoid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AccVoucherLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccFiscalYear_startDate_key" ON "AccFiscalYear"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccAccount_code_key" ON "AccAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccAccount_systemKey_key" ON "AccAccount"("systemKey");

-- CreateIndex
CREATE INDEX "AccAccount_parentId_idx" ON "AccAccount"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AccParty_code_key" ON "AccParty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccParty_userId_key" ON "AccParty"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccParty_supplierId_key" ON "AccParty"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "AccParty_platformCode_key" ON "AccParty"("platformCode");

-- CreateIndex
CREATE INDEX "AccParty_mobile_idx" ON "AccParty"("mobile");

-- CreateIndex
CREATE INDEX "AccParty_name_idx" ON "AccParty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccTreasury_code_key" ON "AccTreasury"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccVoucher_reversalOfId_key" ON "AccVoucher"("reversalOfId");

-- CreateIndex
CREATE INDEX "AccVoucher_source_sourceId_idx" ON "AccVoucher"("source", "sourceId");

-- CreateIndex
CREATE INDEX "AccVoucher_date_idx" ON "AccVoucher"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AccVoucher_yearId_number_key" ON "AccVoucher"("yearId", "number");

-- CreateIndex
CREATE INDEX "AccVoucherLine_voucherId_idx" ON "AccVoucherLine"("voucherId");

-- CreateIndex
CREATE INDEX "AccVoucherLine_accountId_date_idx" ON "AccVoucherLine"("accountId", "date");

-- CreateIndex
CREATE INDEX "AccVoucherLine_partyId_date_idx" ON "AccVoucherLine"("partyId", "date");

-- CreateIndex
CREATE INDEX "AccVoucherLine_treasuryId_date_idx" ON "AccVoucherLine"("treasuryId", "date");

-- CreateIndex
CREATE INDEX "AccVoucherLine_yearId_isVoid_idx" ON "AccVoucherLine"("yearId", "isVoid");

-- AddForeignKey
ALTER TABLE "AccAccount" ADD CONSTRAINT "AccAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccVoucher" ADD CONSTRAINT "AccVoucher_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AccFiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccVoucherLine" ADD CONSTRAINT "AccVoucherLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "AccVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccVoucherLine" ADD CONSTRAINT "AccVoucherLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccVoucherLine" ADD CONSTRAINT "AccVoucherLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccVoucherLine" ADD CONSTRAINT "AccVoucherLine_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "AccTreasury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

