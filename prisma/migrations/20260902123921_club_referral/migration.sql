-- AlterTable
ALTER TABLE "ClubProfile" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredAt" TIMESTAMP(3),
ADD COLUMN     "referredById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClubProfile_referralCode_key" ON "ClubProfile"("referralCode");

-- CreateIndex
CREATE INDEX "ClubProfile_referredById_idx" ON "ClubProfile"("referredById");

