-- ورود و خروج دستی کالا — docs/plans/webhesab-parity.md بخش ۷ (افزایشی)
CREATE TABLE "AccMoveReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccMoveReason_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccMoveReason_direction_name_key" ON "AccMoveReason"("direction", "name");

CREATE TABLE "AccStockAdjust" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "direction" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "partyId" TEXT,
    "note" TEXT,
    "status" "AccDocStatus" NOT NULL DEFAULT 'POSTED',
    "voucherId" TEXT,
    "voidReason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccStockAdjust_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccStockAdjust_voucherId_key" ON "AccStockAdjust"("voucherId");
CREATE UNIQUE INDEX "AccStockAdjust_yearId_number_key" ON "AccStockAdjust"("yearId", "number");
CREATE INDEX "AccStockAdjust_date_idx" ON "AccStockAdjust"("date");
CREATE INDEX "AccStockAdjust_reasonId_idx" ON "AccStockAdjust"("reasonId");
ALTER TABLE "AccStockAdjust" ADD CONSTRAINT "AccStockAdjust_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "AccMoveReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AccStockAdjustLine" (
    "id" TEXT NOT NULL,
    "adjustId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "AccStockAdjustLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccStockAdjustLine_adjustId_idx" ON "AccStockAdjustLine"("adjustId");
CREATE INDEX "AccStockAdjustLine_productId_idx" ON "AccStockAdjustLine"("productId");
ALTER TABLE "AccStockAdjustLine" ADD CONSTRAINT "AccStockAdjustLine_adjustId_fkey" FOREIGN KEY ("adjustId") REFERENCES "AccStockAdjust"("id") ON DELETE CASCADE ON UPDATE CASCADE;
