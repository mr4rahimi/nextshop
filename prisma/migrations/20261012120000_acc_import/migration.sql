-- AlterTable
ALTER TABLE "AccParty" ADD COLUMN     "externalCode" TEXT;

-- CreateIndex
CREATE INDEX "AccParty_externalCode_idx" ON "AccParty"("externalCode");

