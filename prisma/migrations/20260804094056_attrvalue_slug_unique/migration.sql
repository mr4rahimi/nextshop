/*
  Warnings:

  - A unique constraint covering the columns `[attributeId,slug]` on the table `AttributeValue` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AttributeValue_attributeId_slug_key" ON "AttributeValue"("attributeId", "slug");
