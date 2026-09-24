-- حسابداری — فاز ۰: حالت حسابداری و صف رویداد مالی
-- (docs/plans/accounting.md بخش ۴ و ۲۰)
--
-- همه افزودنی. سایتی که اتصال حسابان دارد با حالت HESABAN شروع می‌کند تا
-- فاکتور خودکارش بدون هیچ اقدامی مثل قبل ادامه پیدا کند (تله‌ی ۱).
-- رویدادهای سفارش‌های باز را worker در اولین چرخه خودش می‌سازد
-- (reconcileSaleEvents)؛ سفارش‌های فاکتورشده‌ی قبلی رویداد نمی‌گیرند.

CREATE TYPE "AccMode" AS ENUM ('NONE', 'HESABAN', 'INTERNAL');
CREATE TYPE "AccEventStatus" AS ENUM ('PENDING', 'DONE', 'BLOCKED', 'FAILED', 'SKIPPED');

CREATE TABLE "AccSettings" (
  "id"            TEXT NOT NULL DEFAULT 'singleton',
  "mode"          "AccMode" NOT NULL DEFAULT 'NONE',
  "modeChangedAt" TIMESTAMP(3),
  "modeChangedBy" TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccEvent" (
  "id"            TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId"   TEXT NOT NULL,
  "dedupeKey"     TEXT NOT NULL,
  "payload"       JSONB NOT NULL DEFAULT '{}',
  "status"        "AccEventStatus" NOT NULL DEFAULT 'PENDING',
  "mode"          "AccMode",
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil"   TIMESTAMP(3),
  "lastError"     TEXT,
  "blockedReason" TEXT,
  "resultRef"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "processedAt"   TIMESTAMP(3),
  CONSTRAINT "AccEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccEvent_dedupeKey_key" ON "AccEvent"("dedupeKey");
CREATE INDEX "AccEvent_status_nextAttemptAt_idx" ON "AccEvent"("status", "nextAttemptAt");
CREATE INDEX "AccEvent_aggregateType_aggregateId_idx" ON "AccEvent"("aggregateType", "aggregateId");
CREATE INDEX "AccEvent_createdAt_idx" ON "AccEvent"("createdAt");

INSERT INTO "AccSettings" ("id", "mode", "modeChangedAt", "modeChangedBy", "updatedAt")
SELECT 'singleton',
       CASE WHEN EXISTS (SELECT 1 FROM "IntegConnection" WHERE "platformCode" = 'hesaban')
            THEN 'HESABAN'::"AccMode" ELSE 'NONE'::"AccMode" END,
       CURRENT_TIMESTAMP, 'مهاجرت ۲.۵۳.۰', CURRENT_TIMESTAMP;
