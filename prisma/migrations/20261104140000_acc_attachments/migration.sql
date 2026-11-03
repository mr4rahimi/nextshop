-- پیوست مدارک به اسناد حسابداری — docs/plans/webhesab-parity.md بخش ۱۶ (افزایشی)
CREATE TABLE "AccAttachment" (
    "id" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedByName" TEXT,
    CONSTRAINT "AccAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccAttachment_path_key" ON "AccAttachment"("path");
CREATE INDEX "AccAttachment_docType_docId_idx" ON "AccAttachment"("docType", "docId");
CREATE INDEX "AccAttachment_createdAt_idx" ON "AccAttachment"("createdAt");
