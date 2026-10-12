/**
 * خواندن سرعت فروش کالاها از کاردکس حسابداری داخلی — برای «موجودی و نقطه‌ی سفارش» و
 * «سرمایه‌ی درگیر در موجودی». محاسبه در `stock-velocity.ts` (خالص) است.
 * docs/features/tools.md بخش ۱۴ و ۱۵
 *
 * - فروش = حرکت‌های `SALE` منهای `SALE_RETURN` بازه؛ سفارش سایت، فروش حضوری و بازارهای آنلاین
 *   همه از فاکتور فروش به همین حرکت می‌رسند.
 * - روزهای موجود بودن از `balanceQty` کاردکس است که **سراسری** است (همه‌ی انبارها)؛ با فیلتر انبار
 *   موجودی و فروش مال همان انبار است ولی روزهای ناموجود هنوز سراسری حساب می‌شود.
 * - فقط کالاهای فعالی که موجودی دارند یا در بازه فروش داشته‌اند برمی‌گردند.
 */

import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/accounting/dates";
import { itemCards } from "@/lib/accounting/inventory/items";
import { inStockDays, type VelocityRow } from "./stock-velocity";

const DAY = 86_400_000;
export const WINDOW_OPTIONS = [30, 60, 90, 180] as const;

export async function loadStockVelocity(opts: { days: number; warehouseId?: string | null; withCost: boolean }): Promise<VelocityRow[]> {
  const days = (WINDOW_OPTIONS as readonly number[]).includes(opts.days) ? opts.days : 90;
  const start = new Date(todayKey().getTime() - (days - 1) * DAY);
  const wh = opts.warehouseId ? { warehouseId: opts.warehouseId } : {};

  const [items, stock, sales, lastSales] = await Promise.all([
    prisma.accItem.findMany({ where: { isActive: true }, select: { id: true, reorderPoint: true, salePrice: true } }),
    prisma.accStock.groupBy({ by: ["productId"], where: wh, _sum: { qty: true } }),
    prisma.accStockMove.groupBy({
      by: ["productId", "type"],
      where: { ...wh, type: { in: ["SALE", "SALE_RETURN"] }, date: { gte: start } },
      _sum: { qty: true },
    }),
    prisma.accStockMove.groupBy({ by: ["productId"], where: { ...wh, type: "SALE" }, _max: { date: true } }),
  ]);

  const qtyOf = new Map(stock.map((s) => [s.productId, s._sum.qty ?? 0]));
  const soldOf = new Map<string, number>();
  for (const s of sales) {
    const q = s._sum.qty ?? 0;
    soldOf.set(s.productId, (soldOf.get(s.productId) ?? 0) + (s.type === "SALE" ? q : -q));
  }
  const ids = items.filter((i) => (qtyOf.get(i.id) ?? 0) !== 0 || (soldOf.get(i.id) ?? 0) > 0).map((i) => i.id);
  if (!ids.length) return [];

  const [before, moves, costs, cards] = await Promise.all([
    prisma.$queryRaw<{ productId: string; balanceQty: number }[]>`
      SELECT DISTINCT ON ("productId") "productId", "balanceQty" FROM "AccStockMove"
      WHERE "date" < ${start} AND "productId" = ANY(${ids})
      ORDER BY "productId", "date" DESC, "createdAt" DESC, "id" DESC`,
    prisma.accStockMove.findMany({
      where: { productId: { in: ids }, date: { gte: start } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { productId: true, date: true, balanceQty: true },
    }),
    opts.withCost ? prisma.accProductCost.findMany({ where: { productId: { in: ids } }, select: { productId: true, avgCost: true } }) : Promise.resolve([]),
    itemCards(ids),
  ]);

  const beforeOf = new Map(before.map((b) => [b.productId, b.balanceQty]));
  const movesOf = new Map<string, { day: number; balance: number }[]>();
  for (const m of moves) {
    const list = movesOf.get(m.productId) ?? [];
    list.push({ day: Math.round((m.date.getTime() - start.getTime()) / DAY), balance: m.balanceQty });
    movesOf.set(m.productId, list);
  }
  const costOf = new Map(costs.map((c) => [c.productId, Number(c.avgCost)]));
  const lastOf = new Map(lastSales.map((l) => [l.productId, l._max.date]));
  const itemOf = new Map(items.map((i) => [i.id, i]));

  return ids.map((id) => {
    const card = cards.get(id);
    const item = itemOf.get(id)!;
    const last = lastOf.get(id);
    const price = card?.price ?? item.salePrice;
    return {
      id,
      title: card?.title ?? id,
      code: card?.code ?? "",
      image: card?.image ?? null,
      qty: qtyOf.get(id) ?? 0,
      sold: Math.max(0, soldOf.get(id) ?? 0),
      inStockDays: inStockDays(beforeOf.get(id) ?? 0, movesOf.get(id) ?? [], days),
      lastSale: last ? last.toISOString().slice(0, 10) : null,
      reorderPoint: item.reorderPoint,
      ...(opts.withCost ? { unitCost: costOf.get(id) ?? 0 } : {}),
      price: price === null || price === undefined ? null : Number(price),
    };
  });
}
