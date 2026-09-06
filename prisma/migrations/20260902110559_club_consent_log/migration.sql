-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('CHECKOUT', 'LANDING', 'SMS_REPLY', 'MESSENGER', 'SELLER', 'ADMIN', 'IMPORT');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "pointOnConsent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsOptInText" TEXT DEFAULT 'عضویت';

-- CreateTable
CREATE TABLE "ClubConsentEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "channel" "ClubChannel" NOT NULL DEFAULT 'SMS',
    "granted" BOOLEAN NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubConsentEvent_profileId_createdAt_idx" ON "ClubConsentEvent"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "ClubConsentEvent_channel_granted_idx" ON "ClubConsentEvent"("channel", "granted");

-- CreateIndex
CREATE INDEX "ClubConsentEvent_createdAt_idx" ON "ClubConsentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "ClubConsentEvent" ADD CONSTRAINT "ClubConsentEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
