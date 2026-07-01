/*
  Warnings:

  - You are about to drop the `IntegProductMapping` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "IntegProductMapping" DROP CONSTRAINT "IntegProductMapping_platformCode_fkey";

-- DropForeignKey
ALTER TABLE "IntegProductMapping" DROP CONSTRAINT "IntegProductMapping_shopProductId_fkey";

-- DropTable
DROP TABLE "IntegProductMapping";

-- CreateTable
CREATE TABLE "IntegMapping" (
    "id" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegMappingLink" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegMappingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegMappingLink_mappingId_idx" ON "IntegMappingLink"("mappingId");

-- CreateIndex
CREATE INDEX "IntegMappingLink_platformCode_idx" ON "IntegMappingLink"("platformCode");

-- CreateIndex
CREATE INDEX "IntegMappingLink_platformCode_isActive_idx" ON "IntegMappingLink"("platformCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IntegMappingLink_mappingId_platformCode_key" ON "IntegMappingLink"("mappingId", "platformCode");

-- CreateIndex
CREATE UNIQUE INDEX "IntegMappingLink_platformCode_externalId_key" ON "IntegMappingLink"("platformCode", "externalId");

-- AddForeignKey
ALTER TABLE "IntegMappingLink" ADD CONSTRAINT "IntegMappingLink_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "IntegMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;
