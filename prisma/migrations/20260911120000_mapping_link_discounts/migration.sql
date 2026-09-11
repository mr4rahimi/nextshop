-- تخفیف تحت مدیریت پنل، به ازای هر (نگاشت، پلتفرم)
ALTER TABLE "IntegMappingLink"
  ADD COLUMN "discountManaged"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discountPercent"   DOUBLE PRECISION,
  ADD COLUMN "discountStartsAt"  TIMESTAMP(3),
  ADD COLUMN "discountEndsAt"    TIMESTAMP(3),
  ADD COLUMN "discountStock"     INTEGER,
  ADD COLUMN "discountPushedAt"  TIMESTAMP(3),
  ADD COLUMN "discountPushError" TEXT;
