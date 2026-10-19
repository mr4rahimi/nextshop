-- امتیاز عملکرد کارکنان (۲.۹۷.۰) — docs/features/staff-worklist.md بخش ۱۵. همه افزایشی؛ پیش‌فرض خاموش.
-- CreateEnum
CREATE TYPE "StaffScoreGroup" AS ENUM ('SALES', 'OPERATIONS', 'CONTENT');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "scoreConversionDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "scoreEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scoreMinVolumePct" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "scoreShowRank" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "scoreExcluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scoreGroup" "StaffScoreGroup";

-- CreateTable
CREATE TABLE "StaffScoreMetric" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "group" "StaffScoreGroup" NOT NULL,
    "weight" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffScoreMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffScoreAward" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "group" "StaffScoreGroup" NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffScoreAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffScoreMetric_code_group_key" ON "StaffScoreMetric"("code", "group");

-- CreateIndex
CREATE INDEX "StaffScoreAward_userId_idx" ON "StaffScoreAward"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffScoreAward_monthKey_group_key" ON "StaffScoreAward"("monthKey", "group");

