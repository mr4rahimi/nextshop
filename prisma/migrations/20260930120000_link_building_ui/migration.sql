-- لینک‌سازی فازهای ۴ تا ۷ — ستون‌هایی که رابط کاربریِ الگوبرداری‌شده از برتر لازم دارد.
-- همه افزودنی‌اند؛ هیچ ستونی حذف یا تغییرنام نمی‌شود.
-- مستندات: docs/plans/seo-marketing.md بخش ۱۰.۹

-- ممیزی کمپین و صفحه‌ی هدف جدا از گره
ALTER TYPE "ActivityEntity" ADD VALUE 'LINK_CAMPAIGN';

-- AlterTable
ALTER TABLE "LinkNode" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "returnCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LinkTarget" ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "LinkType" ADD COLUMN     "defaultFollow" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "LinkEdge_fromNodeId_toNodeId_key" ON "LinkEdge"("fromNodeId", "toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkEdge_fromNodeId_toTargetId_key" ON "LinkEdge"("fromNodeId", "toTargetId");


-- پیش‌فرض نوفالوِ انواع سیدشده — همان چهار نوعی که در برتر نوفالو می‌آیند.
-- فقط پیش‌فرض فرم است؛ گره‌های موجود دست نمی‌خورند.
UPDATE "LinkType" SET "defaultFollow" = false
WHERE "key" IN ('COMMENT', 'SOCIAL', 'WIKI', 'BANNER');
