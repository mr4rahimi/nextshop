-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'PACKAGING';
ALTER TYPE "OrderStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "note" TEXT,
ADD COLUMN     "trackingCode" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "senderAddress" TEXT,
ADD COLUMN     "senderCity" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "senderPhone" TEXT,
ADD COLUMN     "senderPostalCode" TEXT,
ADD COLUMN     "senderProvince" TEXT,
ADD COLUMN     "storeLogo" TEXT,
ADD COLUMN     "storeName" TEXT;
