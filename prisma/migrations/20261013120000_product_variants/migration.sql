-- تنوع محصول — docs/plans/inventory-items.md فاز ۴. همه افزایشی؛ محصول بی‌تنوع
-- هیچ ردیفی نمی‌گیرد. ستون‌های تازه پیش‌فرض ثابت دارند (PG11+: بی بازنویسی جدول).


-- AlterTable
ALTER TABLE "AttributeValue" ADD COLUMN     "colorHex" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "variantKey" TEXT NOT NULL DEFAULT '';

-- یکتایی تازه‌ی سبد پیش از برداشتن قبلی — هیچ لحظه‌ای سبد بی‌قید نمی‌ماند.
-- داده‌ی موجود (variantKey = '') زیر قید قبلی یکتا بود، پس زیر این هم هست.
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantKey_key" ON "CartItem"("cartId", "productId", "variantKey");
DROP INDEX "CartItem_cartId_productId_key";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantTitleSnapshot" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "attributeValueId" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "variantsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "accItemId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "price" BIGINT,
    "salePrice" BIGINT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "optionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantAxis" (
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "display" TEXT NOT NULL DEFAULT 'CHIP',

    CONSTRAINT "ProductVariantAxis_pkey" PRIMARY KEY ("productId","attributeId")
);

-- CreateTable
CREATE TABLE "ProductVariantOption" (
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantOption_pkey" PRIMARY KEY ("variantId","attributeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_accItemId_key" ON "ProductVariant"("accItemId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_optionKey_key" ON "ProductVariant"("productId", "optionKey");

-- CreateIndex
CREATE INDEX "ProductVariantOption_attributeValueId_idx" ON "ProductVariantOption"("attributeValueId");


-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantAxis" ADD CONSTRAINT "ProductVariantAxis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOption" ADD CONSTRAINT "ProductVariantOption_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

