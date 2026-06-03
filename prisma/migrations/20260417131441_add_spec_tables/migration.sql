-- CreateTable
CREATE TABLE "SpecGroup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecGroup_isActive_idx" ON "SpecGroup"("isActive");

-- CreateIndex
CREATE INDEX "SpecItem_groupId_idx" ON "SpecItem"("groupId");

-- AddForeignKey
ALTER TABLE "SpecItem" ADD CONSTRAINT "SpecItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SpecGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
