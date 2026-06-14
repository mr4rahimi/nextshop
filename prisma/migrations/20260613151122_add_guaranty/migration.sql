-- CreateEnum
CREATE TYPE "GuarantyRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Guaranty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guaranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuarantyRequest" (
    "id" TEXT NOT NULL,
    "guarantyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "GuarantyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuarantyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guaranty_serialNumber_key" ON "Guaranty"("serialNumber");

-- CreateIndex
CREATE INDEX "Guaranty_userId_idx" ON "Guaranty"("userId");

-- CreateIndex
CREATE INDEX "Guaranty_endDate_idx" ON "Guaranty"("endDate");

-- CreateIndex
CREATE INDEX "GuarantyRequest_guarantyId_idx" ON "GuarantyRequest"("guarantyId");

-- CreateIndex
CREATE INDEX "GuarantyRequest_status_idx" ON "GuarantyRequest"("status");

-- AddForeignKey
ALTER TABLE "Guaranty" ADD CONSTRAINT "Guaranty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuarantyRequest" ADD CONSTRAINT "GuarantyRequest_guarantyId_fkey" FOREIGN KEY ("guarantyId") REFERENCES "Guaranty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
