-- CreateTable
CREATE TABLE "IntegPlatformProduct" (
    "id" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "platformProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "stock" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "unit" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rawData" JSONB NOT NULL DEFAULT '{}',
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegPlatformProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegPlatformProduct_platformCode_idx" ON "IntegPlatformProduct"("platformCode");

-- CreateIndex
CREATE INDEX "IntegPlatformProduct_platformCode_isEnabled_idx" ON "IntegPlatformProduct"("platformCode", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "IntegPlatformProduct_platformCode_platformProductId_key" ON "IntegPlatformProduct"("platformCode", "platformProductId");

-- AddForeignKey
ALTER TABLE "IntegPlatformProduct" ADD CONSTRAINT "IntegPlatformProduct_platformCode_fkey" FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
