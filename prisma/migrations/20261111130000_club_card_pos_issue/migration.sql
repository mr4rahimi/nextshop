-- صدور کارت اشتراک از صندوق — docs/plans/webhesab-parity.md بخش ۲۳ (افزایشی)
ALTER TABLE "StoreSettings" ADD COLUMN "clubCardDefaultTierId" TEXT;
ALTER TABLE "ClubCard" ADD COLUMN "issuedBy" TEXT;
