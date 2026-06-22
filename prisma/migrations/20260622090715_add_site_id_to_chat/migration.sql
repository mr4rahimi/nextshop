-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "ChatConversation_siteId_idx" ON "ChatConversation"("siteId");

-- CreateIndex
CREATE INDEX "ChatConversation_siteId_userId_idx" ON "ChatConversation"("siteId", "userId");
