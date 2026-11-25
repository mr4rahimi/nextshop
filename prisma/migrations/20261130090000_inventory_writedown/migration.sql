-- کاهش ارزش موجودی (اقل بها و خالص ارزش فروش) — webhesab-parity.md بخش ۳۴.۴
ALTER TYPE "AccSource" ADD VALUE 'INVENTORY_WRITEDOWN';
CREATE TABLE "AccInvValuation" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "sellCostBp" INTEGER NOT NULL,
  "staleDays" INTEGER NOT NULL,
  "staleDiscountBp" INTEGER NOT NULL,
  "total" BIGINT NOT NULL,
  "booked" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "voucherId" TEXT,
  "releasedThrough" DATE,
  "note" TEXT,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccInvValuation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccInvValuation_number_key" ON "AccInvValuation"("number");
CREATE INDEX "AccInvValuation_status_idx" ON "AccInvValuation"("status");
CREATE TABLE "AccInvValuationLine" (
  "id" TEXT NOT NULL,
  "valuationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "unitCost" BIGINT NOT NULL,
  "price" BIGINT NOT NULL,
  "expected" BIGINT NOT NULL,
  "nrv" BIGINT NOT NULL,
  "perUnit" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "daysIdle" INTEGER,
  CONSTRAINT "AccInvValuationLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccInvValuationLine_valuationId_idx" ON "AccInvValuationLine"("valuationId");
CREATE INDEX "AccInvValuationLine_itemId_idx" ON "AccInvValuationLine"("itemId");
ALTER TABLE "AccInvValuationLine" ADD CONSTRAINT "AccInvValuationLine_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "AccInvValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
