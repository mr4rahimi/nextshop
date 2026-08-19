-- AlterEnum
ALTER TYPE "IntegJobType" ADD VALUE 'CREATE_INVOICE';

-- AlterEnum
ALTER TYPE "IntegOrderStatus" ADD VALUE 'NEEDS_MAPPING';

-- AlterTable
ALTER TABLE "IntegOrder" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "platformOrderNo" TEXT;

-- AlterTable
ALTER TABLE "IntegPlatformProduct" ADD COLUMN     "discountEndsAt" TIMESTAMP(3),
ADD COLUMN     "discountPercent" DOUBLE PRECISION,
ADD COLUMN     "discountStartsAt" TIMESTAMP(3),
ADD COLUMN     "discountStock" INTEGER,
ADD COLUMN     "originalPrice" DOUBLE PRECISION;
