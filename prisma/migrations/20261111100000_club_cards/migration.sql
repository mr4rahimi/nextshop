-- کارت اشتراک و اعتبار باشگاه در صندوق — docs/plans/webhesab-parity.md بخش ۲۳ (افزایشی)
ALTER TYPE "AccMoneyMethod" ADD VALUE 'CLUB_CREDIT';

ALTER TABLE "StoreSettings" ADD COLUMN "clubCardPosEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pointExpiryEnforced" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClubTier" ADD COLUMN "cardChargeBp" INTEGER,
ADD COLUMN "posDiscountBp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "manualOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ClubCard" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClubCard_number_key" ON "ClubCard"("number");
CREATE INDEX "ClubCard_profileId_idx" ON "ClubCard"("profileId");
ALTER TABLE "ClubCard" ADD CONSTRAINT "ClubCard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccPosTicket" ADD COLUMN "clubProfileId" TEXT,
ADD COLUMN "clubSpent" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "clubEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "clubRestored" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "clubReversed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "refTicketId" TEXT;
CREATE INDEX "AccPosTicket_refTicketId_idx" ON "AccPosTicket"("refTicketId");
CREATE INDEX "AccPosTicket_clubProfileId_idx" ON "AccPosTicket"("clubProfileId");
