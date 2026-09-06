-- CreateEnum
CREATE TYPE "ClubChannel" AS ENUM ('SMS', 'TELEGRAM', 'BALE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClubSource" ADD VALUE 'MESSAGING';
ALTER TYPE "ClubSource" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "ClubProfile" ADD COLUMN     "firstPlatform" TEXT,
ADD COLUMN     "firstSeenAt" TIMESTAMP(3),
ADD COLUMN     "firstSource" "ClubSource";

-- CreateTable
CREATE TABLE "ClubTouchpoint" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" "ClubSource" NOT NULL,
    "platform" TEXT,
    "channel" "ClubChannel",
    "externalId" TEXT,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubTouchpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubTouchpoint_profileId_occurredAt_idx" ON "ClubTouchpoint"("profileId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClubTouchpoint_source_platform_idx" ON "ClubTouchpoint"("source", "platform");

-- CreateIndex
CREATE INDEX "ClubTouchpoint_occurredAt_idx" ON "ClubTouchpoint"("occurredAt");

-- CreateIndex
CREATE INDEX "ClubProfile_firstSource_firstPlatform_idx" ON "ClubProfile"("firstSource", "firstPlatform");

-- AddForeignKey
ALTER TABLE "ClubTouchpoint" ADD CONSTRAINT "ClubTouchpoint_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
