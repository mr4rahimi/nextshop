/*
  Warnings:

  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `specs` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "description",
DROP COLUMN "specs",
ADD COLUMN     "expertDescription" TEXT,
ADD COLUMN     "expertImage" TEXT,
ADD COLUMN     "expertTitle" TEXT,
ADD COLUMN     "faq" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "mainImage" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoKeywords" TEXT,
ADD COLUMN     "seoSchema" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "summaryDescription" TEXT,
ADD COLUMN     "summaryFeatures" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "summaryImage" TEXT,
ADD COLUMN     "summaryTitle" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "ProductSpecValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "specItemId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductSpecValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpecValue_productId_idx" ON "ProductSpecValue"("productId");

-- CreateIndex
CREATE INDEX "ProductSpecValue_specItemId_idx" ON "ProductSpecValue"("specItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecValue_productId_specItemId_key" ON "ProductSpecValue"("productId", "specItemId");

-- AddForeignKey
ALTER TABLE "ProductSpecValue" ADD CONSTRAINT "ProductSpecValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecValue" ADD CONSTRAINT "ProductSpecValue_specItemId_fkey" FOREIGN KEY ("specItemId") REFERENCES "SpecItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
