-- سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳ (افزایشی)
CREATE TABLE "AccPurchaseOrder" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "partyId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "supplierRef" TEXT,
    "note" TEXT,
    "closedReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccPurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccPurchaseOrder_number_key" ON "AccPurchaseOrder"("number");
CREATE INDEX "AccPurchaseOrder_status_date_idx" ON "AccPurchaseOrder"("status", "date");
CREATE INDEX "AccPurchaseOrder_partyId_idx" ON "AccPurchaseOrder"("partyId");
ALTER TABLE "AccPurchaseOrder" ADD CONSTRAINT "AccPurchaseOrder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AccParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AccPurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "AccPurchaseOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccPurchaseOrderLine_orderId_idx" ON "AccPurchaseOrderLine"("orderId");
CREATE INDEX "AccPurchaseOrderLine_productId_idx" ON "AccPurchaseOrderLine"("productId");
ALTER TABLE "AccPurchaseOrderLine" ADD CONSTRAINT "AccPurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AccPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccInvoice" ADD COLUMN "purchaseOrderId" TEXT;
CREATE INDEX "AccInvoice_purchaseOrderId_idx" ON "AccInvoice"("purchaseOrderId");
ALTER TABLE "AccInvoiceLine" ADD COLUMN "poLineId" TEXT;
CREATE INDEX "AccInvoiceLine_poLineId_idx" ON "AccInvoiceLine"("poLineId");
