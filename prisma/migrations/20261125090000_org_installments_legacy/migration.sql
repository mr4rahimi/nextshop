-- اقساط سازمانی: انتقال قراردادهای وب حساب (docs/plans/org-installments.md بخش ۷) — افزایشی
ALTER TABLE "AccInstallmentOrg" ADD COLUMN "selfPay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccInstallmentOrg" ADD COLUMN "legacyVoucherId" TEXT;
CREATE UNIQUE INDEX "AccInstallmentOrg_legacyVoucherId_key" ON "AccInstallmentOrg"("legacyVoucherId");

ALTER TABLE "AccOrgContract" ALTER COLUMN "moneyDocId" DROP NOT NULL;
ALTER TABLE "AccOrgContract" ADD COLUMN "legacyRef" TEXT;
ALTER TABLE "AccOrgContract" ADD COLUMN "legacyOpen" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "AccOrgContract" ADD COLUMN "legacyOpenNet" BIGINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "AccOrgContract_legacyRef_key" ON "AccOrgContract"("legacyRef");

ALTER TABLE "AccOrgInstallment" ADD COLUMN "legacyPaid" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "AccOrgInstallment" ADD COLUMN "legacyPaidAt" DATE;
