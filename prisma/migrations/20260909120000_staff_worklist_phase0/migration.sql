-- CreateEnum
CREATE TYPE "StaffDomain" AS ENUM ('SALES', 'FINANCE', 'PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'CONTENT', 'SUPPORT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "StaffChannel" AS ENUM ('NONE', 'CALL_IN', 'CALL_OUT', 'SMS', 'MESSENGER', 'EMAIL', 'IN_PERSON', 'ONLINE');

-- CreateEnum
CREATE TYPE "StaffTaskSource" AS ENUM ('MANUAL', 'RECURRING', 'ASSIGNED', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntity" ADD VALUE 'STAFF_ROLE';
ALTER TYPE "ActivityEntity" ADD VALUE 'STAFF_TASK';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffRoleId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdByStaffId" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "worklistEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTaskType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" "StaffDomain" NOT NULL,
    "channel" "StaffChannel" NOT NULL DEFAULT 'NONE',
    "source" "StaffTaskSource" NOT NULL DEFAULT 'MANUAL',
    "systemKey" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "outcomes" JSONB NOT NULL DEFAULT '[]',
    "needsCustomer" BOOLEAN NOT NULL DEFAULT false,
    "needsAmount" BOOLEAN NOT NULL DEFAULT false,
    "needsLink" BOOLEAN NOT NULL DEFAULT false,
    "needsCarrier" BOOLEAN NOT NULL DEFAULT false,
    "slaMinutes" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTaskType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_slug_key" ON "StaffRole"("slug");

-- CreateIndex
CREATE INDEX "StaffRole_isActive_sortOrder_idx" ON "StaffRole"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTaskType_slug_key" ON "StaffTaskType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTaskType_systemKey_key" ON "StaffTaskType"("systemKey");

-- CreateIndex
CREATE INDEX "StaffTaskType_domain_isActive_idx" ON "StaffTaskType"("domain", "isActive");

-- CreateIndex
CREATE INDEX "StaffTaskType_source_idx" ON "StaffTaskType"("source");

-- CreateIndex
CREATE INDEX "StaffTaskType_isActive_sortOrder_idx" ON "StaffTaskType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "User_staffRoleId_idx" ON "User"("staffRoleId");

-- CreateIndex
CREATE INDEX "Order_createdByStaffId_createdAt_idx" ON "Order"("createdByStaffId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

