-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "walletEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "walletBalance" BIGINT NOT NULL DEFAULT 0;
