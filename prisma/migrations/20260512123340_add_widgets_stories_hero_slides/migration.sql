-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('STORY', 'HERO_SLIDER', 'CATEGORIES', 'AMAZING_DEALS', 'BEST_SELLERS', 'PRODUCTS_BY_CATEGORY', 'PRODUCTS_BY_BRAND', 'NEWEST_PRODUCTS', 'SPECIAL_OFFERS', 'LAST_VISITED', 'FULL_BANNER', 'DOUBLE_BANNER', 'CALL_TO_ACTION', 'IMAGE_CONTENT', 'IMAGE_CONTENT_DOUBLE', 'LATEST_ARTICLES');

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL,
    "type" "WidgetType" NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Widget_isActive_idx" ON "Widget"("isActive");

-- CreateIndex
CREATE INDEX "Widget_sortOrder_idx" ON "Widget"("sortOrder");

-- CreateIndex
CREATE INDEX "Story_isActive_idx" ON "Story"("isActive");

-- CreateIndex
CREATE INDEX "Story_sortOrder_idx" ON "Story"("sortOrder");

-- CreateIndex
CREATE INDEX "HeroSlide_isActive_idx" ON "HeroSlide"("isActive");

-- CreateIndex
CREATE INDEX "HeroSlide_sortOrder_idx" ON "HeroSlide"("sortOrder");
