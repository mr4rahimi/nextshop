-- حسابداری — فاز ۱۰: فروش و خرید اقساطی، درآمد متفرقه، بن و تهاتر، صدور گروهی
-- (docs/plans/accounting.md بخش ۹.۳ و ۲۰). همه افزودنی.
-- ⚠️ مقدارهای تازه‌ی enum در همین مهاجرت به کار نمی‌روند (تله‌ی ۲۳).

-- CreateEnum
CREATE TYPE "AccFeeMode" AS ENUM ('NONE', 'MONTHLY', 'TOTAL', 'FIXED');

-- AlterEnum
ALTER TYPE "StaffNotificationType" ADD VALUE 'ACC_INSTALLMENT';

-- AlterEnum
ALTER TYPE "AccSource" ADD VALUE 'INCOME';
ALTER TYPE "AccSource" ADD VALUE 'INSTALLMENT';

-- AlterEnum
ALTER TYPE "AccMoneyKind" ADD VALUE 'INCOME';

-- AlterEnum
ALTER TYPE "AccMoneyMethod" ADD VALUE 'GIFT_CARD';
ALTER TYPE "AccMoneyMethod" ADD VALUE 'OFFSET';

-- AlterTable
ALTER TABLE "AccInvoice" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "AccInstallmentPlan" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "downPayment" BIGINT NOT NULL DEFAULT 0,
    "principal" BIGINT NOT NULL,
    "feeMode" "AccFeeMode" NOT NULL DEFAULT 'NONE',
    "feeRateBp" INTEGER NOT NULL DEFAULT 0,
    "feeAmount" BIGINT NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "voucherId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccInstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "chequeId" TEXT,
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "AccInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccInstallmentPlan_invoiceId_key" ON "AccInstallmentPlan"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccInstallmentPlan_voucherId_key" ON "AccInstallmentPlan"("voucherId");

-- CreateIndex
CREATE INDEX "AccInstallmentPlan_partyId_idx" ON "AccInstallmentPlan"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccInstallment_chequeId_key" ON "AccInstallment"("chequeId");

-- CreateIndex
CREATE INDEX "AccInstallment_dueDate_idx" ON "AccInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccInstallment_planId_seq_key" ON "AccInstallment"("planId", "seq");

-- CreateIndex
CREATE INDEX "AccInvoice_batchId_idx" ON "AccInvoice"("batchId");

-- AddForeignKey
ALTER TABLE "AccInstallmentPlan" ADD CONSTRAINT "AccInstallmentPlan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AccInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccInstallmentPlan" ADD CONSTRAINT "AccInstallmentPlan_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccInstallment" ADD CONSTRAINT "AccInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AccInstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- سرفصل: «درآمد فروش اقساطی» و «کارمزد خرید اقساطی» — فقط اگر سرفصل ساخته شده
-- و کلید/کد هنوز نیست (سایت‌های بی‌حسابداری داخلی دست نمی‌خورند؛
-- `seedDefaultChart` هنگام راه‌اندازی خودش می‌سازد)
INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_installment_income', '6205', 'درآمد فروش اقساطی', 'SUBLEDGER', p."id", 'REVENUE', 'CREDIT', 'NONE', 'INSTALLMENT_INCOME'
FROM "AccAccount" p
WHERE p."code" = '62'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'INSTALLMENT_INCOME' OR "code" = '6205');

INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_installment_expense', '8302', 'کارمزد خرید اقساطی', 'SUBLEDGER', p."id", 'EXPENSE', 'DEBIT', 'NONE', 'INSTALLMENT_EXPENSE'
FROM "AccAccount" p
WHERE p."code" = '83'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'INSTALLMENT_EXPENSE' OR "code" = '8302');
