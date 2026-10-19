-- قیمت آنلاین از قیمت فروشگاه (۲.۹۶.۰) — docs/plans/inventory-items.md بخش ۱۴. همه افزایشی؛ پیش‌فرض خاموش.
-- AlterTable
ALTER TABLE "AccSettings" ADD COLUMN     "onlinePctBp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onlinePricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineRoundMode" TEXT NOT NULL DEFAULT 'nearest',
ADD COLUMN     "onlineRoundTo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AccItem" ADD COLUMN     "onlinePrice" BIGINT;

-- AlterTable
ALTER TABLE "AccItemGroup" ADD COLUMN     "onlinePctBp" INTEGER;

