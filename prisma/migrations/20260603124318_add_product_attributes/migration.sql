-- CreateTable
CREATE TABLE "AttributeGroup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAttributeGroup" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attributeGroupId" TEXT NOT NULL,

    CONSTRAINT "CategoryAttributeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttributeGroup_isActive_idx" ON "AttributeGroup"("isActive");

-- CreateIndex
CREATE INDEX "AttributeGroup_sortOrder_idx" ON "AttributeGroup"("sortOrder");

-- CreateIndex
CREATE INDEX "Attribute_groupId_idx" ON "Attribute"("groupId");

-- CreateIndex
CREATE INDEX "Attribute_isFilterable_idx" ON "Attribute"("isFilterable");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_groupId_slug_key" ON "Attribute"("groupId", "slug");

-- CreateIndex
CREATE INDEX "AttributeValue_attributeId_idx" ON "AttributeValue"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_idx" ON "ProductAttribute"("productId");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeId_idx" ON "ProductAttribute"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeValueId_idx" ON "ProductAttribute"("attributeValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_productId_attributeId_key" ON "ProductAttribute"("productId", "attributeId");

-- CreateIndex
CREATE INDEX "CategoryAttributeGroup_categoryId_idx" ON "CategoryAttributeGroup"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryAttributeGroup_attributeGroupId_idx" ON "CategoryAttributeGroup"("attributeGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttributeGroup_categoryId_attributeGroupId_key" ON "CategoryAttributeGroup"("categoryId", "attributeGroupId");

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AttributeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttributeGroup" ADD CONSTRAINT "CategoryAttributeGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttributeGroup" ADD CONSTRAINT "CategoryAttributeGroup_attributeGroupId_fkey" FOREIGN KEY ("attributeGroupId") REFERENCES "AttributeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
