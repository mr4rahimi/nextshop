-- CreateEnum
CREATE TYPE "FooterColType" AS ENUM ('LINKS', 'CATEGORIES', 'CONTACT', 'BRAND');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "enamadCode" TEXT,
ADD COLUMN     "samanCode" TEXT,
ADD COLUMN     "trustBadge3" TEXT,
ADD COLUMN     "trustBadge4" TEXT;

-- CreateTable
CREATE TABLE "FooterColumn" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "FooterColType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FooterColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FooterItem" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FooterItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FooterColumn_sortOrder_idx" ON "FooterColumn"("sortOrder");

-- CreateIndex
CREATE INDEX "FooterItem_columnId_idx" ON "FooterItem"("columnId");

-- AddForeignKey
ALTER TABLE "FooterItem" ADD CONSTRAINT "FooterItem_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "FooterColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
