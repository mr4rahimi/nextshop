-- کارتابل فاز ۹: وضعیت کالا، معامله، پورسانت و تسویه — docs/features/staff-worklist.md بخش ۲۲

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'STOCK', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "StaffDealStatus" AS ENUM ('PENDING', 'CONFIRMED', 'VOID');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "condition" "ProductCondition" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionPlanId" TEXT;

-- CreateTable
CREATE TABLE "StaffDeal" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "customerName" TEXT,
    "title" TEXT NOT NULL,
    "revenue" BIGINT NOT NULL DEFAULT 0,
    "cost" BIGINT,
    "profit" BIGINT,
    "commission" BIGINT,
    "costPerItem" BOOLEAN NOT NULL DEFAULT false,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "note" TEXT,
    "status" "StaffDealStatus" NOT NULL DEFAULT 'PENDING',
    "monthKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmedByName" TEXT,
    "payoutId" TEXT,
    "adjustedPayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDealItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
    "qty" INTEGER NOT NULL DEFAULT 1,
    "revenue" BIGINT NOT NULL DEFAULT 0,
    "cost" BIGINT,
    "profit" BIGINT,
    "percent" DOUBLE PRECISION,
    "commission" BIGINT,
    "ruleId" TEXT,
    "ruleLabel" TEXT,

    CONSTRAINT "StaffDealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCommissionPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCommissionRule" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "categoryId" TEXT,
    "condition" "ProductCondition",
    "percent" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "fromAt" TIMESTAMP(3) NOT NULL,
    "toAt" TIMESTAMP(3) NOT NULL,
    "dealCount" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" BIGINT NOT NULL DEFAULT 0,
    "grossCommission" BIGINT NOT NULL DEFAULT 0,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planTitle" TEXT,
    "adjustment" BIGINT NOT NULL DEFAULT 0,
    "carriedIn" BIGINT NOT NULL DEFAULT 0,
    "due" BIGINT NOT NULL DEFAULT 0,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "remaining" BIGINT NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidById" TEXT,
    "paidByName" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "StaffPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffDeal_orderId_key" ON "StaffDeal"("orderId");

-- CreateIndex
CREATE INDEX "StaffDeal_ownerId_payoutId_status_idx" ON "StaffDeal"("ownerId", "payoutId", "status");

-- CreateIndex
CREATE INDEX "StaffDeal_ownerId_monthKey_idx" ON "StaffDeal"("ownerId", "monthKey");

-- CreateIndex
CREATE INDEX "StaffDeal_payoutId_status_idx" ON "StaffDeal"("payoutId", "status");

-- CreateIndex
CREATE INDEX "StaffDeal_status_createdAt_idx" ON "StaffDeal"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDealItem_orderItemId_key" ON "StaffDealItem"("orderItemId");

-- CreateIndex
CREATE INDEX "StaffDealItem_dealId_idx" ON "StaffDealItem"("dealId");

-- CreateIndex
CREATE INDEX "StaffDealItem_categoryId_idx" ON "StaffDealItem"("categoryId");

-- CreateIndex
CREATE INDEX "StaffCommissionRule_planId_isActive_idx" ON "StaffCommissionRule"("planId", "isActive");

-- CreateIndex
CREATE INDEX "StaffPayout_userId_paidAt_idx" ON "StaffPayout"("userId", "paidAt");

-- CreateIndex
CREATE INDEX "StaffPayout_paidAt_idx" ON "StaffPayout"("paidAt");

-- CreateIndex
CREATE INDEX "Product_condition_idx" ON "Product"("condition");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "StaffCommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeal" ADD CONSTRAINT "StaffDeal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeal" ADD CONSTRAINT "StaffDeal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeal" ADD CONSTRAINT "StaffDeal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeal" ADD CONSTRAINT "StaffDeal_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "StaffSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeal" ADD CONSTRAINT "StaffDeal_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "StaffPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeal" ADD CONSTRAINT "StaffDeal_adjustedPayoutId_fkey" FOREIGN KEY ("adjustedPayoutId") REFERENCES "StaffPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDealItem" ADD CONSTRAINT "StaffDealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "StaffDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCommissionRule" ADD CONSTRAINT "StaffCommissionRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StaffCommissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCommissionRule" ADD CONSTRAINT "StaffCommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayout" ADD CONSTRAINT "StaffPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

