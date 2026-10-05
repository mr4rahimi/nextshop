-- ابزارها: لینک کوتاه، کیوآر کد، لندینگ‌ساز، درخواست ثبت نظر — docs/features/tools.md
-- همه‌چیز افزایشی است؛ هیچ جدول موجودی بازنویسی نمی‌شود.
-- CreateEnum
CREATE TYPE "ShortLinkKind" AS ENUM ('MANUAL', 'QR');

-- CreateEnum
CREATE TYPE "ToolLandingStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReviewPlatform" AS ENUM ('NESHAN', 'BALAD', 'GOOGLE', 'SITE');

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "kind" "ShortLinkKind" NOT NULL DEFAULT 'MANUAL',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "botCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLinkClick" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "referrerHost" TEXT,

    CONSTRAINT "ShortLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "isDynamic" BOOLEAN NOT NULL DEFAULT false,
    "shortLinkId" TEXT,
    "style" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolLanding" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ToolLandingStatus" NOT NULL DEFAULT 'DRAFT',
    "theme" JSONB NOT NULL,
    "draftBlocks" JSONB NOT NULL,
    "publishedBlocks" JSONB,
    "publishedTheme" JSONB,
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ToolLanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequestSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "neshanUrl" TEXT,
    "baladUrl" TEXT,
    "googleUrl" TEXT,
    "platformOrder" JSONB NOT NULL DEFAULT '["NESHAN","BALAD","GOOGLE"]',
    "askProducts" BOOLEAN NOT NULL DEFAULT true,
    "patternCode" TEXT,
    "linkMode" TEXT NOT NULL DEFAULT 'VARIABLE',
    "triggerStatus" TEXT NOT NULL DEFAULT 'DELIVERED',
    "delayHours" INTEGER NOT NULL DEFAULT 24,
    "sendFrom" INTEGER NOT NULL DEFAULT 10,
    "sendTo" INTEGER NOT NULL DEFAULT 20,
    "cooldownDays" INTEGER NOT NULL DEFAULT 90,
    "pageTitle" TEXT,
    "pageMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequestSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewPlatformClick" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "platform" "ReviewPlatform" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPlatformClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE INDEX "ShortLink_kind_deletedAt_createdAt_idx" ON "ShortLink"("kind", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ShortLinkClick_linkId_at_idx" ON "ShortLinkClick"("linkId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_shortLinkId_key" ON "QrCode"("shortLinkId");

-- CreateIndex
CREATE INDEX "QrCode_deletedAt_createdAt_idx" ON "QrCode"("deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolLanding_slug_key" ON "ToolLanding"("slug");

-- CreateIndex
CREATE INDEX "ToolLanding_deletedAt_updatedAt_idx" ON "ToolLanding"("deletedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_orderId_key" ON "ReviewRequest"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_token_key" ON "ReviewRequest"("token");

-- CreateIndex
CREATE INDEX "ReviewRequest_status_dueAt_idx" ON "ReviewRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ReviewRequest_phone_sentAt_idx" ON "ReviewRequest"("phone", "sentAt");

-- CreateIndex
CREATE INDEX "ReviewPlatformClick_platform_at_idx" ON "ReviewPlatformClick"("platform", "at");

-- CreateIndex
CREATE INDEX "ReviewPlatformClick_requestId_idx" ON "ReviewPlatformClick"("requestId");

-- AddForeignKey
ALTER TABLE "ShortLinkClick" ADD CONSTRAINT "ShortLinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPlatformClick" ADD CONSTRAINT "ReviewPlatformClick_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReviewRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

