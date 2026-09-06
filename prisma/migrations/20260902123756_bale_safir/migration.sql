-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "baleSafirEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baleSafirKey" TEXT;
