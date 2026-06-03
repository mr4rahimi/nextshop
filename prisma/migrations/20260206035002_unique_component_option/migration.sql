/*
  Warnings:

  - A unique constraint covering the columns `[componentTypeId,slug]` on the table `ComponentOption` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ComponentOption_componentTypeId_slug_key" ON "ComponentOption"("componentTypeId", "slug");
