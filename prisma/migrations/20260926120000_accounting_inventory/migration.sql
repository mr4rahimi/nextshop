-- حسابداری — فاز ۳: کالا و انبار (docs/plans/accounting.md بخش ۶.۵ و ۸)
-- انبار، موجودی، بهای تمام‌شده، کاردکس، حواله، انبارگردانی. همه افزودنی.

-- CreateEnum
CREATE TYPE "AccMoveType" AS ENUM ('OPENING', 'PURCHASE', 'PURCHASE_RETURN', 'SALE', 'SALE_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST_IN', 'ADJUST_OUT');

-- CreateEnum
CREATE TYPE "AccDocStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateTable
CREATE TABLE "AccWarehouse" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "sellable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hesabanId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccStock" (
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccStock_pkey" PRIMARY KEY ("productId","warehouseId")
);

-- CreateTable
CREATE TABLE "AccProductCost" (
    "productId" TEXT NOT NULL,
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "totalValue" BIGINT NOT NULL DEFAULT 0,
    "avgCost" BIGINT NOT NULL DEFAULT 0,
    "lastCost" BIGINT NOT NULL DEFAULT 0,
    "taxCode" TEXT,
    "vatRateBp" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccProductCost_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "AccStockMove" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "AccMoveType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCost" BIGINT NOT NULL DEFAULT 0,
    "totalCost" BIGINT NOT NULL DEFAULT 0,
    "balanceQty" INTEGER NOT NULL DEFAULT 0,
    "balanceValue" BIGINT NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "note" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccStockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccTransfer" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "note" TEXT,
    "status" "AccDocStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "AccTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccStockCount" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "AccDocStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "voucherId" TEXT,
    "voidReason" TEXT,
    "createdByName" TEXT NOT NULL,
    "postedByName" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccStockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccStockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQty" INTEGER,
    "countedQty" INTEGER NOT NULL,
    "diff" INTEGER,

    CONSTRAINT "AccStockCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccWarehouse_code_key" ON "AccWarehouse"("code");

-- CreateIndex
CREATE INDEX "AccStock_warehouseId_idx" ON "AccStock"("warehouseId");

-- CreateIndex
CREATE INDEX "AccStockMove_productId_date_createdAt_idx" ON "AccStockMove"("productId", "date", "createdAt");

-- CreateIndex
CREATE INDEX "AccStockMove_sourceType_sourceId_idx" ON "AccStockMove"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AccStockMove_warehouseId_productId_idx" ON "AccStockMove"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "AccTransfer_date_idx" ON "AccTransfer"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AccTransfer_yearId_number_key" ON "AccTransfer"("yearId", "number");

-- CreateIndex
CREATE INDEX "AccTransferLine_transferId_idx" ON "AccTransferLine"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "AccStockCount_voucherId_key" ON "AccStockCount"("voucherId");

-- CreateIndex
CREATE INDEX "AccStockCount_status_date_idx" ON "AccStockCount"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AccStockCount_yearId_number_key" ON "AccStockCount"("yearId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AccStockCountLine_countId_productId_key" ON "AccStockCountLine"("countId", "productId");

-- AddForeignKey
ALTER TABLE "AccTransferLine" ADD CONSTRAINT "AccTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "AccTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccStockCountLine" ADD CONSTRAINT "AccStockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "AccStockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

