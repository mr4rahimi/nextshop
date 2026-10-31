-- قیمت فروشگاه: تغییر گروهی، اکسل و تاریخچه — docs/plans/webhesab-parity.md بخش ۱۰ (افزایشی)
CREATE TABLE "AccPriceBatch" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "undoOfId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccPriceBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccPriceBatch_createdAt_idx" ON "AccPriceBatch"("createdAt");

CREATE TABLE "AccPriceChange" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromPrice" BIGINT NOT NULL,
    "prevRaw" BIGINT,
    "toPrice" BIGINT,
    "source" TEXT NOT NULL,
    "batchId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccPriceChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccPriceChange_createdAt_idx" ON "AccPriceChange"("createdAt");
CREATE INDEX "AccPriceChange_itemId_createdAt_idx" ON "AccPriceChange"("itemId", "createdAt");
CREATE INDEX "AccPriceChange_batchId_idx" ON "AccPriceChange"("batchId");
ALTER TABLE "AccPriceChange" ADD CONSTRAINT "AccPriceChange_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AccItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccPriceChange" ADD CONSTRAINT "AccPriceChange_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AccPriceBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
