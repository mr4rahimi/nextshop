-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "intro" TEXT,
    "bodyHtml" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_categoryId_idx" ON "LandingPage"("categoryId");

-- CreateIndex
CREATE INDEX "LandingPage_isActive_isIndexable_idx" ON "LandingPage"("isActive", "isIndexable");

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
