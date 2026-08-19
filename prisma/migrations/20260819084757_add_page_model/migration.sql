-- CreateEnum
CREATE TYPE "PageTemplate" AS ENUM ('DEFAULT', 'ABOUT', 'CONTACT', 'FAQ', 'LEGAL');

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "template" "PageTemplate" NOT NULL DEFAULT 'DEFAULT',
    "contentHtml" TEXT,
    "coverImage" TEXT,
    "blocks" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "showToc" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE INDEX "Page_isActive_sortOrder_idx" ON "Page"("isActive", "sortOrder");
