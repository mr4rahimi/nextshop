-- CreateTable
CREATE TABLE "ProductRelated" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductRelated_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRelated_productId_idx" ON "ProductRelated"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelated_productId_relatedId_key" ON "ProductRelated"("productId", "relatedId");

-- AddForeignKey
ALTER TABLE "ProductRelated" ADD CONSTRAINT "ProductRelated_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelated" ADD CONSTRAINT "ProductRelated_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
