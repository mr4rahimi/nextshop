-- مکان قرارگیری کالا — docs/plans/webhesab-parity.md بخش ۱۱ (افزایشی)
CREATE TABLE "AccItemPlace" (
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zone" TEXT,
    "aisle" TEXT,
    "shelf" TEXT,
    "level" TEXT,
    "updatedByName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccItemPlace_pkey" PRIMARY KEY ("itemId","warehouseId")
);
CREATE INDEX "AccItemPlace_warehouseId_zone_aisle_shelf_level_idx" ON "AccItemPlace"("warehouseId", "zone", "aisle", "shelf", "level");
ALTER TABLE "AccItemPlace" ADD CONSTRAINT "AccItemPlace_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AccItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccItemPlace" ADD CONSTRAINT "AccItemPlace_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "AccWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
