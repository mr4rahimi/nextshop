-- پرونده‌ی مشتریان نرم‌افزار قبلی — docs/plans/webhesab-parity.md بخش ۲۴ (افزایشی)
CREATE TABLE "LegacyCustomer" (
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'وب حساب',
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "rawMobile" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "region" TEXT,
    "store" TEXT,
    "groupName" TEXT,
    "cardNumber" TEXT,
    "gender" TEXT,
    "birthDate" TEXT,
    "marriageDate" TEXT,
    "registeredAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "spent" BIGINT NOT NULL DEFAULT 0,
    "lastPurchaseAt" TIMESTAMP(3),
    "partyId" TEXT,
    "userId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegacyCustomer_pkey" PRIMARY KEY ("code")
);
CREATE INDEX "LegacyCustomer_mobile_idx" ON "LegacyCustomer"("mobile");
CREATE INDEX "LegacyCustomer_partyId_idx" ON "LegacyCustomer"("partyId");
CREATE INDEX "LegacyCustomer_userId_idx" ON "LegacyCustomer"("userId");
