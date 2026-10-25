-- عرضه‌کننده‌ی کالا — docs/plans/webhesab-parity.md بخش ۵ (افزایشی)
ALTER TABLE "AccItem" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "AccItem_supplierId_idx" ON "AccItem"("supplierId");
ALTER TABLE "AccItem" ADD CONSTRAINT "AccItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "AccParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
