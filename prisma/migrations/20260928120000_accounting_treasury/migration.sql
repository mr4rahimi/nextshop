-- حسابداری — فاز ۵: دریافت، پرداخت، انتقال، تخصیص به فاکتور، چک و دسته‌چک
-- (docs/plans/accounting.md بخش ۶.۷، ۶.۸ و ۹). همه افزودنی.

-- CreateEnum
CREATE TYPE "AccMoneyKind" AS ENUM ('RECEIPT', 'PAYMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "AccMoneyMethod" AS ENUM ('CASH', 'CARD_TRANSFER', 'BANK_TRANSFER', 'POS', 'GATEWAY', 'CHEQUE');

-- CreateEnum
CREATE TYPE "AccChequeDir" AS ENUM ('RECEIVED', 'ISSUED');

-- CreateEnum
CREATE TYPE "AccChequeStatus" AS ENUM ('IN_HAND', 'IN_COLLECTION', 'CLEARED', 'BOUNCED', 'ENDORSED', 'RETURNED', 'ISSUED');

-- AlterEnum
ALTER TYPE "StaffNotificationType" ADD VALUE 'ACC_CHEQUE';

-- CreateTable
CREATE TABLE "AccMoneyDoc" (
    "id" TEXT NOT NULL,
    "kind" "AccMoneyKind" NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "partyId" TEXT,
    "total" BIGINT NOT NULL,
    "description" TEXT,
    "status" "AccDocStatus" NOT NULL DEFAULT 'POSTED',
    "voucherId" TEXT,
    "voidReason" TEXT,
    "paymentId" TEXT,
    "sourceKey" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccMoneyDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccMoneyItem" (
    "id" TEXT NOT NULL,
    "moneyDocId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "method" "AccMoneyMethod" NOT NULL,
    "treasuryId" TEXT,
    "toTreasuryId" TEXT,
    "chequeId" TEXT,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "trackingCode" TEXT,

    CONSTRAINT "AccMoneyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccAllocation" (
    "id" TEXT NOT NULL,
    "moneyDocId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "AccAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccCheque" (
    "id" TEXT NOT NULL,
    "direction" "AccChequeDir" NOT NULL,
    "status" "AccChequeStatus" NOT NULL,
    "serialNo" TEXT NOT NULL,
    "sayadId" TEXT,
    "sayadRegistered" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT NOT NULL,
    "branch" TEXT,
    "ownerName" TEXT,
    "amount" BIGINT NOT NULL,
    "issueDate" DATE,
    "dueDate" DATE NOT NULL,
    "partyId" TEXT NOT NULL,
    "holderPartyId" TEXT,
    "treasuryId" TEXT,
    "chequeBookId" TEXT,
    "moneyDocId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "followUpTaskId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccCheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccChequeEvent" (
    "id" TEXT NOT NULL,
    "chequeId" TEXT NOT NULL,
    "from" "AccChequeStatus",
    "to" "AccChequeStatus" NOT NULL,
    "date" DATE NOT NULL,
    "voucherId" TEXT,
    "partyId" TEXT,
    "treasuryId" TEXT,
    "moneyDocId" TEXT,
    "note" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccChequeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccChequeBook" (
    "id" TEXT NOT NULL,
    "treasuryId" TEXT NOT NULL,
    "fromSerial" TEXT NOT NULL,
    "toSerial" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccChequeBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccMoneyDoc_voucherId_key" ON "AccMoneyDoc"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "AccMoneyDoc_paymentId_key" ON "AccMoneyDoc"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AccMoneyDoc_sourceKey_key" ON "AccMoneyDoc"("sourceKey");

-- CreateIndex
CREATE INDEX "AccMoneyDoc_partyId_date_idx" ON "AccMoneyDoc"("partyId", "date");

-- CreateIndex
CREATE INDEX "AccMoneyDoc_kind_date_idx" ON "AccMoneyDoc"("kind", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AccMoneyDoc_yearId_kind_number_key" ON "AccMoneyDoc"("yearId", "kind", "number");

-- CreateIndex
CREATE INDEX "AccMoneyItem_moneyDocId_idx" ON "AccMoneyItem"("moneyDocId");

-- CreateIndex
CREATE INDEX "AccMoneyItem_chequeId_idx" ON "AccMoneyItem"("chequeId");

-- CreateIndex
CREATE INDEX "AccAllocation_invoiceId_idx" ON "AccAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccAllocation_moneyDocId_invoiceId_key" ON "AccAllocation"("moneyDocId", "invoiceId");

-- CreateIndex
CREATE INDEX "AccCheque_direction_status_dueDate_idx" ON "AccCheque"("direction", "status", "dueDate");

-- CreateIndex
CREATE INDEX "AccCheque_partyId_idx" ON "AccCheque"("partyId");

-- CreateIndex
CREATE INDEX "AccCheque_moneyDocId_idx" ON "AccCheque"("moneyDocId");

-- CreateIndex
CREATE UNIQUE INDEX "AccChequeEvent_voucherId_key" ON "AccChequeEvent"("voucherId");

-- CreateIndex
CREATE INDEX "AccChequeEvent_chequeId_createdAt_idx" ON "AccChequeEvent"("chequeId", "createdAt");

-- CreateIndex
CREATE INDEX "AccChequeBook_treasuryId_idx" ON "AccChequeBook"("treasuryId");

-- AddForeignKey
ALTER TABLE "AccMoneyDoc" ADD CONSTRAINT "AccMoneyDoc_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccMoneyItem" ADD CONSTRAINT "AccMoneyItem_moneyDocId_fkey" FOREIGN KEY ("moneyDocId") REFERENCES "AccMoneyDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccAllocation" ADD CONSTRAINT "AccAllocation_moneyDocId_fkey" FOREIGN KEY ("moneyDocId") REFERENCES "AccMoneyDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccAllocation" ADD CONSTRAINT "AccAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AccInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccCheque" ADD CONSTRAINT "AccCheque_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccChequeEvent" ADD CONSTRAINT "AccChequeEvent_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "AccCheque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

