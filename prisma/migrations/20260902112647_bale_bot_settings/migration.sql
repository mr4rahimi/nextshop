-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "baleBotToken" TEXT,
ADD COLUMN     "baleBotUsername" TEXT,
ADD COLUMN     "baleBusinessApi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baleUpdateOffset" INTEGER,
ADD COLUMN     "baleWebhookSecret" TEXT;
