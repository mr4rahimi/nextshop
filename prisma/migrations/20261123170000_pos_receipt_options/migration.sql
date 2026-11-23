-- رسید صندوق: عنوان جدا، QR پایین رسید، نمایش نام فروشنده/صندوقدار (افزایشی) — docs/plans/inventory-items.md بخش ۱۳.۴
ALTER TABLE "AccPosTerminal" ADD COLUMN "receiptTitle" TEXT;
ALTER TABLE "AccPosTerminal" ADD COLUMN "receiptQr" TEXT;
ALTER TABLE "AccPosTerminal" ADD COLUMN "receiptQrCaption" TEXT;
ALTER TABLE "AccPosTerminal" ADD COLUMN "receiptShowStaff" BOOLEAN NOT NULL DEFAULT false;
