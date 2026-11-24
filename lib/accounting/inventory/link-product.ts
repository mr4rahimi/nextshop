/**
 * وصل کردن کالای حسابداری به محصول سادهٔ موجود سایت — docs/integrations/mapping-page.md.
 *
 * در حالت حسابداری داخلی هر محصول ساده کالای هم‌شناسهٔ خودش را دارد (`acc_ensure_item`).
 * وقتی کالایی جدا (مثلاً از فاکتور خرید) ساخته شده و محصول سایت هم جدا وجود دارد، این دو
 * باید یکی شوند — شناسهٔ محصول عوض‌شدنی نیست، پس کالای جدا در کالای هم‌شناسهٔ محصول
 * **ادغام** می‌شود:
 *
 * - `absorb`  کالای محصول گردشی ندارد ← همهٔ ردیف‌های کالای جدا (کاردکس، فاکتور، موجودی، بها،
 *             بارکد…) به شناسهٔ محصول منتقل و کد و مشخصات کالای جدا روی آن نوشته می‌شود. بها
 *             و کاردکس دست‌نخورده می‌ماند.
 * - `alias`   کالای جدا گردشی ندارد ← بارکد و کدش کد قبلیِ کالای محصول می‌شود و خودش پاک می‌شود.
 * - `merge`   هر دو گردش دارند ← ردیف‌ها منتقل و کاردکس از اول بازسازی می‌شود؛ بهای تمام‌شده و
 *             سند منابعی که عوض شد دوباره ساخته می‌شود. سال بسته یا تاریخ قفل ← خطا.
 *
 * محصول تنوع‌دار و کالای مدل‌دار اینجا نمی‌آیند: کالای تنوع از «ساخت محصول» به تنوع اضافه می‌شود.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import type { Actor } from "../ledger/post";
import { ensureItems } from "./items";
import { itemUses, USE_LABEL, type UseKey } from "./retire";
import { rebuildItemFully } from "./stock";
// بازسازهای سند منبع با import ثبت می‌شوند (registerCostRebuilder)
import "../invoices/service";
import "./adjust";
import "./counts";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type LinkMode = "absorb" | "alias" | "merge";

export interface LinkPlan {
  mode: LinkMode;
  product: { id: string; title: string; sku: string | null; stock: number };
  productItem: { code: string; title: string; uses: string[] };
  item: { id: string; code: string; title: string; uses: string[]; qty: number };
  /** جمله‌های پیش‌نمایش برای کاربر */
  notes: string[];
}

const usesText = (u: UseKey[] | undefined) => (u ?? []).filter((k) => k !== "product").map((k) => USE_LABEL[k]);

async function sellableQty(db: Db, id: string) {
  const sellable = (await db.accWarehouse.findMany({ where: { sellable: true }, select: { id: true } })).map((w) => w.id);
  const r = await db.accStock.aggregate({ where: { productId: id, warehouseId: { in: sellable } }, _sum: { qty: true } });
  return r._sum.qty ?? 0;
}

/** پیش‌نمایش — چیزی نمی‌نویسد (کالای هم‌شناسهٔ نبوده را هم نمی‌سازد) */
export async function planLink(db: Db, productId: string, itemId: string): Promise<LinkPlan> {
  if (!productId || !itemId) throw new AccError("محصول و کالا را انتخاب کنید");
  if (productId === itemId) throw new AccError("این کالا همین حالا کالای همین محصول است", 409);

  const [product, variants, item, itemAsProduct, itemAsVariant] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { id: true, title: true, sku: true, stock: true } }),
    db.productVariant.count({ where: { productId } }),
    db.accItem.findUnique({ where: { id: itemId }, include: { model: { select: { title: true } } } }),
    db.product.findUnique({ where: { id: itemId }, select: { title: true } }),
    db.productVariant.findFirst({ where: { accItemId: itemId }, select: { title: true, product: { select: { title: true } } } }),
  ]);
  if (!product) throw new AccError("محصول پیدا نشد", 404);
  if (variants) throw new AccError("این محصول رنگ/سایز دارد؛ کالای هر تنوع را از «کالا و انبار ← ساخت محصول» به همان تنوع وصل کنید", 409);
  if (!item) throw new AccError("کالا پیدا نشد", 404);
  if (itemAsProduct) throw new AccError(`این کالا خودش کالای محصول «${itemAsProduct.title}» است`, 409);
  if (itemAsVariant) throw new AccError(`این کالا به تنوع «${itemAsVariant.title}» از «${itemAsVariant.product.title}» وصل است`, 409);
  if (item.modelId) throw new AccError(`این کالا یک تنوع از مدل «${item.model?.title ?? ""}» است؛ از «ساخت محصول» به محصول تنوع‌دار اضافه‌اش کنید`, 409);

  const own = await db.accItem.findUnique({ where: { id: productId }, select: { code: true, title: true } });
  const uses = await itemUses(db, [productId, itemId]);
  const pUses = usesText(uses.get(productId));
  const iUses = usesText(uses.get(itemId));
  const mode: LinkMode = pUses.length === 0 ? "absorb" : iUses.length === 0 ? "alias" : "merge";
  const qty = await sellableQty(db, itemId);

  const notes: string[] = [];
  if (mode === "absorb") {
    notes.push(`کد «${item.code}» و مشخصات کالا روی محصول می‌نشیند؛ کاردکس، فاکتورها و بهای خرید کالا از این به بعد مال محصول است.`);
    if (own) notes.push(`کد فعلی محصول («${own.code}») به‌عنوان کد قبلی می‌ماند و با آن هم پیدا می‌شود.`);
  } else if (mode === "alias") {
    notes.push(`کالای «${item.title}» گردشی ندارد؛ کد و بارکدش به محصول اضافه و خودش حذف می‌شود.`);
  } else {
    notes.push("هر دو گردش دارند: کاردکس دو کالا یکی و بهای تمام‌شده از اول حساب می‌شود؛ سند فاکتورهایی که بهایشان عوض شود دوباره ساخته می‌شود.");
    notes.push(`کد «${item.code}» کد قبلی محصول می‌شود.`);
  }
  const internal = (await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }))?.mode === "INTERNAL";
  if (internal && mode !== "alias") notes.push("موجودی سایت با جمع انبارهای فروش برابر می‌شود و به بازارگاه‌های نگاشت‌شده هم می‌رسد.");
  notes.push("قیمت فروش سایت عوض نمی‌شود.");

  return {
    mode,
    product: { id: product.id, title: product.title, sku: product.sku, stock: product.stock },
    productItem: { code: own?.code ?? "—", title: own?.title ?? product.title, uses: pUses },
    item: { id: item.id, code: item.code, title: item.title, uses: iUses, qty },
    notes,
  };
}

/** ادغام — همه در یک تراکنش؛ گردش دوباره داخل همین تراکنش سنجیده می‌شود */
export async function linkItemToProduct(tx: Tx, productId: string, itemId: string, actor: Actor): Promise<LinkPlan> {
  await ensureItems(tx, [productId]);
  const plan = await planLink(tx, productId, itemId);
  const P = productId;
  const X = itemId;

  if (plan.mode === "merge") {
    const first = await tx.accStockMove.findFirst({ where: { productId: { in: [P, X] } }, orderBy: { date: "asc" }, select: { date: true } });
    if (first) await assertPostable(tx, first.date);
    const clash = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "AccStockCountLine" a JOIN "AccStockCountLine" b ON a."countId" = b."countId"
      WHERE a."productId" = ${P} AND b."productId" = ${X}`;
    if (Number(clash[0]?.n ?? 0) > 0) throw new AccError("هر دو کالا در یک انبارگردانی شمرده شده‌اند؛ اول یکی از ردیف‌ها را از آن انبارگردانی بردارید", 409);
    const serialClash = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "AccSerial" a JOIN "AccSerial" b ON a.serial = b.serial
      WHERE a."itemId" = ${P} AND b."itemId" = ${X}`;
    if (Number(serialClash[0]?.n ?? 0) > 0) throw new AccError("شماره سریال تکراری بین دو کالا هست؛ ادغام ممکن نیست", 409);
  }

  const x = (await tx.accItem.findUnique({ where: { id: X } }))!;
  const p = (await tx.accItem.findUnique({ where: { id: P } }))!;

  // ردیف‌هایی که دوباره ساخته می‌شوند یا جای دیگرشان را می‌گیرند
  if (plan.mode === "absorb") {
    await tx.accStock.deleteMany({ where: { productId: P } });
    await tx.accProductCost.deleteMany({ where: { productId: P } });
    await tx.accItemAttr.deleteMany({ where: { itemId: P } });
    await tx.accItemPlace.deleteMany({ where: { itemId: P } });
  } else {
    await tx.accStock.deleteMany({ where: { productId: X } });
    await tx.accProductCost.deleteMany({ where: { productId: X } });
    await tx.accItemAttr.deleteMany({ where: { itemId: X } });
    const pPlaces = (await tx.accItemPlace.findMany({ where: { itemId: P }, select: { warehouseId: true } })).map((r) => r.warehouseId);
    await tx.accItemPlace.deleteMany({ where: { itemId: X, warehouseId: { in: pPlaces } } });
  }

  const pid = { where: { productId: X }, data: { productId: P } };
  await tx.accStockMove.updateMany(pid);
  await tx.accInvoiceLine.updateMany(pid);
  await tx.accTransferLine.updateMany(pid);
  await tx.accStockAdjustLine.updateMany(pid);
  await tx.accStockCountLine.updateMany(pid);
  await tx.accStockCountEntry.updateMany(pid);
  await tx.accPurchaseOrderLine.updateMany(pid);
  await tx.accStock.updateMany(pid);
  await tx.accProductCost.updateMany(pid);
  const iid = { where: { itemId: X }, data: { itemId: P } };
  await tx.accSerial.updateMany(iid);
  await tx.accPriceChange.updateMany(iid);
  await tx.accLegacyItem.updateMany(iid);
  await tx.accRelabelLog.updateMany(iid);
  await tx.accItemAttr.updateMany(iid);
  await tx.accItemBarcode.updateMany(iid);
  await tx.accItemPlace.updateMany(iid);
  await tx.accItemAlias.updateMany(iid);

  // کد یکتاست: اول کالای جدا کنار می‌رود، بعد پاک می‌شود
  await tx.accItem.update({ where: { id: X }, data: { code: `~link~${X}` } });
  await tx.accItem.delete({ where: { id: X } });

  const keepCode = plan.mode === "absorb" ? x.code : p.code;
  const aliasCode = plan.mode === "absorb" ? p.code : x.code;
  if (plan.mode === "absorb") {
    await tx.accItem.update({
      where: { id: P },
      data: {
        code: keepCode,
        title: x.title,
        unit: x.unit,
        packUnit: x.packUnit,
        packSize: x.packSize,
        salePrice: x.salePrice,
        onlinePrice: x.onlinePrice,
        reorderPoint: x.reorderPoint,
        groupId: x.groupId ?? p.groupId,
        supplierId: x.supplierId ?? p.supplierId,
        hasSerial: x.hasSerial,
        warrantyDays: x.warrantyDays,
        sellOnline: true,
        isActive: true,
      },
    });
  } else {
    await tx.accItem.update({
      where: { id: P },
      data: {
        supplierId: p.supplierId ?? x.supplierId,
        groupId: p.groupId ?? x.groupId,
        hasSerial: p.hasSerial || x.hasSerial,
        isActive: true,
      },
    });
  }
  if (aliasCode && aliasCode !== keepCode) {
    const source = "ادغام کالا";
    const dup = await tx.accItemAlias.findFirst({ where: { source, code: aliasCode } });
    if (dup) await tx.accItemAlias.update({ where: { id: dup.id }, data: { itemId: P } });
    else await tx.accItemAlias.create({ data: { itemId: P, code: aliasCode, source } });
  }

  if (plan.mode === "merge") await rebuildItemFully(tx, P, actor);

  // حالت داخلی: موجودی سایت = جمع انبارهای فروش (مثل اول دوره، مطلق)
  const internal = (await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }))?.mode === "INTERNAL";
  if (internal && plan.mode !== "alias") {
    const qty = await sellableQty(tx, P);
    await tx.product.update({ where: { id: P }, data: { stock: Math.max(0, qty), trackStock: true } });
  }
  return plan;
}

// ── پیشنهاد جفت: کالای بی‌محصول ↔ محصول ساده ────────────────────────────

export interface LinkCandidate {
  item: { id: string; code: string; title: string; qty: number; barcodes: string[] };
  match: { id: string; title: string; sku: string | null; stock: number; mainImage: string | null; reason: string } | null;
}

const norm = (s: string) =>
  s.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[‌‏‎]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * کالاهای فعالِ فروش آنلاین که به هیچ محصول/تنوعی وصل نیستند و مدل ندارند، با بهترین محصول
 * سادهٔ هم‌کد/هم‌بارکد/هم‌نام. `onlyMatched` = فقط آن‌هایی که پیشنهاد دارند.
 */
export async function linkCandidates(
  db: Db,
  opts: { q?: string | null; page?: number; perPage?: number; onlyMatched?: boolean },
): Promise<{ total: number; items: LinkCandidate[] }> {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(100, Math.max(10, opts.perPage ?? 30));
  const term = opts.q?.trim() ?? "";
  const like = `%${term}%`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT i.id FROM "AccItem" i
    WHERE i."isActive" AND i."sellOnline" AND i."modelId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = i.id)
      AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."accItemId" = i.id)
      AND (${term} = '' OR i.title ILIKE ${like} OR i.code ILIKE ${like}
           OR EXISTS (SELECT 1 FROM "AccItemBarcode" b WHERE b."itemId" = i.id AND b.barcode = ${term}))
    ORDER BY i."createdAt" DESC`;
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { total: 0, items: [] };

  // پیشنهاد برای همه لازم است اگر فقط جفت‌دارها خواسته شده؛ وگرنه فقط همین صفحه
  const scope = opts.onlyMatched ? ids.slice(0, 2000) : ids.slice((page - 1) * perPage, page * perPage);
  const items = await db.accItem.findMany({
    where: { id: { in: scope } },
    select: { id: true, code: true, title: true, barcodes: { select: { barcode: true } } },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  const codes = items.map((i) => i.code);
  const barcodes = items.flatMap((i) => i.barcodes.map((b) => b.barcode));
  const titles = items.map((i) => i.title);
  const products = await db.product.findMany({
    where: {
      variants: { none: {} },
      OR: [
        { sku: { in: codes } },
        ...(barcodes.length ? [{ gtin13: { in: barcodes } }, { sku: { in: barcodes } }] : []),
        { title: { in: titles, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, sku: true, gtin13: true, stock: true, mainImage: true },
    take: 5000,
  });
  const bySku = new Map<string, (typeof products)[number]>();
  const byGtin = new Map<string, (typeof products)[number]>();
  const byTitle = new Map<string, (typeof products)[number]>();
  for (const p of products) {
    if (p.sku) bySku.set(p.sku.trim().toUpperCase(), p);
    if (p.gtin13) byGtin.set(p.gtin13, p);
    byTitle.set(norm(p.title), p);
  }
  const matchOf = (it: (typeof items)[number]): LinkCandidate["match"] => {
    const pick = (p: (typeof products)[number] | undefined, reason: string) =>
      p ? { id: p.id, title: p.title, sku: p.sku, stock: p.stock, mainImage: p.mainImage, reason } : null;
    const sku = bySku.get(it.code.toUpperCase());
    if (sku) return pick(sku, "کد کالا = SKU محصول");
    for (const b of it.barcodes) {
      const g = byGtin.get(b.barcode) ?? bySku.get(b.barcode.toUpperCase());
      if (g) return pick(g, "بارکد یکسان");
    }
    return pick(byTitle.get(norm(it.title)), "نام یکسان");
  };

  let list = scope.map((id) => byId.get(id)).filter((i): i is (typeof items)[number] => !!i).map((it) => ({ it, match: matchOf(it) }));
  let total = ids.length;
  if (opts.onlyMatched) {
    list = list.filter((r) => r.match);
    total = list.length;
    list = list.slice((page - 1) * perPage, page * perPage);
  }
  const qtys = await db.accStock.groupBy({
    by: ["productId"],
    where: {
      productId: { in: list.map((r) => r.it.id) },
      warehouseId: { in: (await db.accWarehouse.findMany({ where: { sellable: true }, select: { id: true } })).map((w) => w.id) },
    },
    _sum: { qty: true },
  });
  const qtyOf = new Map(qtys.map((r) => [r.productId, r._sum.qty ?? 0]));
  return {
    total,
    items: list.map(({ it, match }) => ({
      item: { id: it.id, code: it.code, title: it.title, qty: qtyOf.get(it.id) ?? 0, barcodes: it.barcodes.map((b) => b.barcode) },
      match,
    })),
  };
}
