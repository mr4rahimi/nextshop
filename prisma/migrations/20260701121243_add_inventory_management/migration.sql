-- CreateEnum
CREATE TYPE "IntegOrderStatus" AS ENUM ('PENDING', 'INVOICED');

-- AlterEnum
ALTER TYPE "IntegEntityType" ADD VALUE 'ORDER';

-- AlterEnum
ALTER TYPE "IntegJobType" ADD VALUE 'FETCH_ORDERS';

-- AlterTable
ALTER TABLE "IntegMapping" ADD COLUMN     "lastHesabanStock" INTEGER,
ADD COLUMN     "lastStockSyncAt" TIMESTAMP(3),
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncStockEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "IntegOrder" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT,
    "platformCode" TEXT NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "platformOrderItemId" TEXT,
    "productTitle" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "status" "IntegOrderStatus" NOT NULL DEFAULT 'PENDING',
    "invoicedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegOrder_mappingId_idx" ON "IntegOrder"("mappingId");

-- CreateIndex
CREATE INDEX "IntegOrder_platformCode_status_idx" ON "IntegOrder"("platformCode", "status");

-- CreateIndex
CREATE INDEX "IntegOrder_status_idx" ON "IntegOrder"("status");

-- CreateIndex
CREATE INDEX "IntegOrder_createdAt_idx" ON "IntegOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegOrder_platformCode_platformOrderId_key" ON "IntegOrder"("platformCode", "platformOrderId");

-- AddForeignKey
ALTER TABLE "IntegOrder" ADD CONSTRAINT "IntegOrder_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "IntegMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
