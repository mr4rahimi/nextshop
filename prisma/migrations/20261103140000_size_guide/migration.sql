-- راهنمای سایز پوشاک — docs/features/size-guide.md (افزایشی)
ALTER TABLE "StoreSettings" ADD COLUMN "sizeGuideEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ProductSizeChart" (
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'shirt',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "fit" TEXT,
    "sizing" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSizeChart_pkey" PRIMARY KEY ("productId")
);

ALTER TABLE "ProductSizeChart" ADD CONSTRAINT "ProductSizeChart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
