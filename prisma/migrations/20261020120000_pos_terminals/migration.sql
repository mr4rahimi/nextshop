-- صندوق فروشگاهی (۲.۹۵.۰) — docs/plans/inventory-items.md بخش ۱۳. همه افزایشی.
-- ⚠️ مقدار تازه‌ی AccSource (POS) در همین مهاجرت به کار نمی‌رود (تله‌ی ۲۳ حسابداری).

-- CreateEnum
CREATE TYPE "AccPosShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccPosTicketKind" AS ENUM ('SALE', 'RETURN', 'EXCHANGE');

-- AlterEnum
ALTER TYPE "AccSource" ADD VALUE 'POS';

-- CreateTable
CREATE TABLE "AccPosTerminal" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "cashTreasuryId" TEXT NOT NULL,
    "cardTreasuryId" TEXT,
    "roundTo" INTEGER NOT NULL DEFAULT 0,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT,
    "paperMm" INTEGER NOT NULL DEFAULT 80,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccPosTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccPosSeller" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "commissionBp" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccPosSeller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccPosShift" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "AccPosShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT,
    "openedByName" TEXT NOT NULL,
    "openingFloat" BIGINT NOT NULL DEFAULT 0,
    "openingBook" BIGINT NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "expectedCash" BIGINT,
    "countedCash" BIGINT,
    "cashDiff" BIGINT,
    "expectedCard" BIGINT,
    "countedCard" BIGINT,
    "keptFloat" BIGINT,
    "transferred" BIGINT,
    "transferToId" TEXT,
    "transferDocId" TEXT,
    "diffVoucherId" TEXT,
    "note" TEXT,

    CONSTRAINT "AccPosShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccPosTicket" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "yearId" TEXT NOT NULL,
    "kind" "AccPosTicketKind" NOT NULL,
    "terminalId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "sellerId" TEXT,
    "sellerName" TEXT,
    "cashierId" TEXT,
    "cashierName" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "saleInvoiceId" TEXT,
    "returnInvoiceId" TEXT,
    "receiptDocId" TEXT,
    "refundVoucherId" TEXT,
    "saleTotal" BIGINT NOT NULL DEFAULT 0,
    "returnTotal" BIGINT NOT NULL DEFAULT 0,
    "saleQty" INTEGER NOT NULL DEFAULT 0,
    "returnQty" INTEGER NOT NULL DEFAULT 0,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "cash" BIGINT NOT NULL DEFAULT 0,
    "card" BIGINT NOT NULL DEFAULT 0,
    "credit" BIGINT NOT NULL DEFAULT 0,
    "tendered" BIGINT,
    "change" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccPosTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccPosTerminal_code_key" ON "AccPosTerminal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccPosTerminal_name_key" ON "AccPosTerminal"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccPosSeller_code_key" ON "AccPosSeller"("code");

-- CreateIndex
CREATE INDEX "AccPosShift_terminalId_status_idx" ON "AccPosShift"("terminalId", "status");

-- CreateIndex
CREATE INDEX "AccPosShift_openedAt_idx" ON "AccPosShift"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccPosShift_terminalId_number_key" ON "AccPosShift"("terminalId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AccPosTicket_saleInvoiceId_key" ON "AccPosTicket"("saleInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccPosTicket_returnInvoiceId_key" ON "AccPosTicket"("returnInvoiceId");

-- CreateIndex
CREATE INDEX "AccPosTicket_shiftId_idx" ON "AccPosTicket"("shiftId");

-- CreateIndex
CREATE INDEX "AccPosTicket_terminalId_createdAt_idx" ON "AccPosTicket"("terminalId", "createdAt");

-- CreateIndex
CREATE INDEX "AccPosTicket_sellerId_createdAt_idx" ON "AccPosTicket"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "AccPosTicket_createdAt_idx" ON "AccPosTicket"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccPosTicket_yearId_number_key" ON "AccPosTicket"("yearId", "number");

-- AddForeignKey
ALTER TABLE "AccPosShift" ADD CONSTRAINT "AccPosShift_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "AccPosTerminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccPosTicket" ADD CONSTRAINT "AccPosTicket_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "AccPosTerminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccPosTicket" ADD CONSTRAINT "AccPosTicket_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AccPosShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccPosTicket" ADD CONSTRAINT "AccPosTicket_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "AccPosSeller"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- سرفصل: «کسری و اضافه‌ی صندوق» زیر «هزینه‌های اداری» (۸۲) — فقط اگر سرفصل ساخته شده و
-- کلید هنوز نیست. کد = اولین کد آزاد بعد از آخرین معین ۸۲ (کسب‌وکار ممکن است ۸۲۰۸ را
-- خودش ساخته باشد). `seedDefaultChart` در راه‌اندازی تازه خودش ۸۲۰۸ را می‌سازد.
INSERT INTO "AccAccount" ("id", "code", "name", "level", "parentId", "class", "nature", "detailKind", "systemKey")
SELECT 'acc_cash_over_short',
       '82' || LPAD((COALESCE((SELECT MAX(SUBSTRING(c."code" FROM 3)::int) FROM "AccAccount" c WHERE c."code" ~ '^82[0-9]{2}$'), 0) + 1)::text, 2, '0'),
       'کسری و اضافه‌ی صندوق', 'SUBLEDGER', p."id", 'EXPENSE', 'BOTH', 'NONE', 'CASH_OVER_SHORT'
FROM "AccAccount" p
WHERE p."code" = '82'
  AND NOT EXISTS (SELECT 1 FROM "AccAccount" WHERE "systemKey" = 'CASH_OVER_SHORT');
