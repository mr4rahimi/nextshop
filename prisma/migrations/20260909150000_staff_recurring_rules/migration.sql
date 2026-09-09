-- CreateEnum
CREATE TYPE "StaffScheduleKind" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOMER_IDLE');

-- AlterTable
ALTER TABLE "StaffTask" ADD COLUMN     "runKey" TEXT;

-- CreateTable
CREATE TABLE "StaffRecurringRule" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "roleId" TEXT,
    "schedule" "StaffScheduleKind" NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dayOfMonth" INTEGER,
    "timeOfDay" TEXT,
    "idleDays" INTEGER,
    "segmentJson" JSONB,
    "maxPerRun" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffRecurringRule_isActive_schedule_idx" ON "StaffRecurringRule"("isActive", "schedule");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTask_runKey_key" ON "StaffTask"("runKey");

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRecurringRule" ADD CONSTRAINT "StaffRecurringRule_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "StaffTaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

