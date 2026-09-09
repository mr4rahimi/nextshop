-- CreateTable
CREATE TABLE "StaffTaskReferral" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "note" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTaskReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffTaskReferral_toId_seenAt_idx" ON "StaffTaskReferral"("toId", "seenAt");

-- CreateIndex
CREATE INDEX "StaffTaskReferral_toId_createdAt_idx" ON "StaffTaskReferral"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffTaskReferral_taskId_createdAt_idx" ON "StaffTaskReferral"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffTaskReferral" ADD CONSTRAINT "StaffTaskReferral_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "StaffTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

