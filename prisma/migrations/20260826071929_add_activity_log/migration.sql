-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE', 'UPLOAD', 'LOGIN');

-- CreateEnum
CREATE TYPE "ActivityEntity" AS ENUM ('PRODUCT', 'CATEGORY', 'BRAND', 'MEDIA', 'WIDGET', 'PAGE', 'ORDER', 'STORY', 'HERO_SLIDE', 'BLOG', 'USER', 'SETTINGS', 'OTHER');

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorPhone" TEXT,
    "action" "ActivityAction" NOT NULL,
    "entity" "ActivityEntity" NOT NULL,
    "entityId" TEXT,
    "entityTitle" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");
