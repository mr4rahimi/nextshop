-- انبارگردانی کامل — docs/plans/inventory-items.md بخش ۱۵ (همه افزایشی)
ALTER TABLE "AccStockCount" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'PARTIAL';
ALTER TABLE "AccStockCount" ADD COLUMN "groupId" TEXT;
ALTER TABLE "AccStockCount" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AccStockCount" ADD COLUMN "applyTo" TEXT NOT NULL DEFAULT 'ADJUST';

ALTER TABLE "AccStockCountLine" ADD COLUMN "bookSnap" INTEGER;
ALTER TABLE "AccStockCountLine" ADD COLUMN "recountQty" INTEGER;
ALTER TABLE "AccStockCountLine" ADD COLUMN "openingDelta" INTEGER;
ALTER TABLE "AccStockCountLine" ADD COLUMN "openingCost" BIGINT;
ALTER TABLE "AccStockCountLine" ADD COLUMN "zone" TEXT;
ALTER TABLE "AccStockCountLine" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AccStockCountEntry" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "qty" INTEGER NOT NULL,
    "zone" TEXT,
    "byName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccStockCountEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccStockCountEntry_countId_createdAt_idx" ON "AccStockCountEntry"("countId", "createdAt");
ALTER TABLE "AccStockCountEntry" ADD CONSTRAINT "AccStockCountEntry_countId_fkey" FOREIGN KEY ("countId") REFERENCES "AccStockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
