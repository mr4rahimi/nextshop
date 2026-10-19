-- الگوی کد کالا، کد گروه/مدل، کد قبلی چندتنوعی و برچسب‌گذاری دوباره — همه افزایشی
ALTER TABLE "AccSettings" ADD COLUMN "itemCodePattern" TEXT NOT NULL DEFAULT '{N}';
ALTER TABLE "AccSettings" ADD COLUMN "labelConfig" JSONB;

ALTER TABLE "AccItemGroup" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "AccItemGroup_code_key" ON "AccItemGroup"("code");

ALTER TABLE "AccItemModel" ADD COLUMN "code" TEXT;
ALTER TABLE "AccItemModel" ADD COLUMN "nextVariant" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AccItemModel" ADD COLUMN "specs" JSONB;
CREATE UNIQUE INDEX "AccItemModel_code_key" ON "AccItemModel"("code");

CREATE TABLE "AccCodeCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AccCodeCounter_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AccLegacyItem" (
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'نرم‌افزار قبلی',
    "title" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "itemId" TEXT,
    "attrs" JSONB NOT NULL DEFAULT '[]',
    "legacyQty" INTEGER NOT NULL DEFAULT 0,
    "salePrice" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccLegacyItem_pkey" PRIMARY KEY ("code")
);
CREATE INDEX "AccLegacyItem_modelId_idx" ON "AccLegacyItem"("modelId");
ALTER TABLE "AccLegacyItem" ADD CONSTRAINT "AccLegacyItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AccItemModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccRelabelLog" (
    "id" TEXT NOT NULL,
    "legacyCode" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "byName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccRelabelLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccRelabelLog_legacyCode_idx" ON "AccRelabelLog"("legacyCode");
CREATE INDEX "AccRelabelLog_itemId_idx" ON "AccRelabelLog"("itemId");
ALTER TABLE "AccRelabelLog" ADD CONSTRAINT "AccRelabelLog_legacyCode_fkey" FOREIGN KEY ("legacyCode") REFERENCES "AccLegacyItem"("code") ON DELETE CASCADE ON UPDATE CASCADE;
