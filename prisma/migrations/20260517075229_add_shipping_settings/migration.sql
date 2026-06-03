-- CreateEnum
CREATE TYPE "ShippingType" AS ENUM ('EXPRESS', 'STANDARD');

-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ShippingType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cities" TEXT[],
    "fee" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "cardNumber" TEXT,
    "cardHolder" TEXT,
    "cardBank" TEXT,
    "cardReceiptInfo" TEXT,
    "paymentGatewayActive" BOOLEAN NOT NULL DEFAULT false,
    "paymentGatewayMerchant" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingMethod_isActive_idx" ON "ShippingMethod"("isActive");
