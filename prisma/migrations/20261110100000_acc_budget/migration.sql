-- بودجه — docs/plans/webhesab-parity.md بخش ۲۲ (افزایشی)
CREATE TABLE "AccBudget" (
    "yearId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByName" TEXT NOT NULL,
    CONSTRAINT "AccBudget_pkey" PRIMARY KEY ("yearId","accountId","seq")
);
CREATE INDEX "AccBudget_accountId_idx" ON "AccBudget"("accountId");
ALTER TABLE "AccBudget" ADD CONSTRAINT "AccBudget_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AccFiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccBudget" ADD CONSTRAINT "AccBudget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
