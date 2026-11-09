-- وام و تسهیلات — docs/plans/webhesab-parity.md بخش ۲۱ (افزایشی)
ALTER TYPE "AccSource" ADD VALUE 'LOAN';
CREATE TYPE "AccLoanStatus" AS ENUM ('ACTIVE', 'SETTLED', 'VOID');

CREATE TABLE "AccLoan" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "treasuryId" TEXT,
    "date" DATE NOT NULL,
    "principal" BIGINT NOT NULL,
    "upfrontFee" BIGINT NOT NULL DEFAULT 0,
    "rateBp" INTEGER NOT NULL DEFAULT 0,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "status" "AccLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "voucherId" TEXT,
    "voidReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccLoan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccLoan_number_key" ON "AccLoan"("number");
CREATE UNIQUE INDEX "AccLoan_voucherId_key" ON "AccLoan"("voucherId");
CREATE INDEX "AccLoan_status_idx" ON "AccLoan"("status");

CREATE TABLE "AccLoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principal" BIGINT NOT NULL,
    "interest" BIGINT NOT NULL DEFAULT 0,
    "paidAt" DATE,
    "penalty" BIGINT NOT NULL DEFAULT 0,
    "treasuryId" TEXT,
    "voucherId" TEXT,
    "paidByName" TEXT,
    CONSTRAINT "AccLoanInstallment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccLoanInstallment_voucherId_key" ON "AccLoanInstallment"("voucherId");
CREATE UNIQUE INDEX "AccLoanInstallment_loanId_seq_key" ON "AccLoanInstallment"("loanId", "seq");
CREATE INDEX "AccLoanInstallment_dueDate_idx" ON "AccLoanInstallment"("dueDate");

ALTER TABLE "AccLoan" ADD CONSTRAINT "AccLoan_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "AccTreasury"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccLoanInstallment" ADD CONSTRAINT "AccLoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "AccLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccLoanInstallment" ADD CONSTRAINT "AccLoanInstallment_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "AccTreasury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- سرفصل: فقط اگر سرفصل ساخته شده و کلید/کد هنوز نیست (seedDefaultChart هنگام راه‌اندازی خودش می‌سازد)
INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_loans_ledger', '34', 'تسهیلات مالی', 'LEDGER', p."id", 'LIABILITY', 'CREDIT', 'NONE', NULL
FROM "AccAccount" p
WHERE p."code" = '3'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "code" = '34');

INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_loan_payable', '3401', 'تسهیلات دریافتی', 'SUBLEDGER', p."id", 'LIABILITY', 'CREDIT', 'NONE', 'LOAN_PAYABLE'
FROM "AccAccount" p
WHERE p."code" = '34'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'LOAN_PAYABLE' OR "code" = '3401');

INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_loan_interest', '8303', 'سود و جریمه‌ی تسهیلات', 'SUBLEDGER', p."id", 'EXPENSE', 'DEBIT', 'NONE', 'LOAN_INTEREST'
FROM "AccAccount" p
WHERE p."code" = '83'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'LOAN_INTEREST' OR "code" = '8303');
