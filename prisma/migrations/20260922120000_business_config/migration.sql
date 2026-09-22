-- تنظیم‌پذیری کسب‌وکار (docs/plans/business-config.md)
--
-- ⚠️ مایگریشن عمداً **یک‌جا** است، نه چهار مایگریشن پشت سر هم: چهار بار قفل
-- گرفتن روی جدول زنده، چهار بار ریسک. همه‌ی تغییرها افزودنی‌اند و هیچ ستون
-- یا جدول موجودی حذف یا بازنویسی نمی‌شود.
--
-- چهار موضوع:
--   ۱. روش ارسال و باربری قابل تنظیم — مهلت، پرداخت کرایه، دو کلید مصرف‌کننده
--   ۲. شماره‌ی مرجع عمومی روی کار — شماره‌ی فاکتور رسمی و امثالش
--   ۳. بازارگاه به‌عنوان بُعد گزارش، نه نتیجه
--   ۴. معامله‌ای که در سود می‌آید ولی پورسانت نمی‌سازد — تعمیرات

-- ── ۱. روش ارسال ────────────────────────────────────────────────
CREATE TYPE "ShippingFeePayer" AS ENUM ('COLLECT', 'PREPAID', 'FREE');

ALTER TABLE "ShippingMethod"
  ADD COLUMN "slaMinutes"    INTEGER,
  ADD COLUMN "feePayer"      "ShippingFeePayer" NOT NULL DEFAULT 'COLLECT',
  ADD COLUMN "useInWorklist" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "useInCheckout" BOOLEAN NOT NULL DEFAULT true;

-- ── ۲ و ۳. نوع کار و کار ────────────────────────────────────────
ALTER TABLE "StaffTaskType"
  ADD COLUMN "needsRef"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refLabel"         TEXT,
  ADD COLUMN "needsPlatform"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createsDeal"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dealNoCommission" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StaffTask"
  ADD COLUMN "refNo"    TEXT,
  ADD COLUMN "platform" TEXT;

-- گزارش «دیجی‌کالا چند روز از سی روز بروز شد» روی همین ایندکس می‌نشیند
CREATE INDEX "StaffTask_platform_occurredAt_idx" ON "StaffTask"("platform", "occurredAt");

-- ── ۴. معامله بدون پورسانت، و پیوندش به کار ─────────────────────
-- `taskId` یکتاست: مرز واقعیِ «هر کار حداکثر یک معامله» همین ایندکس است،
-- نه شمارش در کد. دو مسیر هم‌زمان که یک کار را ببندند، دومی P2002 می‌گیرد و
-- بی‌سروصدا رد می‌شود — همان الگوی `orderId`.
ALTER TABLE "StaffDeal"
  ADD COLUMN "noCommission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taskId"       TEXT;

CREATE UNIQUE INDEX "StaffDeal_taskId_key" ON "StaffDeal"("taskId");

ALTER TABLE "StaffDeal"
  ADD CONSTRAINT "StaffDeal_taskId_fkey" FOREIGN KEY ("taskId")
  REFERENCES "StaffTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── تنظیمات ─────────────────────────────────────────────────────
ALTER TABLE "StoreSettings"
  ADD COLUMN "worklistPlatforms" JSONB NOT NULL DEFAULT '[]';
