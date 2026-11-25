-- مرجوعی: دلیل روی برگشت از فروش و مهلت مرجوعی (فقط هشدار) — webhesab-parity.md بخش ۳۴.۱
ALTER TABLE "AccInvoice" ADD COLUMN "returnReason" TEXT;
ALTER TABLE "AccSettings" ADD COLUMN "returnWindowDays" INTEGER NOT NULL DEFAULT 0;
