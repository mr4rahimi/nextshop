-- کش‌بک کارت باشگاه و تعهد اعتبار — webhesab-parity.md بخش ۳۴.۲
ALTER TYPE "AccSource" ADD VALUE 'CLUB';
ALTER TABLE "PointTransaction" ADD COLUMN "availableAt" TIMESTAMP(3), ADD COLUMN "postedAt" TIMESTAMP(3), ADD COLUMN "voucherId" TEXT;
CREATE INDEX "PointTransaction_postedAt_idx" ON "PointTransaction"("postedAt");
ALTER TABLE "StoreSettings" ADD COLUMN "clubChargeOnProfit" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "clubChargeDelayHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "AccSettings" ADD COLUMN "clubLiabilitySince" TIMESTAMP(3);
