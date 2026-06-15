-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "smsApiKey" TEXT,
ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsLineNumber" TEXT,
ADD COLUMN     "smsPatternOrderCancel" TEXT,
ADD COLUMN     "smsPatternOrderConfirm" TEXT,
ADD COLUMN     "smsPatternOrderDelivered" TEXT,
ADD COLUMN     "smsPatternOrderDone" TEXT,
ADD COLUMN     "smsPatternOrderNew" TEXT,
ADD COLUMN     "smsPatternOrderPack" TEXT,
ADD COLUMN     "smsPatternOrderPaid" TEXT,
ADD COLUMN     "smsPatternOrderPrepare" TEXT,
ADD COLUMN     "smsPatternOrderSent" TEXT,
ADD COLUMN     "smsPatternOtp" TEXT;
