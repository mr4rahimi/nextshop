-- درآمد اقساطی به تناسب زمان — webhesab-parity.md بخش ۳۴.۳
ALTER TABLE "AccInstallmentPlan" ADD COLUMN "deferred" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "feeDate" DATE, ADD COLUMN "recognized" BIGINT NOT NULL DEFAULT 0;
UPDATE "AccInstallmentPlan" p SET "feeDate" = v."date" FROM "AccVoucher" v WHERE v.id = p."voucherId";
ALTER TABLE "AccSettings" ADD COLUMN "installmentAccruedThrough" DATE;
