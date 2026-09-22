-- خرید اعتباری و یادآوری موعد پرداخت — فاز ۱۰
-- (docs/features/staff-worklist.md بخش ۲۴)
--
-- ⚠️ **وضعیت تازه‌ی سفارش ساخته نمی‌شود.** تصمیم بخش ۲۴.۳: زنجیره‌ی ارسال و
-- بسته‌بندی به وضعیت‌های فعلی وصل است و افزودن `CREDIT_OPEN` یعنی هر جای آن
-- زنجیره باید بازبینی شود. به‌جایش، سفارش اعتباری وضعیت عادی خودش را دارد و
-- سیستم‌هایی که «پول رسیده» را می‌سنجند، **شرط موعد باز** را چک می‌کنند.
--
-- همه‌ی تغییرها افزودنی‌اند. `Order.paymentTerm` پیش‌فرض `CASH` دارد، پس
-- هر سفارش موجود دقیقاً همان رفتار قبلی‌اش را نگه می‌دارد.

CREATE TYPE "OrderPaymentTerm" AS ENUM ('CASH', 'CREDIT');
CREATE TYPE "CreditInstallmentStatus" AS ENUM ('DUE', 'PAID', 'CANCELED');

ALTER TABLE "Order"
  ADD COLUMN "paymentTerm" "OrderPaymentTerm" NOT NULL DEFAULT 'CASH';

CREATE INDEX "Order_paymentTerm_status_idx" ON "Order"("paymentTerm", "status");

CREATE TABLE "OrderCreditInstallment" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "seq"             INTEGER NOT NULL,
  "dueDate"         DATE NOT NULL,
  "amount"          BIGINT NOT NULL,
  "status"          "CreditInstallmentStatus" NOT NULL DEFAULT 'DUE',
  "paidAt"          TIMESTAMP(3),
  "paidAmount"      BIGINT,
  "paidNote"        TEXT,
  "confirmedById"   TEXT,
  "confirmedByName" TEXT,
  "reminderSentAt"  TIMESTAMP(3),
  "followUpTaskId"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderCreditInstallment_pkey" PRIMARY KEY ("id")
);

-- یکتاییِ «قسط چندمِ کدام سفارش» — مرز واقعیِ ساخت دوباره‌ی همان قسط
CREATE UNIQUE INDEX "OrderCreditInstallment_orderId_seq_key"
  ON "OrderCreditInstallment"("orderId", "seq");

-- چرخه‌ی زمان‌بند هر ده دقیقه دقیقاً روی همین ایندکس می‌نشیند
CREATE INDEX "OrderCreditInstallment_status_dueDate_idx"
  ON "OrderCreditInstallment"("status", "dueDate");

ALTER TABLE "OrderCreditInstallment"
  ADD CONSTRAINT "OrderCreditInstallment_orderId_fkey" FOREIGN KEY ("orderId")
  REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
