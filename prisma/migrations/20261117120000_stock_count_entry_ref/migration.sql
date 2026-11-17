-- انبارگردانی: شناسه‌ی اسکن از دستگاه (صف بی‌اینترنت دو بار نشمارد) — افزایشی
ALTER TABLE "AccStockCountEntry" ADD COLUMN "ref" TEXT;
CREATE UNIQUE INDEX "AccStockCountEntry_countId_ref_key" ON "AccStockCountEntry"("countId", "ref");
