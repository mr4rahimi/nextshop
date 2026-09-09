
-- CreateEnum
CREATE TYPE "StaffSessionEnd" AS ENUM ('LOGOUT', 'TIMEOUT', 'MANUAL');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "worklistDailyCapMin" INTEGER NOT NULL DEFAULT 600;

-- CreateTable
CREATE TABLE "StaffWorkSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "StaffSessionEnd",
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "StaffWorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffWorkDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "firstIn" TIMESTAMP(3) NOT NULL,
    "lastOut" TIMESTAMP(3) NOT NULL,
    "activeMin" INTEGER NOT NULL,
    "grossMin" INTEGER NOT NULL,
    "note" TEXT,
    "editedById" TEXT,
    "editedByName" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffWorkDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffWorkSession_userId_startedAt_idx" ON "StaffWorkSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "StaffWorkSession_endedAt_idx" ON "StaffWorkSession"("endedAt");

-- CreateIndex
CREATE INDEX "StaffWorkDay_day_idx" ON "StaffWorkDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "StaffWorkDay_userId_day_key" ON "StaffWorkDay"("userId", "day");

