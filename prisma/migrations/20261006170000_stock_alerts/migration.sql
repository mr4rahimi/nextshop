-- ابزارها: «موجود شد خبرم کن» — docs/plans/store-tools-2.md بخش ۲
-- افزایشی؛ هیچ جدول موجودی دست نمی‌خورد.
-- CreateEnum
CREATE TYPE "StockAlertStatus" AS ENUM ('WAITING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockAlertSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "patternCode" TEXT,
    "linkMode" TEXT NOT NULL DEFAULT 'VARIABLE',
    "sendFrom" INTEGER NOT NULL DEFAULT 10,
    "sendTo" INTEGER NOT NULL DEFAULT 21,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "token" TEXT NOT NULL,
    "status" "StockAlertStatus" NOT NULL DEFAULT 'WAITING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_token_key" ON "StockAlert"("token");

-- CreateIndex
CREATE INDEX "StockAlert_status_productId_idx" ON "StockAlert"("status", "productId");

-- CreateIndex
CREATE INDEX "StockAlert_notifiedAt_idx" ON "StockAlert"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_productId_phone_key" ON "StockAlert"("productId", "phone");

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

