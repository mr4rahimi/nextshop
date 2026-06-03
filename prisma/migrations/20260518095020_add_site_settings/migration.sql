-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "siteAddress" TEXT,
ADD COLUMN     "siteDescription" TEXT,
ADD COLUMN     "siteEmail" TEXT,
ADD COLUMN     "siteFavicon" TEXT,
ADD COLUMN     "siteKeywords" TEXT,
ADD COLUMN     "sitePhone" TEXT,
ADD COLUMN     "socialInstagram" TEXT,
ADD COLUMN     "socialTelegram" TEXT,
ADD COLUMN     "socialTwitter" TEXT,
ADD COLUMN     "socialWhatsapp" TEXT;
