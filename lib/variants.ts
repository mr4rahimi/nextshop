/**
 * تنوع محصول (رنگ، سایز…) — docs/plans/inventory-items.md فاز ۴.
 *
 * قواعد:
 * - محصول بی‌تنوع هیچ `ProductVariant`ی ندارد و همان رفتار قبلی را دارد. کلید
 *   `StoreSettings.variantsEnabled` فقط **نمایش** را باز می‌کند (صفحه‌ی محصول و
 *   ویرایش ادمین)؛ سبد و سفارشی که تنوع دارد همیشه با تنوعش حساب می‌شود.
 * - قیمت تنوع خالی = قیمت محصول (`effectivePrice`).
 * - محصول دارای تنوع: `Product.stock` = جمع موجودی تنوع‌های فعال — فقط
 *   `recomputeProductStock` می‌نویسد. تنوعِ وصل به کالای حسابداری در حالت داخلی
 *   موجودی‌اش را از کاردکس می‌گیرد (`syncVariantStockFromItems`).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shopHas } from "@/lib/plan/license";

type Db = Prisma.TransactionClient | typeof prisma;

export async function variantsEnabled(db: Db = prisma): Promise<boolean> {
  const s = await db.storeSettings.findUnique({ where: { id: "singleton" }, select: { variantsEnabled: true } });
  // بسته‌ی گردانوس هم باید تنوع را داشته باشد — lib/plan/license.ts
  return !!s?.variantsEnabled && (await shopHas("variants"));
}

export const optionKeyOf = (opts: { attributeId: string; attributeValueId: string }[]) =>
  [...opts].sort((a, b) => a.attributeId.localeCompare(b.attributeId)).map((o) => `${o.attributeId}:${o.attributeValueId}`).join("|");

/** قیمت مؤثر — قیمتِ خالیِ تنوع یعنی قیمت و تخفیف خود محصول */
export function effectivePrice(
  product: { price: bigint; salePrice: bigint | null },
  variant?: { price: bigint | null; salePrice: bigint | null } | null,
): { price: bigint; salePrice: bigint | null } {
  if (!variant || variant.price === null) return { price: product.price, salePrice: product.salePrice };
  return { price: variant.price, salePrice: variant.salePrice };
}

/**
 * محصول‌های دارای تنوع: موجودی = جمع تنوع‌های فعال، و فیلدهای کارت فهرست
 * (`hasVariants`، `priceFrom` — فقط با کلید روشن). محصول بی‌تنوع دست نمی‌خورد،
 * مگر نشانه‌ی تنوعِ قبلی داشته باشد که پاک می‌شود.
 */
export async function recomputeProductStock(db: Db, productIds: string[]) {
  const ids = [...new Set(productIds)];
  if (!ids.length) return;
  const [rows, products] = await Promise.all([
    db.productVariant.findMany({ where: { productId: { in: ids } }, select: { productId: true, isActive: true, stock: true, price: true, salePrice: true } }),
    db.product.findMany({ where: { id: { in: ids } }, select: { id: true, price: true, salePrice: true, hasVariants: true, priceFrom: true } }),
  ]);
  const enabled = rows.length || products.some((p) => p.hasVariants || p.priceFrom !== null) ? await variantsEnabled(db) : false;
  for (const p of products) {
    const mine = rows.filter((r) => r.productId === p.id);
    if (!mine.length) {
      if (p.hasVariants || p.priceFrom !== null) await db.product.update({ where: { id: p.id }, data: { hasVariants: false, priceFrom: null } });
      continue;
    }
    const active = mine.filter((r) => r.isActive);
    const prices = active.map((v) => {
      const e = effectivePrice(p, v);
      return e.salePrice && e.salePrice > 0n ? e.salePrice : e.price;
    });
    const min = prices.reduce<bigint | null>((m, x) => (m === null || x < m ? x : m), null);
    const ranged = prices.some((x) => x !== min);
    await db.product.update({
      where: { id: p.id },
      data: {
        stock: Math.max(0, active.reduce((t, v) => t + v.stock, 0)),
        trackStock: true,
        hasVariants: enabled && active.length > 0,
        priceFrom: enabled && ranged ? min : null,
      },
    });
  }
}

/** همه‌ی محصول‌های تنوع‌دار — با روشن/خاموش شدن کلید (`hasVariants` و `priceFrom` تابع کلیدند) */
export async function refreshVariantProducts(db: Db = prisma) {
  const ids = new Set([
    ...(await db.productVariant.findMany({ select: { productId: true }, distinct: ["productId"] })).map((v) => v.productId),
    ...(await db.product.findMany({ where: { OR: [{ hasVariants: true }, { priceFrom: { not: null } }] }, select: { id: true } })).map((p) => p.id),
  ]);
  for (let i = 0, all = [...ids]; i < all.length; i += 200) await recomputeProductStock(db, all.slice(i, i + 200));
}

/**
 * موجودی تنوع‌های وصل به کالاهای حسابداری — از `syncShopStock` کاردکس.
 * `absolute`: عدد مطلق هر کالا؛ `deltas`: تغییر نسبی (مثل `Product.stock`، تله‌ی ۱۵ حسابداری).
 */
export async function syncVariantStockFromItems(db: Db, absolute: Map<string, number>, deltas: Map<string, number>) {
  const ids = [...new Set([...absolute.keys(), ...deltas.keys()])];
  if (!ids.length) return;
  const variants = await db.productVariant.findMany({ where: { accItemId: { in: ids } }, select: { id: true, accItemId: true, stock: true, productId: true } });
  if (!variants.length) return;
  for (const v of variants) {
    const abs = absolute.get(v.accItemId!);
    const next = abs !== undefined ? abs : v.stock + (deltas.get(v.accItemId!) ?? 0);
    if (next !== v.stock) await db.productVariant.update({ where: { id: v.id }, data: { stock: Math.max(0, next) } });
  }
  await recomputeProductStock(db, variants.map((v) => v.productId));
}

/** کسر موجودی تنوع‌های یک سفارش (کنار `deductStockForOrderItems`) */
export async function deductVariantStock(db: Db, items: { productId: string; variantId: string; qty: number }[]) {
  if (!items.length) return;
  const tracked = new Set((await db.product.findMany({ where: { id: { in: items.map((i) => i.productId) }, trackStock: true }, select: { id: true } })).map((p) => p.id));
  for (const i of items) {
    if (!tracked.has(i.productId)) continue;
    const v = await db.productVariant.findUnique({ where: { id: i.variantId }, select: { stock: true, productId: true } });
    if (!v || v.productId !== i.productId) continue;
    await db.productVariant.update({ where: { id: i.variantId }, data: { stock: Math.max(0, v.stock - i.qty) } });
  }
  await recomputeProductStock(db, items.map((i) => i.productId));
}

// ── سبد و سفارش ─────────────────────────────────────────────────────

export interface LineRef {
  productId: string;
  variantId?: string | null;
}

export interface ResolvedVariant {
  id: string;
  productId: string;
  title: string;
  sku: string | null;
  price: bigint | null;
  salePrice: bigint | null;
  stock: number;
  accItemId: string | null;
  /** عکس رنگ این تنوع (اولین عکسِ یکی از مقدارهایش) */
  image: string | null;
}

/** تنوع‌های فعالِ ردیف‌ها، با کنترل اینکه مال همان محصول باشند */
export async function resolveVariants(db: Db, lines: LineRef[]): Promise<Map<string, ResolvedVariant>> {
  const ids = [...new Set(lines.map((l) => l.variantId).filter((x): x is string => !!x))];
  const out = new Map<string, ResolvedVariant>();
  if (!ids.length) return out;
  const vs = await db.productVariant.findMany({ where: { id: { in: ids }, isActive: true }, include: { options: true } });
  const valueIds = vs.flatMap((v) => v.options.map((o) => o.attributeValueId));
  const imgs = valueIds.length
    ? await db.productImage.findMany({ where: { productId: { in: vs.map((v) => v.productId) }, attributeValueId: { in: valueIds } }, orderBy: { sortOrder: "asc" }, select: { productId: true, attributeValueId: true, url: true } })
    : [];
  for (const v of vs) {
    const vals = new Set(v.options.map((o) => o.attributeValueId));
    const image = imgs.find((i) => i.productId === v.productId && i.attributeValueId && vals.has(i.attributeValueId))?.url ?? null;
    out.set(v.id, { id: v.id, productId: v.productId, title: v.title, sku: v.sku, price: v.price, salePrice: v.salePrice, stock: v.stock, accItemId: v.accItemId, image });
  }
  for (const l of lines) if (l.variantId && out.get(l.variantId)?.productId !== l.productId) out.delete(l.variantId);
  return out;
}

/** محصول‌هایی که تنوع فعال دارند — ردیف سبدِ بی‌تنوعِ چنین محصولی پذیرفته نیست */
export async function productsWithVariants(db: Db, productIds: string[]): Promise<Set<string>> {
  if (!productIds.length) return new Set();
  const rows = await db.productVariant.findMany({ where: { productId: { in: productIds }, isActive: true }, select: { productId: true }, distinct: ["productId"] });
  return new Set(rows.map((r) => r.productId));
}

/** کلید تنوع ردیف: "" برای محصول ساده؛ null = نامعتبر (تنوع مال محصول نیست، یا محصول تنوع دارد و انتخاب نشده) */
export async function checkVariant(productId: string, variantId: unknown, db: Db = prisma): Promise<string | null> {
  if (typeof variantId === "string" && variantId) {
    const v = await resolveVariants(db, [{ productId, variantId }]);
    return v.has(variantId) ? variantId : null;
  }
  if ((await variantsEnabled(db)) && (await productsWithVariants(db, [productId])).has(productId)) return null;
  return "";
}

// ── صفحه‌ی محصول ────────────────────────────────────────────────────

export interface VariantView {
  axes: { attributeId: string; title: string; display: string; values: { id: string; value: string; colorHex: string | null }[] }[];
  items: { id: string; title: string; options: Record<string, string>; price: string; salePrice: string | null; stock: number; sku: string | null }[];
  /** مقدار (رنگ) ← عکس‌هایش */
  images: Record<string, string[]>;
}

/** داده‌ی انتخابگر تنوع — فقط وقتی کلید روشن است و محصول تنوع فعال دارد */
export async function loadVariantView(product: { id: string; price: bigint; salePrice: bigint | null }, db: Db = prisma): Promise<VariantView | null> {
  if (!(await variantsEnabled(db))) return null;
  const [variants, axes, imgs] = await Promise.all([
    db.productVariant.findMany({ where: { productId: product.id, isActive: true }, include: { options: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.productVariantAxis.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } }),
    db.productImage.findMany({ where: { productId: product.id, attributeValueId: { not: null } }, orderBy: { sortOrder: "asc" }, select: { attributeValueId: true, url: true } }),
  ]);
  if (!variants.length || !axes.length) return null;
  const usedValues = new Set(variants.flatMap((v) => v.options.map((o) => o.attributeValueId)));
  const attrs = await db.attribute.findMany({
    where: { id: { in: axes.map((a) => a.attributeId) } },
    include: { values: { where: { id: { in: [...usedValues] } }, orderBy: { sortOrder: "asc" } } },
  });
  const images: Record<string, string[]> = {};
  for (const i of imgs) (images[i.attributeValueId!] ??= []).push(i.url);
  return {
    axes: axes
      .map((a) => {
        const at = attrs.find((x) => x.id === a.attributeId);
        return at ? { attributeId: at.id, title: at.title, display: a.display, values: at.values.map((v) => ({ id: v.id, value: v.value, colorHex: v.colorHex })) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.values.length > 0),
    items: variants.map((v) => {
      const p = effectivePrice(product, v);
      return {
        id: v.id,
        title: v.title,
        options: Object.fromEntries(v.options.map((o) => [o.attributeId, o.attributeValueId])),
        price: String(p.price),
        salePrice: p.salePrice !== null ? String(p.salePrice) : null,
        stock: v.stock,
        sku: v.sku,
      };
    }),
    images,
  };
}
