-- سئو، محتوا و لینک‌سازی — فاز ۰ (docs/plans/seo-marketing.md)
--
-- ⚠️ مایگریشن عمداً **یک‌جا و کامل** است، نه فاز به فاز. ستون‌های فازهای بعد
-- (`contentTaskId`، `cost`، `weeklyQuota`، `reviewAt`) از همین حالا با مقدار
-- خالی ساخته می‌شوند؛ یازده مایگریشن پشت سر هم روی دیتابیس زنده یازده بار
-- ریسک است.
--
-- هیچ جدول یا ستون موجودی دست نمی‌خورد جز دو افزودنِ بی‌خطر:
-- سه عضو تازه در `ActivityEntity` و ستون `ContentTask.blogPostId` که به
-- `BlogPost` ارجاع می‌دهد (حذف مقاله فقط ارجاع را خالی می‌کند، کار را نه).

-- CreateEnum
CREATE TYPE "MarketingEventAction" AS ENUM ('CREATED', 'ASSIGNED', 'STARTED', 'REPORTED', 'PUBLISHING', 'SUBMITTED', 'APPROVED', 'RETURNED', 'CANCELED', 'REOPENED', 'FAILED', 'LOST', 'REVIEWED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SeoTaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "SeoReviewOutcome" AS ENUM ('EFFECTIVE', 'PARTIAL', 'INEFFECTIVE');

-- CreateEnum
CREATE TYPE "SeoRecurrenceUnit" AS ENUM ('WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "ContentTaskStatus" AS ENUM ('ASSIGNED', 'WRITING', 'AWAITING_PUBLISH', 'PUBLISHING', 'AWAITING_APPROVAL', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ContentDestination" AS ENUM ('BLOG', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "LinkCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "LinkNodeStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'LIVE', 'FAILED', 'LOST');

-- CreateEnum
CREATE TYPE "LinkAnchorKind" AS ENUM ('EXACT', 'PARTIAL', 'BRAND', 'BRAND_KEYWORD', 'NAKED_URL', 'GENERIC', 'IMAGE');

-- CreateEnum
CREATE TYPE "LinkContentKind" AS ENUM ('NONE', 'TEXT', 'IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "StaffNotificationType" AS ENUM ('SEO_TASK', 'CONTENT_TASK', 'LINK_NODE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntity" ADD VALUE 'SEO_TASK';
ALTER TYPE "ActivityEntity" ADD VALUE 'CONTENT_TASK';
ALTER TYPE "ActivityEntity" ADD VALUE 'LINK_NODE';

-- CreateTable
CREATE TABLE "SeoTaskCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoTaskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTask" (
    "id" TEXT NOT NULL,
    "code" SERIAL NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pageUrls" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "status" "SeoTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "priority" "StaffPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "report" TEXT,
    "returnReason" TEXT,
    "cancelReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "reviewAt" TIMESTAMP(3),
    "reviewOutcome" "SeoReviewOutcome",
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewRemindedAt" TIMESTAMP(3),
    "recurrenceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "doneByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoTaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTaskFile" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoTaskFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" "MarketingEventAction" NOT NULL,
    "fromStatus" "SeoTaskStatus",
    "toStatus" "SeoTaskStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRecurringTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "pageUrls" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT NOT NULL,
    "priority" "StaffPriority" NOT NULL DEFAULT 'NORMAL',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "unit" "SeoRecurrenceUnit" NOT NULL DEFAULT 'MONTH',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "dueOffsetDays" INTEGER,
    "reviewOffsetDays" INTEGER,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoRecurringTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTask" (
    "id" TEXT NOT NULL,
    "code" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "primaryKeyword" TEXT,
    "relatedKeywords" TEXT,
    "brief" TEXT,
    "destination" "ContentDestination" NOT NULL DEFAULT 'BLOG',
    "writerId" TEXT,
    "writerName" TEXT NOT NULL,
    "publisherId" TEXT,
    "publisherName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "status" "ContentTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "priority" "StaffPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "body" TEXT,
    "wordCount" INTEGER,
    "blogPostId" TEXT,
    "publishedUrl" TEXT,
    "returnReason" TEXT,
    "cancelReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTaskFile" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTaskFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" "MarketingEventAction" NOT NULL,
    "fromStatus" "ContentTaskStatus",
    "toStatus" "ContentTaskStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkType" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "seoNote" TEXT,
    "sampleSites" TEXT,
    "defaultContentKind" "LinkContentKind" NOT NULL DEFAULT 'NONE',
    "defaultUgc" BOOLEAN NOT NULL DEFAULT false,
    "defaultSponsored" BOOLEAN NOT NULL DEFAULT false,
    "isRisky" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkPlatform" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "accountNote" TEXT,
    "iconPath" TEXT,
    "domainAuthority" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "status" "LinkCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "weeklyQuota" INTEGER,
    "anchorProfile" TEXT NOT NULL DEFAULT 'ECOMMERCE',
    "isPristine" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkTarget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "primaryKeyword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkNode" (
    "id" TEXT NOT NULL,
    "code" SERIAL NOT NULL,
    "campaignId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "platformId" TEXT,
    "note" TEXT,
    "anchorText" TEXT,
    "anchorKind" "LinkAnchorKind",
    "relFollow" BOOLEAN NOT NULL DEFAULT true,
    "relUgc" BOOLEAN NOT NULL DEFAULT false,
    "relSponsored" BOOLEAN NOT NULL DEFAULT false,
    "contentKind" "LinkContentKind" NOT NULL DEFAULT 'NONE',
    "wordCount" INTEGER,
    "contentBrief" TEXT,
    "profileTitle" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "status" "LinkNodeStatus" NOT NULL DEFAULT 'PLANNED',
    "dueAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "cost" BIGINT,
    "contentTaskId" TEXT,
    "tier" INTEGER,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "liveAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "failReason" TEXT,
    "returnReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkEdge" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT,
    "toTargetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkNodeEvent" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" "MarketingEventAction" NOT NULL,
    "fromStatus" "LinkNodeStatus",
    "toStatus" "LinkNodeStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkNodeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StaffNotificationType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoTaskCategory_key_key" ON "SeoTaskCategory"("key");

-- CreateIndex
CREATE INDEX "SeoTaskCategory_isActive_sortOrder_idx" ON "SeoTaskCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SeoTask_assigneeId_status_idx" ON "SeoTask"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "SeoTask_status_dueAt_idx" ON "SeoTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "SeoTask_categoryId_createdAt_idx" ON "SeoTask"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoTask_reviewAt_reviewOutcome_idx" ON "SeoTask"("reviewAt", "reviewOutcome");

-- CreateIndex
CREATE INDEX "SeoTask_createdAt_idx" ON "SeoTask"("createdAt");

-- CreateIndex
CREATE INDEX "SeoTaskChecklistItem_taskId_sortOrder_idx" ON "SeoTaskChecklistItem"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "SeoTaskFile_taskId_createdAt_idx" ON "SeoTaskFile"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoTaskEvent_taskId_createdAt_idx" ON "SeoTaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoTaskEvent_actorId_createdAt_idx" ON "SeoTaskEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoRecurringTask_isActive_nextRunAt_idx" ON "SeoRecurringTask"("isActive", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTask_blogPostId_key" ON "ContentTask"("blogPostId");

-- CreateIndex
CREATE INDEX "ContentTask_writerId_status_idx" ON "ContentTask"("writerId", "status");

-- CreateIndex
CREATE INDEX "ContentTask_publisherId_status_idx" ON "ContentTask"("publisherId", "status");

-- CreateIndex
CREATE INDEX "ContentTask_status_dueAt_idx" ON "ContentTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ContentTask_createdAt_idx" ON "ContentTask"("createdAt");

-- CreateIndex
CREATE INDEX "ContentTaskFile_taskId_createdAt_idx" ON "ContentTaskFile"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentTaskEvent_taskId_createdAt_idx" ON "ContentTaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentTaskEvent_actorId_createdAt_idx" ON "ContentTaskEvent"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkType_key_key" ON "LinkType"("key");

-- CreateIndex
CREATE INDEX "LinkType_isActive_sortOrder_idx" ON "LinkType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "LinkPlatform_isActive_sortOrder_idx" ON "LinkPlatform"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LinkPlatform_typeId_domain_key" ON "LinkPlatform"("typeId", "domain");

-- CreateIndex
CREATE INDEX "LinkCampaign_status_createdAt_idx" ON "LinkCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LinkTarget_campaignId_isActive_idx" ON "LinkTarget"("campaignId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LinkNode_contentTaskId_key" ON "LinkNode"("contentTaskId");

-- CreateIndex
CREATE INDEX "LinkNode_campaignId_status_idx" ON "LinkNode"("campaignId", "status");

-- CreateIndex
CREATE INDEX "LinkNode_assigneeId_status_idx" ON "LinkNode"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "LinkNode_typeId_createdAt_idx" ON "LinkNode"("typeId", "createdAt");

-- CreateIndex
CREATE INDEX "LinkNode_status_dueAt_idx" ON "LinkNode"("status", "dueAt");

-- CreateIndex
CREATE INDEX "LinkEdge_campaignId_idx" ON "LinkEdge"("campaignId");

-- CreateIndex
CREATE INDEX "LinkEdge_fromNodeId_idx" ON "LinkEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "LinkEdge_toNodeId_idx" ON "LinkEdge"("toNodeId");

-- CreateIndex
CREATE INDEX "LinkEdge_toTargetId_idx" ON "LinkEdge"("toTargetId");

-- CreateIndex
CREATE INDEX "LinkNodeEvent_nodeId_createdAt_idx" ON "LinkNodeEvent"("nodeId", "createdAt");

-- CreateIndex
CREATE INDEX "LinkNodeEvent_actorId_createdAt_idx" ON "LinkNodeEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_readAt_createdAt_idx" ON "StaffNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_type_entityId_idx" ON "StaffNotification"("type", "entityId");

-- AddForeignKey
ALTER TABLE "SeoTask" ADD CONSTRAINT "SeoTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeoTaskCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTask" ADD CONSTRAINT "SeoTask_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "SeoRecurringTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTaskChecklistItem" ADD CONSTRAINT "SeoTaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SeoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTaskFile" ADD CONSTRAINT "SeoTaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SeoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTaskEvent" ADD CONSTRAINT "SeoTaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SeoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoRecurringTask" ADD CONSTRAINT "SeoRecurringTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeoTaskCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTaskFile" ADD CONSTRAINT "ContentTaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTaskEvent" ADD CONSTRAINT "ContentTaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkPlatform" ADD CONSTRAINT "LinkPlatform_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LinkType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkTarget" ADD CONSTRAINT "LinkTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LinkCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkNode" ADD CONSTRAINT "LinkNode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LinkCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkNode" ADD CONSTRAINT "LinkNode_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LinkType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkNode" ADD CONSTRAINT "LinkNode_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LinkPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkNode" ADD CONSTRAINT "LinkNode_contentTaskId_fkey" FOREIGN KEY ("contentTaskId") REFERENCES "ContentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkEdge" ADD CONSTRAINT "LinkEdge_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LinkCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkEdge" ADD CONSTRAINT "LinkEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "LinkNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkEdge" ADD CONSTRAINT "LinkEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "LinkNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkEdge" ADD CONSTRAINT "LinkEdge_toTargetId_fkey" FOREIGN KEY ("toTargetId") REFERENCES "LinkTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkNodeEvent" ADD CONSTRAINT "LinkNodeEvent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "LinkNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- قیدهایی که Prisma نمی‌تواند بیانشان کند
-- ═══════════════════════════════════════════════════════════════════

-- یال **دقیقاً یکی** از مقصدها را دارد. این را zod هم می‌گیرد، ولی اسکریپت و
-- سید و ترمیم دستی از zod رد نمی‌شوند.
ALTER TABLE "LinkEdge"
  ADD CONSTRAINT "link_edge_single_destination"
  CHECK (("toNodeId" IS NOT NULL) <> ("toTargetId" IS NOT NULL));

-- گره به خودش لینک نمی‌دهد (محاسبه‌ی لایه را بی‌پایان می‌کند).
ALTER TABLE "LinkEdge"
  ADD CONSTRAINT "link_edge_no_self_loop"
  CHECK ("toNodeId" IS NULL OR "toNodeId" <> "fromNodeId");

-- یک یال تکراری بین دو نقطه فقط چارت را شلوغ می‌کند.
CREATE UNIQUE INDEX "link_edge_unique_to_node"
  ON "LinkEdge" ("fromNodeId", "toNodeId") WHERE "toNodeId" IS NOT NULL;
CREATE UNIQUE INDEX "link_edge_unique_to_target"
  ON "LinkEdge" ("fromNodeId", "toTargetId") WHERE "toTargetId" IS NOT NULL;
