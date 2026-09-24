-- حسابداری — فاز ۴: فاکتورها (docs/plans/accounting.md بخش ۶.۶ و ۱۰)
-- فاکتور فروش/خرید/برگشتی/پیش‌فاکتور و ردیف‌ها، و کلید «مشمول ارزش افزوده». همه افزودنی.

-- CreateEnum
CREATE TYPE "AccInvoiceType" AS ENUM ('SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN', 'PROFORMA');

-- CreateEnum
CREATE TYPE "AccInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "AccProformaState" AS ENUM ('OPEN', 'CONVERTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AccChannel" AS ENUM ('SHOP', 'PHONE', 'MARKETPLACE', 'WORKLIST', 'MANUAL');

-- AlterTable
ALTER TABLE "AccSettings" ADD COLUMN     "vatEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AccInvoice" (
    "id" TEXT NOT NULL,
    "type" "AccInvoiceType" NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "status" "AccInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "proformaState" "AccProformaState",
    "validUntil" DATE,
    "partyId" TEXT NOT NULL,
    "channel" "AccChannel" NOT NULL DEFAULT 'MANUAL',
    "platformCode" TEXT,
    "orderId" TEXT,
    "sourceKey" TEXT,
    "refInvoiceId" TEXT,
    "convertedFromId" TEXT,
    "warehouseId" TEXT,
    "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false,
    "partyName" TEXT NOT NULL,
    "partyNationalId" TEXT,
    "partyEconomicCode" TEXT,
    "partyPostalCode" TEXT,
    "partyAddress" TEXT,
    "partyPhone" TEXT,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "lineDiscount" BIGINT NOT NULL DEFAULT 0,
    "invoiceDiscount" BIGINT NOT NULL DEFAULT 0,
    "additions" BIGINT NOT NULL DEFAULT 0,
    "additionsTitle" TEXT,
    "vatTotal" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "paidTotal" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "voucherId" TEXT,
    "voidReason" TEXT,
    "taxId" TEXT,
    "taxStatus" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "unit" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "invoiceDiscountShare" BIGINT NOT NULL DEFAULT 0,
    "vatRateBp" INTEGER NOT NULL DEFAULT 0,
    "vatAmount" BIGINT NOT NULL DEFAULT 0,
    "lineTotal" BIGINT NOT NULL,
    "accountId" TEXT,
    "refLineId" TEXT,
    "orderItemId" TEXT,
    "taxCode" TEXT,

    CONSTRAINT "AccInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccInvoice_sourceKey_key" ON "AccInvoice"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccInvoice_convertedFromId_key" ON "AccInvoice"("convertedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "AccInvoice_voucherId_key" ON "AccInvoice"("voucherId");

-- CreateIndex
CREATE INDEX "AccInvoice_partyId_date_idx" ON "AccInvoice"("partyId", "date");

-- CreateIndex
CREATE INDEX "AccInvoice_type_status_date_idx" ON "AccInvoice"("type", "status", "date");

-- CreateIndex
CREATE INDEX "AccInvoice_orderId_idx" ON "AccInvoice"("orderId");

-- CreateIndex
CREATE INDEX "AccInvoice_refInvoiceId_idx" ON "AccInvoice"("refInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccInvoice_yearId_type_number_key" ON "AccInvoice"("yearId", "type", "number");

-- CreateIndex
CREATE INDEX "AccInvoiceLine_invoiceId_idx" ON "AccInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "AccInvoiceLine_productId_idx" ON "AccInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "AccInvoiceLine_refLineId_idx" ON "AccInvoiceLine"("refLineId");

-- AddForeignKey
ALTER TABLE "AccInvoice" ADD CONSTRAINT "AccInvoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccInvoiceLine" ADD CONSTRAINT "AccInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AccInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

