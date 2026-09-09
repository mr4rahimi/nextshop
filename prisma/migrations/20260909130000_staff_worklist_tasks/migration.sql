-- CreateEnum
CREATE TYPE "StaffTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "StaffPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "StaffTask" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "domain" "StaffDomain" NOT NULL,
    "channel" "StaffChannel" NOT NULL DEFAULT 'NONE',
    "source" "StaffTaskSource" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "status" "StaffTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "StaffPriority" NOT NULL DEFAULT 'NORMAL',
    "customerId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "supplierName" TEXT,
    "entity" "ActivityEntity",
    "entityId" TEXT,
    "linkUrl" TEXT,
    "amount" BIGINT,
    "carrier" TEXT,
    "outcome" TEXT,
    "note" TEXT,
    "parentId" TEXT,
    "ruleId" TEXT,
    "dueAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "StaffTaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffTask_ownerId_status_dueAt_idx" ON "StaffTask"("ownerId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "StaffTask_status_dueAt_idx" ON "StaffTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "StaffTask_createdAt_idx" ON "StaffTask"("createdAt");

-- CreateIndex
CREATE INDEX "StaffTask_domain_createdAt_idx" ON "StaffTask"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "StaffTask_typeId_createdAt_idx" ON "StaffTask"("typeId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffTask_customerId_createdAt_idx" ON "StaffTask"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffTask_entity_entityId_idx" ON "StaffTask"("entity", "entityId");

-- CreateIndex
CREATE INDEX "StaffTask_contactPhone_idx" ON "StaffTask"("contactPhone");

-- CreateIndex
CREATE INDEX "StaffTask_parentId_idx" ON "StaffTask"("parentId");

-- CreateIndex
CREATE INDEX "StaffTaskNote_taskId_createdAt_idx" ON "StaffTaskNote"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffTaskNote_authorId_createdAt_idx" ON "StaffTaskNote"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "StaffTaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StaffTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTaskNote" ADD CONSTRAINT "StaffTaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "StaffTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

