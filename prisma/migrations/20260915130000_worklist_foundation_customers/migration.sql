-- پیش‌نیازهای کارتابل (ساعت کاری، دورکاری، تأمین‌کننده) + مالکیت مشتری در باشگاه — فاز ۸

-- CreateEnum
CREATE TYPE "StaffWorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "StaffClaimSource" AS ENUM ('MANUAL', 'CALL', 'ORDER', 'ADMIN');

-- AlterTable
ALTER TABLE "ClubProfile" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "claimTaskId" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedVia" "StaffClaimSource",
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "ownerName" TEXT;

-- AlterTable
ALTER TABLE "StaffTask" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "worklistLoyalMinOrders" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "worklistLoyalMinSpent" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "worklistWorkHours" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffWorkMode" "StaffWorkMode" NOT NULL DEFAULT 'ONSITE';

-- CreateTable
CREATE TABLE "StaffSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubCustomerCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubCustomerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubOwnerTransfer" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT,
    "toId" TEXT,
    "toName" TEXT,
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "via" "StaffClaimSource" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubOwnerTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSupplier_nameKey_key" ON "StaffSupplier"("nameKey");

-- CreateIndex
CREATE INDEX "StaffSupplier_isActive_name_idx" ON "StaffSupplier"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ClubCustomerCategory_slug_key" ON "ClubCustomerCategory"("slug");

-- CreateIndex
CREATE INDEX "ClubCustomerCategory_isActive_sortOrder_idx" ON "ClubCustomerCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ClubOwnerTransfer_profileId_createdAt_idx" ON "ClubOwnerTransfer"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "ClubProfile_ownerId_categoryId_idx" ON "ClubProfile"("ownerId", "categoryId");

-- CreateIndex
CREATE INDEX "ClubProfile_categoryId_idx" ON "ClubProfile"("categoryId");

-- CreateIndex
CREATE INDEX "StaffTask_supplierId_idx" ON "StaffTask"("supplierId");

-- AddForeignKey
ALTER TABLE "ClubProfile" ADD CONSTRAINT "ClubProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubProfile" ADD CONSTRAINT "ClubProfile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ClubCustomerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "StaffSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubOwnerTransfer" ADD CONSTRAINT "ClubOwnerTransfer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

