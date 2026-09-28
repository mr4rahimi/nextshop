-- آمار بازدید — docs/plans/seo-marketing.md بخش ۱۳ (افزودنی)

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "landingPath" TEXT,
ADD COLUMN     "referrerHost" TEXT,
ADD COLUMN     "touchedAt" TIMESTAMP(3),
ADD COLUMN     "trafficChannel" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT;

-- CreateTable
CREATE TABLE "SeoAnalyticsSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "umamiWebsiteId" TEXT,
    "umamiShareSlug" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByName" TEXT,

    CONSTRAINT "SeoAnalyticsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_trafficChannel_createdAt_idx" ON "Order"("trafficChannel", "createdAt");
