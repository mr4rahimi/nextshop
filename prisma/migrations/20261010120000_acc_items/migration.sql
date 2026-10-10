-- CreateTable
CREATE TABLE "AccItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'عدد',
    "salePrice" BIGINT,
    "reorderPoint" INTEGER,
    "sellOnline" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccItemBarcode" (
    "barcode" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "AccItemBarcode_pkey" PRIMARY KEY ("barcode")
);

-- CreateTable
CREATE TABLE "AccItemAlias" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'کد قبلی',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccItemAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccItem_code_key" ON "AccItem"("code");

-- CreateIndex
CREATE INDEX "AccItem_title_idx" ON "AccItem"("title");

-- CreateIndex
CREATE INDEX "AccItem_isActive_idx" ON "AccItem"("isActive");

-- CreateIndex
CREATE INDEX "AccItemBarcode_itemId_idx" ON "AccItemBarcode"("itemId");

-- CreateIndex
CREATE INDEX "AccItemAlias_code_idx" ON "AccItemAlias"("code");

-- CreateIndex
CREATE INDEX "AccItemAlias_itemId_idx" ON "AccItemAlias"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AccItemAlias_source_code_key" ON "AccItemAlias"("source", "code");

-- AddForeignKey
ALTER TABLE "AccItemBarcode" ADD CONSTRAINT "AccItemBarcode_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AccItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccItemAlias" ADD CONSTRAINT "AccItemAlias_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AccItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── کالای حسابداری جدا از محصول — docs/plans/inventory-items.md فاز ۱ ──
--
-- هر Product یک AccItem با همان id دارد (تصمیم ۲): ستون‌های productId جدول‌های
-- Acc* دست نمی‌خورند. تریگر روی Product کالای محصول تازه را می‌سازد؛ هیچ خطایی
-- در آن ساخت محصول را نمی‌شکند (فقط WARNING) و acc_ensure_item در مسیرهای
-- حسابداری پشتیبان است.

-- کد: trim، ارقام فارسی/عربی ← لاتین، حروف بزرگ — آینه‌ی normalizeItemCode
CREATE OR REPLACE FUNCTION acc_norm_code(c text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(upper(btrim(translate(c, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))), '')
$$;

CREATE SEQUENCE IF NOT EXISTS acc_item_code_seq START 1001;

-- کد خودکار بعدی که نه کد کالایی است نه کد قبلی کالایی
CREATE OR REPLACE FUNCTION acc_next_item_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE c text;
BEGIN
  LOOP
    c := nextval('acc_item_code_seq')::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM "AccItem" WHERE code = c)
          AND NOT EXISTS (SELECT 1 FROM "AccItemAlias" WHERE code = c);
  END LOOP;
  RETURN c;
END $$;

-- پیش‌نمایش کد خودکار بعدی بی‌آنکه شمارنده جلو برود (جای خالی فرم)
CREATE OR REPLACE FUNCTION acc_peek_item_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE n bigint; c text;
BEGIN
  SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END INTO n FROM acc_item_code_seq;
  LOOP
    c := n::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM "AccItem" WHERE code = c)
          AND NOT EXISTS (SELECT 1 FROM "AccItemAlias" WHERE code = c);
    n := n + 1;
  END LOOP;
  RETURN c;
END $$;

-- کالای محصول — اگر نیست. کد = sku محصول اگر یکتا باشد، وگرنه خودکار.
CREATE OR REPLACE FUNCTION acc_ensure_item(pid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p RECORD;
  c text;
  b text;
  tries int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM "AccItem" WHERE id = pid) THEN RETURN; END IF;
  SELECT id, title, sku, gtin13 INTO p FROM "Product" WHERE id = pid;
  IF NOT FOUND THEN RETURN; END IF;
  c := acc_norm_code(p.sku);
  LOOP
    IF c IS NULL OR EXISTS (SELECT 1 FROM "AccItem" WHERE code = c) THEN c := acc_next_item_code(); END IF;
    BEGIN
      INSERT INTO "AccItem" (id, code, title, "updatedAt") VALUES (p.id, c, p.title, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 5 THEN RAISE; END IF;
      c := NULL;
    END;
  END LOOP;
  b := acc_norm_code(p.gtin13);
  IF b IS NOT NULL THEN
    INSERT INTO "AccItemBarcode" (barcode, "itemId") VALUES (b, p.id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION acc_item_from_product() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE b text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM acc_ensure_item(NEW.id);
    ELSE
      -- عنوان کالا تا وقتی دستی عوض نشده دنبال عنوان محصول می‌رود
      IF NEW.title IS DISTINCT FROM OLD.title THEN
        UPDATE "AccItem" SET title = NEW.title, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = NEW.id AND title = OLD.title;
      END IF;
      b := acc_norm_code(NEW.gtin13);
      IF b IS NOT NULL AND b IS DISTINCT FROM acc_norm_code(OLD.gtin13) THEN
        INSERT INTO "AccItemBarcode" (barcode, "itemId")
          SELECT b, NEW.id WHERE EXISTS (SELECT 1 FROM "AccItem" WHERE id = NEW.id)
          ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- ساخت/ویرایش محصول در سایت هرگز به‌خاطر حسابداری نمی‌شکند
    RAISE WARNING 'acc_item_from_product(%): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

CREATE TRIGGER acc_item_from_product_ins AFTER INSERT ON "Product"
  FOR EACH ROW EXECUTE FUNCTION acc_item_from_product();
CREATE TRIGGER acc_item_from_product_upd AFTER UPDATE OF title, gtin13 ON "Product"
  FOR EACH ROW EXECUTE FUNCTION acc_item_from_product();

-- پر کردن: محصول‌های موجود، قدیمی‌تر اول (کد خودکار به ترتیب ساخت)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM "Product" ORDER BY "createdAt", id LOOP
    PERFORM acc_ensure_item(r.id);
  END LOOP;
  -- کالای محصولِ حذف‌شده که در کاردکس یا فاکتور مانده — عنوان از آخرین ردیف فاکتور
  FOR r IN
    SELECT u.pid FROM (
      SELECT "productId" AS pid FROM "AccStockMove"
      UNION SELECT "productId" FROM "AccStock"
      UNION SELECT "productId" FROM "AccProductCost"
      UNION SELECT "productId" FROM "AccInvoiceLine" WHERE "productId" IS NOT NULL
      UNION SELECT "productId" FROM "AccTransferLine"
      UNION SELECT "productId" FROM "AccStockCountLine"
    ) u WHERE NOT EXISTS (SELECT 1 FROM "AccItem" i WHERE i.id = u.pid)
  LOOP
    INSERT INTO "AccItem" (id, code, title, "isActive", "sellOnline", "updatedAt")
    VALUES (
      r.pid, acc_next_item_code(),
      COALESCE((SELECT title FROM "AccInvoiceLine" WHERE "productId" = r.pid ORDER BY id DESC LIMIT 1), 'کالای حذف‌شده'),
      false, false, CURRENT_TIMESTAMP
    );
  END LOOP;
END $$;
