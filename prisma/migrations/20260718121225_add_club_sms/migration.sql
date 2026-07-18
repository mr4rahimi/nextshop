-- CreateEnum
CREATE TYPE "SmsKind" AS ENUM ('TRANSACTIONAL', 'MARKETING');

-- CreateEnum
CREATE TYPE "SmsSendMode" AS ENUM ('PATTERN', 'TEXT');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ClubTrigger" AS ENUM ('WELCOME', 'BIRTHDAY', 'MEMBERSHIP_ANNIVERSARY', 'AFTER_PURCHASE', 'PURCHASE_FEEDBACK', 'DORMANT_CUSTOMER', 'TIER_UPGRADE', 'POINTS_EXPIRING');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "smsInboxCursor" INTEGER;

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "SmsKind" NOT NULL DEFAULT 'MARKETING',
    "mode" "SmsSendMode" NOT NULL DEFAULT 'TEXT',
    "patternCode" TEXT,
    "body" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "segment" JSONB NOT NULL DEFAULT '{}',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" BIGINT NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "campaignId" TEXT,
    "automationId" TEXT,
    "templateKey" TEXT,
    "kind" "SmsKind" NOT NULL DEFAULT 'MARKETING',
    "body" TEXT,
    "lineNumber" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'iranpayamak',
    "providerRequestId" INTEGER,
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "skipReason" TEXT,
    "errorMessage" TEXT,
    "cost" BIGINT NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOptOut" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubAutomation" (
    "id" TEXT NOT NULL,
    "trigger" "ClubTrigger" NOT NULL,
    "templateId" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "sendHour" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "ClubAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_key_key" ON "SmsTemplate"("key");

-- CreateIndex
CREATE INDEX "SmsCampaign_status_idx" ON "SmsCampaign"("status");

-- CreateIndex
CREATE INDEX "SmsCampaign_scheduledAt_idx" ON "SmsCampaign"("scheduledAt");

-- CreateIndex
CREATE INDEX "SmsMessage_userId_idx" ON "SmsMessage"("userId");

-- CreateIndex
CREATE INDEX "SmsMessage_phone_idx" ON "SmsMessage"("phone");

-- CreateIndex
CREATE INDEX "SmsMessage_status_idx" ON "SmsMessage"("status");

-- CreateIndex
CREATE INDEX "SmsMessage_campaignId_idx" ON "SmsMessage"("campaignId");

-- CreateIndex
CREATE INDEX "SmsMessage_providerRequestId_idx" ON "SmsMessage"("providerRequestId");

-- CreateIndex
CREATE INDEX "SmsMessage_queuedAt_idx" ON "SmsMessage"("queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOptOut_phone_key" ON "SmsOptOut"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAutomation_trigger_key" ON "ClubAutomation"("trigger");

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SmsTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAutomation" ADD CONSTRAINT "ClubAutomation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SmsTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
