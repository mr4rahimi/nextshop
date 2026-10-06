-- ابزارها: یادآوری سبد رهاشده — docs/plans/store-tools-2.md بخش ۱
-- افزایشی؛ هیچ جدول موجودی دست نمی‌خورد.
-- CreateEnum
CREATE TYPE "CartRecoveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'RECOVERED');

-- CreateTable
CREATE TABLE "CartRecoverySetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "patternCode" TEXT,
    "linkMode" TEXT NOT NULL DEFAULT 'VARIABLE',
    "delayMinutes" INTEGER NOT NULL DEFAULT 120,
    "sendFrom" INTEGER NOT NULL DEFAULT 10,
    "sendTo" INTEGER NOT NULL DEFAULT 21,
    "minCartTotal" BIGINT NOT NULL DEFAULT 0,
    "cooldownDays" INTEGER NOT NULL DEFAULT 7,
    "couponEnabled" BOOLEAN NOT NULL DEFAULT false,
    "couponType" TEXT NOT NULL DEFAULT 'PERCENT',
    "couponValue" BIGINT NOT NULL DEFAULT 5,
    "couponMaxDiscount" BIGINT NOT NULL DEFAULT 0,
    "couponValidHours" INTEGER NOT NULL DEFAULT 48,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartRecoverySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartRecovery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "status" "CartRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "cartTotal" BIGINT NOT NULL DEFAULT 0,
    "cartActivityAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "couponId" TEXT,
    "couponCode" TEXT,
    "recoveredOrderId" TEXT,
    "recoveredAt" TIMESTAMP(3),
    "recoveredTotal" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartRecovery_token_key" ON "CartRecovery"("token");

-- CreateIndex
CREATE INDEX "CartRecovery_status_dueAt_idx" ON "CartRecovery"("status", "dueAt");

-- CreateIndex
CREATE INDEX "CartRecovery_userId_cartActivityAt_idx" ON "CartRecovery"("userId", "cartActivityAt");

-- CreateIndex
CREATE INDEX "CartRecovery_phone_sentAt_idx" ON "CartRecovery"("phone", "sentAt");

-- CreateIndex
CREATE INDEX "CartRecovery_createdAt_idx" ON "CartRecovery"("createdAt");

