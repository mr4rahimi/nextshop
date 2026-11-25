-- CreateEnum
CREATE TYPE "AccAssetCategory" AS ENUM ('FURNITURE', 'EQUIPMENT', 'VEHICLE', 'FITOUT', 'COMPUTER', 'OTHER');

-- CreateEnum
CREATE TYPE "AccDepMethod" AS ENUM ('STRAIGHT', 'DECLINING');

-- CreateEnum
CREATE TYPE "AccAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'VOID');

-- CreateEnum
CREATE TYPE "AccAssetFunding" AS ENUM ('INVOICE', 'TREASURY', 'CREDIT', 'EXISTING');

-- CreateEnum
CREATE TYPE "AccPrepaidStatus" AS ENUM ('ACTIVE', 'DONE', 'VOID');

-- CreateEnum
CREATE TYPE "AccDepositStatus" AS ENUM ('HELD', 'RETURNED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccSource" ADD VALUE 'FIXED_ASSET';
ALTER TYPE "AccSource" ADD VALUE 'PREPAID';

-- CreateTable
CREATE TABLE "AccFixedAsset" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AccAssetCategory" NOT NULL,
    "accountId" TEXT NOT NULL,
    "acquiredOn" DATE NOT NULL,
    "inServiceOn" DATE NOT NULL,
    "cost" BIGINT NOT NULL,
    "salvage" BIGINT NOT NULL DEFAULT 0,
    "method" "AccDepMethod" NOT NULL,
    "lifeMonths" INTEGER,
    "rateBp" INTEGER,
    "openingAccum" BIGINT NOT NULL DEFAULT 0,
    "depreciated" BIGINT NOT NULL DEFAULT 0,
    "depreciatedThrough" DATE,
    "funding" "AccAssetFunding" NOT NULL,
    "treasuryId" TEXT,
    "partyId" TEXT,
    "invoiceLineId" TEXT,
    "voucherId" TEXT,
    "status" "AccAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposedOn" DATE,
    "disposalAmount" BIGINT,
    "disposalDep" BIGINT,
    "disposalTreasuryId" TEXT,
    "disposalPartyId" TEXT,
    "disposalVoucherId" TEXT,
    "voidReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccFixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccDepreciation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccDepreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccPrepaid" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "startOn" DATE NOT NULL,
    "months" INTEGER NOT NULL,
    "recognized" BIGINT NOT NULL DEFAULT 0,
    "recognizedThrough" DATE,
    "paidOn" DATE NOT NULL,
    "funding" "AccAssetFunding" NOT NULL,
    "treasuryId" TEXT,
    "partyId" TEXT,
    "voucherId" TEXT,
    "status" "AccPrepaidStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccPrepaid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccDeposit" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidOn" DATE NOT NULL,
    "funding" "AccAssetFunding" NOT NULL,
    "treasuryId" TEXT,
    "voucherId" TEXT,
    "status" "AccDepositStatus" NOT NULL DEFAULT 'HELD',
    "returnedOn" DATE,
    "returnedAmount" BIGINT,
    "returnTreasuryId" TEXT,
    "shortfallAccountId" TEXT,
    "returnVoucherId" TEXT,
    "voidReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccFixedAsset_number_key" ON "AccFixedAsset"("number");

-- CreateIndex
CREATE UNIQUE INDEX "AccFixedAsset_invoiceLineId_key" ON "AccFixedAsset"("invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "AccFixedAsset_voucherId_key" ON "AccFixedAsset"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "AccFixedAsset_disposalVoucherId_key" ON "AccFixedAsset"("disposalVoucherId");

-- CreateIndex
CREATE INDEX "AccFixedAsset_status_idx" ON "AccFixedAsset"("status");

-- CreateIndex
CREATE INDEX "AccDepreciation_assetId_idx" ON "AccDepreciation"("assetId");

-- CreateIndex
CREATE INDEX "AccDepreciation_voucherId_idx" ON "AccDepreciation"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "AccPrepaid_number_key" ON "AccPrepaid"("number");

-- CreateIndex
CREATE UNIQUE INDEX "AccPrepaid_voucherId_key" ON "AccPrepaid"("voucherId");

-- CreateIndex
CREATE INDEX "AccPrepaid_status_idx" ON "AccPrepaid"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccDeposit_number_key" ON "AccDeposit"("number");

-- CreateIndex
CREATE UNIQUE INDEX "AccDeposit_voucherId_key" ON "AccDeposit"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "AccDeposit_returnVoucherId_key" ON "AccDeposit"("returnVoucherId");

-- CreateIndex
CREATE INDEX "AccDeposit_status_idx" ON "AccDeposit"("status");

-- AddForeignKey
ALTER TABLE "AccDepreciation" ADD CONSTRAINT "AccDepreciation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AccFixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

