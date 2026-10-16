-- AlterTable
ALTER TABLE "IntegOrder" ADD COLUMN "orderedAt" TIMESTAMP(3),
ADD COLUMN "autoInvoice" BOOLEAN NOT NULL DEFAULT true;
