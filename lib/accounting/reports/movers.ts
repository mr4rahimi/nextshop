/**
 * کالای راکد و پرفروش — docs/plans/webhesab-parity.md بخش ۶.
 *
 * از کاردکس: فروش خالص بازه = −Σ حرکت‌های SALE و SALE_RETURN (پس فیلتر انبار دقیق است و
 * خدمات بیرون‌اند)؛ موجودی از `AccStock`. سطر کالا یا مدل (همه‌ی رنگ/سایزها با هم).
 */

import type { AccMoveType, Prisma } from "@prisma/client";
import { groupTree } from "../inventory/counts";
import { suppliersOf } from "./sales";
import type { Db } from "./common";

const DAY_MS = 86_400_000;
const SALE_TYPES: AccMoveType[] = ["SALE", "SALE_RETURN"];
const IN_TYPES: AccMoveType[] = ["PURCHASE", "OPENING", "TRANSFER_IN", "ADJUST_IN"];
/** پوشش کمتر از این ← «رو به اتمام» */
export const LOW_COVER_DAYS = 14;
const MAX_ROWS = 2000;

export interface MoversOpts {
  mode: "slow" | "fast";
  groupBy: "item" | "model";
  from: Date;
  to: Date;
  groupId?: string | null;
  warehouseId?: string | null;
  supplierId?: string | null;
  /** راکد: فروش خالص ≤ این */
  maxSold?: number;
  /** راکد: نرخ فروش ≤ این درصد (اختیاری) */
  maxRatePct?: number | null;
  /** پرفروش: فروش خالص ≥ این */
  minSold?: number;
  /** پرفروش: فقط این درصد برتر (از نظر تعداد سطر) */
  topPct?: number | null;
  costs: boolean;
}

export interface MoverRow {
  key: string;
  /** کالا ← کاردکس؛ مدل ← null */
  productId: string | null;
  modelId: string | null;
  label: string;
  code: string | null;
  items: number;
  stock: number;
  sold: number;
  ratePct: number | null;
  lastSale: Date | null;
  daysSinceSale: number | null;
  lastIn: Date | null;
  coverDays: number | null;
  value: bigint | null;
  low: boolean;
}

export async function movers(db: Db, o: MoversOpts) {
  const days = Math.max(1, Math.round((o.to.getTime() - o.from.getTime()) / DAY_MS) + 1);
  const wh: Prisma.AccStockMoveWhereInput = o.warehouseId ? { warehouseId: o.warehouseId } : {};

  const [sales, stocks] = await Promise.all([
    db.accStockMove.groupBy({ by: ["productId"], where: { ...wh, type: { in: SALE_TYPES }, date: { gte: o.from, lte: o.to } }, _sum: { qty: true } }),
    db.accStock.findMany({ where: { qty: { not: 0 }, ...(o.warehouseId ? { warehouseId: o.warehouseId } : {}) }, select: { productId: true, qty: true } }),
  ]);
  const sold = new Map(sales.map((s) => [s.productId, -(s._sum.qty ?? 0)]));
  const stock = new Map<string, number>();
  for (const s of stocks) stock.set(s.productId, (stock.get(s.productId) ?? 0) + s.qty);

  // جامعه: راکد = دارای موجودی؛ پرفروش = فروش‌رفته
  let ids = o.mode === "slow" ? [...stock].filter(([, q]) => q > 0).map(([id]) => id) : [...sold].filter(([, q]) => q > 0).map(([id]) => id);
  const pick = { id: true, title: true, code: true, groupId: true, modelId: true, supplierId: true } as const;
  let items = await db.accItem.findMany({ where: { id: { in: ids } }, select: pick });
  // «هر مدل»: موجودی و فروش همه‌ی رنگ/سایزهای همان مدل‌ها — حتی رنگی که فروش نرفته یا تمام شده
  if (o.groupBy === "model") {
    const modelIds = [...new Set(items.map((i) => i.modelId).filter((x): x is string => !!x))];
    const have = new Set(items.map((i) => i.id));
    const more = modelIds.length ? await db.accItem.findMany({ where: { modelId: { in: modelIds }, id: { notIn: [...have] } }, select: pick }) : [];
    items = [...items, ...more];
  }
  const inGroup = o.groupId ? await groupTree(db, o.groupId) : null;
  const sup = o.supplierId ? await suppliersOf(db, items) : null;
  const kept = items.filter((i) => (!inGroup || (i.groupId && inGroup.has(i.groupId))) && (!sup || sup.get(i.id) === o.supplierId));
  ids = kept.map((i) => i.id);

  const [lastSales, lastIns, costs, models] = await Promise.all([
    db.accStockMove.groupBy({ by: ["productId"], where: { ...wh, productId: { in: ids }, type: "SALE" }, _max: { date: true } }),
    db.accStockMove.groupBy({ by: ["productId"], where: { ...wh, productId: { in: ids }, type: { in: IN_TYPES } }, _max: { date: true } }),
    o.costs ? db.accProductCost.findMany({ where: { productId: { in: ids } }, select: { productId: true, avgCost: true, lastCost: true } }) : [],
    o.groupBy === "model"
      ? db.accItemModel.findMany({ where: { id: { in: [...new Set(kept.map((i) => i.modelId).filter((x): x is string => !!x))] } }, select: { id: true, title: true, code: true } })
      : [],
  ]);
  const lastSale = new Map(lastSales.map((x) => [x.productId, x._max.date]));
  const lastIn = new Map(lastIns.map((x) => [x.productId, x._max.date]));
  const unit = new Map(costs.map((c) => [c.productId, c.avgCost > 0n ? c.avgCost : c.lastCost]));
  const modelOf = new Map(models.map((m) => [m.id, m]));

  const rows = new Map<string, MoverRow>();
  const later = (a: Date | null, b: Date | null | undefined) => (!b ? a : !a || b > a ? b : a);
  for (const i of kept) {
    const m = o.groupBy === "model" && i.modelId ? modelOf.get(i.modelId) : undefined;
    const key = m ? `m:${m.id}` : i.id;
    const r =
      rows.get(key) ??
      ({
        key,
        productId: m ? null : i.id,
        modelId: m?.id ?? null,
        label: m ? m.title : i.title,
        code: m ? m.code : i.code,
        items: 0,
        stock: 0,
        sold: 0,
        ratePct: null,
        lastSale: null,
        daysSinceSale: null,
        lastIn: null,
        coverDays: null,
        value: o.costs ? 0n : null,
        low: false,
      } as MoverRow);
    const q = Math.max(0, stock.get(i.id) ?? 0);
    r.items++;
    r.stock += q;
    r.sold += sold.get(i.id) ?? 0;
    r.lastSale = later(r.lastSale, lastSale.get(i.id));
    r.lastIn = later(r.lastIn, lastIn.get(i.id));
    if (r.value !== null) r.value += (unit.get(i.id) ?? 0n) * BigInt(q);
    rows.set(key, r);
  }

  const now = o.to.getTime();
  let list = [...rows.values()].map((r) => {
    const net = Math.max(0, r.sold);
    const ratePct = net + r.stock > 0 ? Math.round((net / (net + r.stock)) * 100) : null;
    const coverDays = net > 0 ? Math.round(r.stock / (net / days)) : null;
    return {
      ...r,
      ratePct,
      coverDays,
      daysSinceSale: r.lastSale ? Math.max(0, Math.round((now - r.lastSale.getTime()) / DAY_MS)) : null,
      low: o.mode === "fast" && coverDays !== null && coverDays <= LOW_COVER_DAYS,
    };
  });

  if (o.mode === "slow") {
    const maxSold = o.maxSold ?? 0;
    list = list.filter((r) => r.stock > 0 && (r.sold <= maxSold || (o.maxRatePct != null && (r.ratePct ?? 0) <= o.maxRatePct)));
    list.sort((a, b) => (a.value !== null && b.value !== null && a.value !== b.value ? (b.value > a.value ? 1 : -1) : b.stock - a.stock));
  } else {
    list = list.filter((r) => r.sold >= Math.max(1, o.minSold ?? 1));
    list.sort((a, b) => b.sold - a.sold || (a.coverDays ?? 1e9) - (b.coverDays ?? 1e9));
    if (o.topPct && o.topPct > 0 && o.topPct < 100) list = list.slice(0, Math.max(1, Math.ceil((list.length * o.topPct) / 100)));
  }

  const totals = {
    rows: list.length,
    stock: list.reduce((s, r) => s + r.stock, 0),
    sold: list.reduce((s, r) => s + r.sold, 0),
    value: o.costs ? list.reduce((s, r) => s + (r.value ?? 0n), 0n) : null,
    low: list.filter((r) => r.low).length,
    neverSold: list.filter((r) => !r.lastSale).length,
  };
  return { rows: list.slice(0, MAX_ROWS), totals, truncated: list.length > MAX_ROWS, days, costs: o.costs, lowCoverDays: LOW_COVER_DAYS };
}
