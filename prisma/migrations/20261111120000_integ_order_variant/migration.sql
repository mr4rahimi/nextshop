-- تنوع قلم سفارش بازارگاه — docs/integrations/create-products.md
ALTER TABLE "IntegOrder" ADD COLUMN "platformVariantId" TEXT;
ALTER TABLE "IntegOrder" ADD COLUMN "shopVariantId" TEXT;
