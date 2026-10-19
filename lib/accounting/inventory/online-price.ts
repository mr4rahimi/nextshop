/**
 * قیمت آنلاین از قیمت فروشگاه — docs/plans/inventory-items.md بخش ۱۴ (۲.۹۶.۰).
 *
 *   قیمت فروشگاه = `AccItem.salePrice` (صندوق و فاکتور دستی همین را می‌گیرند)
 *   قیمت آنلاین  = `AccItem.onlinePrice` (دستی) ?? گرد(فروشگاه × (۱ + درصد))
 *   درصد         = نزدیک‌ترین گروه (یا گروه بالاتر) که درصد دارد، وگرنه پیش‌فرض تنظیمات
 *
 * فقط کالایی «مدیریت» می‌شود که قیمت فروشگاه دارد و به سایت وصل است: محصول ساده‌ی
 * هم‌شناسه یا تنوعِ `accItemId`. کالای محصول‌دار سایت‌های قدیمی `salePrice` ندارد و
 * دست نمی‌خورد. کلید `AccSettings.onlinePricing` خاموش ← هیچ نوشتنی.
 *
 * محصول تنوع‌دار: قیمت پایه‌ی محصول = پرتکرارترین قیمت تنوع‌ها (مثل «ساخت محصول»)، و
 * فقط تنوعی که با آن فرق دارد قیمت خودش را می‌گیرد — تا تخفیف ویژه‌ی محصول برای
 * تنوع‌های هم‌قیمت کار کند (تصمیم ۱۴الف). بعدش `recomputeProductStock` (تله‌ی ۲پ).
 *
 * ⚠️ `planOnlinePrices` چیزی نمی‌نویسد (تله‌ی ۰پ)؛ نوشتن فقط در `applyOnlinePrices`.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeProductStock } from "@/lib/variants";
import { AccError } from "../errors";
import { applyRule, type RoundMode } from "./online-price-calc";

export { applyRule, type RoundMode };

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export interface OnlineRule {
  enabled: boolean;
  pctBp: number;
  roundTo: number;
  roundMode: RoundMode;
}

export const ROUND_MODES: RoundMode[] = ["down", "nearest", "up"];

export async function onlineRule(db: Db = prisma): Promise<OnlineRule> {
  const s = await db.accSettings.findUnique({
    where: { id: "singleton" },
    select: { onlinePricing: true, onlinePctBp: true, onlineRoundTo: true, onlineRoundMode: true },
  });
  return {
    enabled: !!s?.onlinePricing,
    pctBp: s?.onlinePctBp ?? 0,
    roundTo: s?.onlineRoundTo ?? 0,
    roundMode: (ROUND_MODES as string[]).includes(s?.onlineRoundMode ?? "") ? (s!.onlineRoundMode as RoundMode) : "nearest",
  };
}

/** درصد معتبر: بین −۹۰٪ و +۳۰۰٪ */
export function checkPctBp(bp: number) {
  if (!Number.isInteger(bp) || bp < -9000 || bp > 30000) throw new AccError("درصد قیمت آنلاین باید بین −۹۰ و +۳۰۰ باشد");
}

/** درصد هر گروه با ارث از گروه بالاتر */
async function groupPcts(db: Db, fallback: number): Promise<Map<string, { bp: number; from: string | null }>> {
  const groups = await db.accItemGroup.findMany({ select: { id: true, parentId: true, onlinePctBp: true, name: true } });
  const byId = new Map(groups.map((g) => [g.id, g]));
  const out = new Map<string, { bp: number; from: string | null }>();
  for (const g of groups) {
    let cur: (typeof groups)[number] | undefined = g;
    const seen = new Set<string>();
    while (cur && cur.onlinePctBp === null && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
    }
    out.set(g.id, cur && cur.onlinePctBp !== null ? { bp: cur.onlinePctBp, from: cur.name } : { bp: fallback, from: null });
  }
  return out;
}

export interface PriceChange {
  itemId: string;
  code: string;
  title: string;
  store: bigint;
  /** درصد اعمال‌شده و منبعش (نام گروه یا null = پیش‌فرض)؛ قیمت دستی ← `manual` */
  pctBp: number;
  source: string | null;
  manual: boolean;
  productId: string;
  productTitle: string;
  variantId: string | null;
  /** قیمت مؤثر فعلی روی سایت و قیمت تازه */
  current: bigint;
  next: bigint;
}

interface ProductWrite {
  productId: string;
  price: bigint;
  variants: { id: string; price: bigint | null }[];
}

/** قیمت آنلاین هر کالا (فقط کالاهای قیمت‌دار) — برای فرم کالا و صندوق */
export async function onlinePricesOf(db: Db, itemIds: string[], rule?: OnlineRule) {
  const r = rule ?? (await onlineRule(db));
  const items = await db.accItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, salePrice: true, onlinePrice: true, groupId: true } });
  const pcts = await groupPcts(db, r.pctBp);
  const out = new Map<string, { price: bigint; pctBp: number; source: string | null; manual: boolean }>();
  for (const i of items) {
    const g = i.groupId ? pcts.get(i.groupId) : null;
    const bp = g?.bp ?? r.pctBp;
    if (i.onlinePrice !== null && i.onlinePrice > 0n) out.set(i.id, { price: i.onlinePrice, pctBp: bp, source: g?.from ?? null, manual: true });
    else if (i.salePrice !== null && i.salePrice > 0n) out.set(i.id, { price: applyRule(i.salePrice, bp, r.roundTo, r.roundMode), pctBp: bp, source: g?.from ?? null, manual: false });
  }
  return out;
}

/**
 * برنامه‌ی قیمت سایت. `itemIds` خالی = همه‌ی کالاهای وصل. فقط آنچه عوض می‌شود در `changes`
 * است؛ `writes` همان چیزی است که `applyOnlinePrices` می‌نویسد.
 */
export async function planOnlinePrices(db: Db, opts: { itemIds?: string[]; rule?: OnlineRule } = {}) {
  const rule = opts.rule ?? (await onlineRule(db));
  const scope = opts.itemIds;
  // کالاهای وصل: محصول هم‌شناسه یا تنوع
  const [simple, linkedVariants] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`SELECT i."id" FROM "AccItem" i JOIN "Product" p ON p."id" = i."id" WHERE i."salePrice" > 0 OR i."onlinePrice" > 0`,
    db.productVariant.findMany({
      where: { accItemId: { not: null }, ...(scope ? { accItemId: { in: scope } } : {}) },
      select: { productId: true },
    }),
  ]);
  const simpleIds = simple.map((s) => s.id).filter((id) => !scope || scope.includes(id));
  const productIds = [...new Set([...simpleIds, ...linkedVariants.map((v) => v.productId)])];
  if (!productIds.length) return { rule, changes: [] as PriceChange[], writes: [] as ProductWrite[] };

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true, price: true, salePrice: true, variants: { select: { id: true, accItemId: true, price: true, salePrice: true } } },
  });
  const itemIds = [...new Set(products.flatMap((p) => [p.id, ...p.variants.map((v) => v.accItemId).filter((x): x is string => !!x)]))];
  const [prices, items] = await Promise.all([
    onlinePricesOf(db, itemIds, rule),
    db.accItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, title: true, salePrice: true } }),
  ]);
  const itemOf = new Map(items.map((i) => [i.id, i]));
  const changes: PriceChange[] = [];
  const writes: ProductWrite[] = [];

  for (const p of products) {
    if (!p.variants.length) {
      const target = prices.get(p.id);
      if (!target || target.price === p.price) continue;
      const it = itemOf.get(p.id)!;
      changes.push({ itemId: p.id, code: it.code, title: it.title, store: it.salePrice ?? 0n, pctBp: target.pctBp, source: target.source, manual: target.manual, productId: p.id, productTitle: p.title, variantId: null, current: p.price, next: target.price });
      writes.push({ productId: p.id, price: target.price, variants: [] });
      continue;
    }
    // تنوع‌دار: قیمت مطلوب هر تنوع (مدیریت‌نشده‌ها همان قیمت مؤثر فعلی)
    const desired = p.variants.map((v) => {
      const t = v.accItemId ? prices.get(v.accItemId) : undefined;
      const now = v.price ?? p.price;
      return { v, now, next: t ? t.price : now, t };
    });
    if (!desired.some((d) => d.t)) continue;
    const base = basePriceOf(desired.map((d) => d.next)) ?? p.price;
    const vWrites = desired.map((d) => ({ id: d.v.id, price: d.next === base && d.v.salePrice === null ? null : d.next }));
    const same = base === p.price && vWrites.every((w, i) => w.price === desired[i].v.price);
    if (same) continue;
    for (const d of desired) {
      if (!d.t || d.next === d.now) continue;
      const it = itemOf.get(d.v.accItemId!)!;
      changes.push({ itemId: it.id, code: it.code, title: it.title, store: it.salePrice ?? 0n, pctBp: d.t.pctBp, source: d.t.source, manual: d.t.manual, productId: p.id, productTitle: p.title, variantId: d.v.id, current: d.now, next: d.next });
    }
    writes.push({ productId: p.id, price: base, variants: vWrites });
  }
  return { rule, changes, writes };
}

export function basePriceOf(prices: (bigint | null)[]) {
  const n = new Map<string, number>();
  for (const p of prices) if (p !== null && p > 0n) n.set(p.toString(), (n.get(p.toString()) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, c] of n) if (best === null || c > n.get(best)! || (c === n.get(best)! && BigInt(k) < BigInt(best))) best = k;
  return best === null ? null : BigInt(best);
}

/** نوشتن قیمت‌های آنلاین روی محصول/تنوع — کلید خاموش ← هیچ */
export async function applyOnlinePrices(tx: Tx, itemIds?: string[]) {
  const plan = await planOnlinePrices(tx, { itemIds });
  if (!plan.rule.enabled) return { changed: 0, products: 0 };
  for (const w of plan.writes) {
    // قیمت ویژه‌ای که دیگر کمتر از قیمت نیست، تخفیف نیست — برداشته می‌شود
    await tx.product.updateMany({ where: { id: w.productId, salePrice: { gte: w.price } }, data: { salePrice: null } });
    await tx.product.update({ where: { id: w.productId }, data: { price: w.price } });
    for (const v of w.variants) {
      if (v.price !== null) await tx.productVariant.updateMany({ where: { id: v.id, salePrice: { gte: v.price } }, data: { salePrice: null } });
      await tx.productVariant.update({ where: { id: v.id }, data: { price: v.price } });
    }
  }
  await recomputeProductStock(tx, plan.writes.map((w) => w.productId));
  return { changed: plan.changes.length, products: plan.writes.length };
}
