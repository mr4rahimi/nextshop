-- ابزارها: پاپ‌آپ — docs/features/tools.md بخش ۹
-- افزایشی؛ هیچ جدول موجودی دست نمی‌خورد.
-- CreateEnum
CREATE TYPE "ToolPopupKind" AS ENUM ('ANNOUNCE', 'LEAD');

-- CreateTable
CREATE TABLE "ToolPopup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ToolPopupKind" NOT NULL DEFAULT 'ANNOUNCE',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "trigger" TEXT NOT NULL DEFAULT 'DELAY',
    "triggerValue" INTEGER NOT NULL DEFAULT 8,
    "pages" TEXT NOT NULL DEFAULT 'ALL',
    "paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "device" TEXT NOT NULL DEFAULT 'ALL',
    "frequency" TEXT NOT NULL DEFAULT 'DAY',
    "position" TEXT NOT NULL DEFAULT 'AUTO',
    "accent" TEXT NOT NULL DEFAULT '#2563eb',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "closeCount" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ToolPopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopupLead" (
    "id" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PopupLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolPopup_isActive_deletedAt_idx" ON "ToolPopup"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "PopupLead_createdAt_idx" ON "PopupLead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PopupLead_popupId_phone_key" ON "PopupLead"("popupId", "phone");

-- AddForeignKey
ALTER TABLE "PopupLead" ADD CONSTRAINT "PopupLead_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "ToolPopup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

