/*
  Warnings:

  - You are about to drop the column `formula` on the `IntegPriceRule` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "IntegCostType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "IntegPurchasePriceSource" AS ENUM ('HESABAN', 'MANUAL');

-- AlterTable
ALTER TABLE "IntegMapping" ADD COLUMN     "lastPriceSyncAt" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" DOUBLE PRECISION,
ADD COLUMN     "purchasePriceSource" "IntegPurchasePriceSource" NOT NULL DEFAULT 'HESABAN',
ADD COLUMN     "syncPriceEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "IntegPriceRule" DROP COLUMN "formula",
ADD COLUMN     "feePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "miscType" "IntegCostType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "miscValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "packagingType" "IntegCostType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "packagingValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "roundTo" INTEGER,
ADD COLUMN     "shippingType" "IntegCostType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "shippingValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IntegPriceRuleTier" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "minStock" INTEGER,
    "maxStock" INTEGER,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IntegPriceRuleTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegPriceRuleTier_ruleId_idx" ON "IntegPriceRuleTier"("ruleId");

-- AddForeignKey
ALTER TABLE "IntegPriceRuleTier" ADD CONSTRAINT "IntegPriceRuleTier_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "IntegPriceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
