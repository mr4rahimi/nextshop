-- AlterTable
ALTER TABLE "AccItem" ADD COLUMN     "attrKey" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "modelId" TEXT;

-- CreateTable
CREATE TABLE "AccItemGroup" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccItemGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccItemModel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "groupId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccAxis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccAxis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccAxisValue" (
    "id" TEXT NOT NULL,
    "axisId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccAxisValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccItemAttr" (
    "itemId" TEXT NOT NULL,
    "axisId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,

    CONSTRAINT "AccItemAttr_pkey" PRIMARY KEY ("itemId","axisId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccItemGroup_parentId_name_key" ON "AccItemGroup"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AccItemModel_title_key" ON "AccItemModel"("title");

-- CreateIndex
CREATE UNIQUE INDEX "AccAxis_name_key" ON "AccAxis"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccAxisValue_axisId_value_key" ON "AccAxisValue"("axisId", "value");

-- CreateIndex
CREATE INDEX "AccItemAttr_valueId_idx" ON "AccItemAttr"("valueId");

-- CreateIndex
CREATE INDEX "AccItem_groupId_idx" ON "AccItem"("groupId");

-- CreateIndex
CREATE INDEX "AccItem_modelId_idx" ON "AccItem"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "AccItem_modelId_attrKey_key" ON "AccItem"("modelId", "attrKey");

-- AddForeignKey
ALTER TABLE "AccItem" ADD CONSTRAINT "AccItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItem" ADD CONSTRAINT "AccItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AccItemModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItemGroup" ADD CONSTRAINT "AccItemGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccItemGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItemModel" ADD CONSTRAINT "AccItemModel_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccAxisValue" ADD CONSTRAINT "AccAxisValue_axisId_fkey" FOREIGN KEY ("axisId") REFERENCES "AccAxis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItemAttr" ADD CONSTRAINT "AccItemAttr_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AccItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItemAttr" ADD CONSTRAINT "AccItemAttr_axisId_fkey" FOREIGN KEY ("axisId") REFERENCES "AccAxis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItemAttr" ADD CONSTRAINT "AccItemAttr_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "AccAxisValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- دو محور رایج از روز اول — کسب‌وکار محور دیگری هم می‌سازد (جنس، طرح…)
INSERT INTO "AccAxis" (id, name, "sortOrder") VALUES ('axis_color', 'رنگ', 1), ('axis_size', 'سایز', 2)
  ON CONFLICT DO NOTHING;
