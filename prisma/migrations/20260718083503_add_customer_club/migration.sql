-- CreateEnum
CREATE TYPE "ClubSource" AS ENUM ('ONLINE', 'IN_STORE', 'CALLER_ID', 'IMPORT', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('PURCHASE', 'MANUAL', 'SIGNUP', 'BIRTHDAY', 'REFERRAL', 'REVIEW', 'REDEEM', 'EXPIRE', 'ADJUST');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SELLER';

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "clubEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clubName" TEXT,
ADD COLUMN     "pointExpiryDays" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN     "pointPerToman" DOUBLE PRECISION NOT NULL DEFAULT 0.001,
ADD COLUMN     "smsAllowedHourEnd" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "smsAllowedHourStart" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "smsMarketingLine" TEXT,
ADD COLUMN     "smsMonthlyCapPerUser" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "smsOptOutText" TEXT DEFAULT 'لغو۱۱';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ClubProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "gender" TEXT,
    "source" "ClubSource" NOT NULL DEFAULT 'ONLINE',
    "sourcePlatform" TEXT,
    "registeredById" TEXT,
    "tierId" TEXT,
    "totalSpent" BIGINT NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lastPurchaseAt" TIMESTAMP(3),
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "consentIp" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTier" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minSpent" BIGINT NOT NULL DEFAULT 0,
    "color" TEXT,
    "pointRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "benefits" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "PointReason" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubProfile_userId_key" ON "ClubProfile"("userId");

-- CreateIndex
CREATE INDEX "ClubProfile_tierId_idx" ON "ClubProfile"("tierId");

-- CreateIndex
CREATE INDEX "ClubProfile_birthMonth_birthDay_idx" ON "ClubProfile"("birthMonth", "birthDay");

-- CreateIndex
CREATE INDEX "ClubProfile_lastPurchaseAt_idx" ON "ClubProfile"("lastPurchaseAt");

-- CreateIndex
CREATE INDEX "ClubProfile_smsConsent_idx" ON "ClubProfile"("smsConsent");

-- CreateIndex
CREATE INDEX "ClubProfile_source_idx" ON "ClubProfile"("source");

-- CreateIndex
CREATE INDEX "ClubProfile_sourcePlatform_idx" ON "ClubProfile"("sourcePlatform");

-- CreateIndex
CREATE INDEX "ClubProfile_joinedAt_idx" ON "ClubProfile"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubTier_slug_key" ON "ClubTier"("slug");

-- CreateIndex
CREATE INDEX "ClubTier_isActive_idx" ON "ClubTier"("isActive");

-- CreateIndex
CREATE INDEX "ClubTier_sortOrder_idx" ON "ClubTier"("sortOrder");

-- CreateIndex
CREATE INDEX "PointTransaction_profileId_idx" ON "PointTransaction"("profileId");

-- CreateIndex
CREATE INDEX "PointTransaction_createdAt_idx" ON "PointTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "PointTransaction_expiresAt_idx" ON "PointTransaction"("expiresAt");

-- CreateIndex
CREATE INDEX "PointTransaction_reason_idx" ON "PointTransaction"("reason");

-- AddForeignKey
ALTER TABLE "ClubProfile" ADD CONSTRAINT "ClubProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubProfile" ADD CONSTRAINT "ClubProfile_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "ClubTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
