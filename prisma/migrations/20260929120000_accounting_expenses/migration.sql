-- حسابداری — فاز ۶: هزینه، کیف پول، اقساط، پورسانت و تسویه‌ی بازارگاه
-- (docs/plans/accounting.md بخش ۵، ۶.۷ و ۲۰). همه افزودنی.
-- ⚠️ مقدارهای تازه‌ی enum در همین مهاجرت به کار نمی‌روند (تله‌ی ۲۳).

-- AlterEnum
ALTER TYPE "AccMoneyKind" ADD VALUE 'EXPENSE';

-- AlterEnum
ALTER TYPE "AccMoneyMethod" ADD VALUE 'WALLET';

-- AlterEnum
ALTER TYPE "AccSource" ADD VALUE 'WALLET';

-- AlterTable
ALTER TABLE "AccMoneyDoc" ADD COLUMN     "payable" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "vatAmount" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AccSettings" ADD COLUMN     "installmentTreasuryId" TEXT,
ADD COLUMN     "payoutTreasuryId" TEXT;

-- CreateTable
CREATE TABLE "AccMoneyLine" (
    "id" TEXT NOT NULL,
    "moneyDocId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT,

    CONSTRAINT "AccMoneyLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccMoneyLine_moneyDocId_idx" ON "AccMoneyLine"("moneyDocId");

-- CreateIndex
CREATE INDEX "AccMoneyLine_accountId_idx" ON "AccMoneyLine"("accountId");

-- AddForeignKey
ALTER TABLE "AccMoneyLine" ADD CONSTRAINT "AccMoneyLine_moneyDocId_fkey" FOREIGN KEY ("moneyDocId") REFERENCES "AccMoneyDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccMoneyLine" ADD CONSTRAINT "AccMoneyLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- سرفصل: «هدیه و جبران به مشتری» برای شارژ هدیه‌ی کیف پول — فقط اگر سرفصل
-- ساخته شده و این کلید/کد هنوز نیست (سایت‌های بی‌حسابداری داخلی دست نمی‌خورند؛
-- `seedDefaultChart` هنگام راه‌اندازی خودش می‌سازد)
INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_customer_reward', '8105', 'هدیه و جبران به مشتری', 'SUBLEDGER', p."id", 'EXPENSE', 'DEBIT', 'NONE', 'CUSTOMER_REWARD'
FROM "AccAccount" p
WHERE p."code" = '81'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'CUSTOMER_REWARD' OR "code" = '8105');
