-- تطبیق حساب بانک — docs/plans/webhesab-parity.md بخش ۲۰ (افزایشی)
CREATE TYPE "AccBankReconStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "AccBankRecon" (
    "id" TEXT NOT NULL,
    "treasuryId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "statementDate" DATE NOT NULL,
    "openingBalance" BIGINT NOT NULL,
    "closingBalance" BIGINT NOT NULL,
    "status" "AccBankReconStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccBankRecon_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccBankRecon_treasuryId_status_idx" ON "AccBankRecon"("treasuryId", "status");
CREATE INDEX "AccBankRecon_treasuryId_statementDate_idx" ON "AccBankRecon"("treasuryId", "statementDate");

CREATE TABLE "AccBankStatementRow" (
    "id" TEXT NOT NULL,
    "reconId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "refNo" TEXT,
    "amount" BIGINT NOT NULL,
    "balance" BIGINT,
    CONSTRAINT "AccBankStatementRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccBankStatementRow_reconId_seq_idx" ON "AccBankStatementRow"("reconId", "seq");

CREATE TABLE "AccBankReconItem" (
    "id" TEXT NOT NULL,
    "reconId" TEXT NOT NULL,
    "voucherLineId" TEXT,
    "statementRowId" TEXT,
    "amount" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "voucherNumber" INTEGER NOT NULL,
    CONSTRAINT "AccBankReconItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccBankReconItem_voucherLineId_key" ON "AccBankReconItem"("voucherLineId");
CREATE INDEX "AccBankReconItem_reconId_idx" ON "AccBankReconItem"("reconId");
CREATE INDEX "AccBankReconItem_statementRowId_idx" ON "AccBankReconItem"("statementRowId");

ALTER TABLE "AccBankRecon" ADD CONSTRAINT "AccBankRecon_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "AccTreasury"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccBankStatementRow" ADD CONSTRAINT "AccBankStatementRow_reconId_fkey" FOREIGN KEY ("reconId") REFERENCES "AccBankRecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccBankReconItem" ADD CONSTRAINT "AccBankReconItem_reconId_fkey" FOREIGN KEY ("reconId") REFERENCES "AccBankRecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccBankReconItem" ADD CONSTRAINT "AccBankReconItem_voucherLineId_fkey" FOREIGN KEY ("voucherLineId") REFERENCES "AccVoucherLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccBankReconItem" ADD CONSTRAINT "AccBankReconItem_statementRowId_fkey" FOREIGN KEY ("statementRowId") REFERENCES "AccBankStatementRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
