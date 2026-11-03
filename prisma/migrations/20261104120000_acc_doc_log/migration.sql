-- دفتر ابطال و ویرایش اسناد — docs/plans/webhesab-parity.md بخش ۱۵ (افزایشی)
CREATE TABLE "AccDocLog" (
    "id" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "kind" TEXT,
    "number" INTEGER,
    "docDate" DATE NOT NULL,
    "partyName" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "totalBefore" BIGINT,
    "totalAfter" BIGINT,
    "changes" JSONB,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "approx" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccDocLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccDocLog_createdAt_idx" ON "AccDocLog"("createdAt");
CREATE INDEX "AccDocLog_docType_docId_idx" ON "AccDocLog"("docType", "docId");
CREATE INDEX "AccDocLog_action_createdAt_idx" ON "AccDocLog"("action", "createdAt");

-- سندهای باطلِ قبلی — دلیل به شکل «دلیل — نام کاربر» ذخیره شده بود
INSERT INTO "AccDocLog" ("id", "docType", "docId", "kind", "number", "docDate", "partyName", "action", "reason", "totalBefore", "actorName", "approx", "createdAt")
SELECT 'bf-inv-' || i."id", 'AccInvoice', i."id", i."type"::TEXT, i."number", i."date", i."partyName", 'VOID',
       regexp_replace(COALESCE(i."voidReason", ''), ' — [^—]+$', ''), i."total",
       COALESCE(substring(i."voidReason" from ' — ([^—]+)$'), '—'), true, i."updatedAt"
FROM "AccInvoice" i WHERE i."status" = 'VOID';

INSERT INTO "AccDocLog" ("id", "docType", "docId", "kind", "number", "docDate", "partyName", "action", "reason", "totalBefore", "actorName", "approx", "createdAt")
SELECT 'bf-money-' || m."id", 'AccMoneyDoc', m."id", m."kind"::TEXT, m."number", m."date", p."name", 'VOID',
       regexp_replace(COALESCE(m."voidReason", ''), ' — [^—]+$', ''), m."total",
       COALESCE(substring(m."voidReason" from ' — ([^—]+)$'), '—'), true, m."updatedAt"
FROM "AccMoneyDoc" m LEFT JOIN "AccParty" p ON p."id" = m."partyId" WHERE m."status" = 'VOID';

INSERT INTO "AccDocLog" ("id", "docType", "docId", "number", "docDate", "action", "reason", "totalBefore", "actorName", "approx", "createdAt")
SELECT 'bf-voucher-' || v."id", 'AccVoucher', v."id", v."number", v."date", 'VOID',
       regexp_replace(COALESCE(v."voidReason", ''), ' — [^—]+$', ''), v."totalDebit",
       COALESCE(substring(v."voidReason" from ' — ([^—]+)$'), '—'), true, v."updatedAt"
FROM "AccVoucher" v WHERE v."status" = 'VOID' AND v."source" = 'MANUAL';

INSERT INTO "AccDocLog" ("id", "docType", "docId", "kind", "number", "docDate", "action", "reason", "actorName", "approx", "createdAt")
SELECT 'bf-adjust-' || a."id", 'AccStockAdjust', a."id", a."direction", a."number", a."date", 'VOID',
       regexp_replace(COALESCE(a."voidReason", ''), ' — [^—]+$', ''),
       COALESCE(substring(a."voidReason" from ' — ([^—]+)$'), '—'), true, a."createdAt"
FROM "AccStockAdjust" a WHERE a."status" = 'VOID';

INSERT INTO "AccDocLog" ("id", "docType", "docId", "number", "docDate", "action", "reason", "actorName", "approx", "createdAt")
SELECT 'bf-transfer-' || t."id", 'AccTransfer', t."id", t."number", t."date", 'VOID',
       regexp_replace(COALESCE(t."voidReason", ''), ' — [^—]+$', ''),
       COALESCE(substring(t."voidReason" from ' — ([^—]+)$'), '—'), true, t."createdAt"
FROM "AccTransfer" t WHERE t."status" = 'VOID';

INSERT INTO "AccDocLog" ("id", "docType", "docId", "number", "docDate", "action", "reason", "actorName", "approx", "createdAt")
SELECT 'bf-count-' || c."id", 'AccStockCount', c."id", c."number", c."date", 'VOID',
       regexp_replace(COALESCE(c."voidReason", ''), ' — [^—]+$', ''),
       COALESCE(substring(c."voidReason" from ' — ([^—]+)$'), '—'), true, c."updatedAt"
FROM "AccStockCount" c WHERE c."status" = 'VOID';
