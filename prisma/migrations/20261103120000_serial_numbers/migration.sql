-- شماره سریال کالا — docs/plans/webhesab-parity.md بخش ۱۴ (افزایشی)
ALTER TABLE "AccItem" ADD COLUMN "hasSerial" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "warrantyDays" INTEGER;
ALTER TABLE "AccSettings" ADD COLUMN "serialRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AccInvoiceLine" ADD COLUMN "serials" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AccStockAdjustLine" ADD COLUMN "serials" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AccTransferLine" ADD COLUMN "serials" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Guaranty" ADD COLUMN "sourceKey" TEXT;
CREATE INDEX "Guaranty_sourceKey_idx" ON "Guaranty"("sourceKey");

CREATE TABLE "AccSerial" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "warehouseId" TEXT,
    "lastType" TEXT,
    "lastDate" DATE,
    "partyId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccSerial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccSerial_itemId_serial_key" ON "AccSerial"("itemId", "serial");
CREATE INDEX "AccSerial_serial_idx" ON "AccSerial"("serial");
CREATE INDEX "AccSerial_itemId_status_warehouseId_idx" ON "AccSerial"("itemId", "status", "warehouseId");
ALTER TABLE "AccSerial" ADD CONSTRAINT "AccSerial_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AccItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccSerialMove" (
    "id" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "partyId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccSerialMove_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccSerialMove_serialId_date_createdAt_idx" ON "AccSerialMove"("serialId", "date", "createdAt");
CREATE INDEX "AccSerialMove_sourceType_sourceId_idx" ON "AccSerialMove"("sourceType", "sourceId");
ALTER TABLE "AccSerialMove" ADD CONSTRAINT "AccSerialMove_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "AccSerial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
