-- CreateEnum
CREATE TYPE "IntegPlatformType" AS ENUM ('ACCOUNTING', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "IntegConnStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING');

-- CreateEnum
CREATE TYPE "IntegSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IntegJobType" AS ENUM ('SYNC_STOCK', 'SYNC_PRICE', 'SYNC_ALL_STOCK', 'SYNC_ALL_PRICE', 'FETCH_PRODUCTS', 'CREATE_PRODUCT', 'TEST_CONNECTION');

-- CreateEnum
CREATE TYPE "IntegJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegLogDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "IntegEntityType" AS ENUM ('PRODUCT', 'STOCK', 'PRICE', 'CONNECTION');

-- CreateEnum
CREATE TYPE "IntegLogStatus" AS ENUM ('SUCCESS', 'ERROR', 'PARTIAL');

-- CreateTable
CREATE TABLE "IntegPlatform" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegPlatformType" NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IntegPlatform_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "IntegConnection" (
    "id" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "siteId" TEXT,
    "credentials" TEXT NOT NULL,
    "status" "IntegConnStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "syncStockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncPriceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncIntervalMin" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegProductMapping" (
    "id" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "platformProductId" TEXT NOT NULL,
    "platformSku" TEXT,
    "platformTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegMappingSuggestion" (
    "id" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "platformProductId" TEXT NOT NULL,
    "platformTitle" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchReason" TEXT,
    "status" "IntegSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegMappingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegJob" (
    "id" TEXT NOT NULL,
    "type" "IntegJobType" NOT NULL,
    "platformCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "IntegJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "platformCode" TEXT NOT NULL,
    "operationType" "IntegJobType" NOT NULL,
    "direction" "IntegLogDirection" NOT NULL,
    "entityType" "IntegEntityType" NOT NULL,
    "entityId" TEXT,
    "requestData" JSONB,
    "responseData" JSONB,
    "status" "IntegLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegPriceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "scopeCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeBrandIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formula" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegPriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "workerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "workerIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "maxConcurrentJobs" INTEGER NOT NULL DEFAULT 5,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegConnection_status_idx" ON "IntegConnection"("status");

-- CreateIndex
CREATE INDEX "IntegConnection_platformCode_idx" ON "IntegConnection"("platformCode");

-- CreateIndex
CREATE UNIQUE INDEX "IntegConnection_platformCode_siteId_key" ON "IntegConnection"("platformCode", "siteId");

-- CreateIndex
CREATE INDEX "IntegProductMapping_shopProductId_idx" ON "IntegProductMapping"("shopProductId");

-- CreateIndex
CREATE INDEX "IntegProductMapping_platformCode_idx" ON "IntegProductMapping"("platformCode");

-- CreateIndex
CREATE INDEX "IntegProductMapping_isActive_idx" ON "IntegProductMapping"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IntegProductMapping_shopProductId_platformCode_key" ON "IntegProductMapping"("shopProductId", "platformCode");

-- CreateIndex
CREATE UNIQUE INDEX "IntegProductMapping_platformCode_platformProductId_key" ON "IntegProductMapping"("platformCode", "platformProductId");

-- CreateIndex
CREATE INDEX "IntegMappingSuggestion_shopProductId_idx" ON "IntegMappingSuggestion"("shopProductId");

-- CreateIndex
CREATE INDEX "IntegMappingSuggestion_platformCode_status_idx" ON "IntegMappingSuggestion"("platformCode", "status");

-- CreateIndex
CREATE INDEX "IntegMappingSuggestion_confidence_idx" ON "IntegMappingSuggestion"("confidence");

-- CreateIndex
CREATE INDEX "IntegJob_status_scheduledAt_idx" ON "IntegJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "IntegJob_platformCode_status_idx" ON "IntegJob"("platformCode", "status");

-- CreateIndex
CREATE INDEX "IntegJob_priority_scheduledAt_idx" ON "IntegJob"("priority", "scheduledAt");

-- CreateIndex
CREATE INDEX "IntegJob_type_idx" ON "IntegJob"("type");

-- CreateIndex
CREATE INDEX "IntegLog_platformCode_createdAt_idx" ON "IntegLog"("platformCode", "createdAt");

-- CreateIndex
CREATE INDEX "IntegLog_entityType_entityId_idx" ON "IntegLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntegLog_status_idx" ON "IntegLog"("status");

-- CreateIndex
CREATE INDEX "IntegLog_jobId_idx" ON "IntegLog"("jobId");

-- CreateIndex
CREATE INDEX "IntegLog_createdAt_idx" ON "IntegLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegPriceRule_isActive_priority_idx" ON "IntegPriceRule"("isActive", "priority");

-- AddForeignKey
ALTER TABLE "IntegConnection" ADD CONSTRAINT "IntegConnection_platformCode_fkey" FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegProductMapping" ADD CONSTRAINT "IntegProductMapping_shopProductId_fkey" FOREIGN KEY ("shopProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegProductMapping" ADD CONSTRAINT "IntegProductMapping_platformCode_fkey" FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegMappingSuggestion" ADD CONSTRAINT "IntegMappingSuggestion_platformCode_fkey" FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegJob" ADD CONSTRAINT "IntegJob_platformCode_fkey" FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegLog" ADD CONSTRAINT "IntegLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntegJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegLog" ADD CONSTRAINT "IntegLog_platformCode_fkey" FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
