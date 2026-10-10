/**
 * خواندن موجودی برای رابط کاربری — بهای تمام‌شده فقط با `ACC_COST_VIEW`
 * (بخش ۱۴): اعداد بها سمت سرور حذف می‌شوند، نه با پنهان‌کردن در مرورگر.
 */

import { prisma } from "@/lib/prisma";

export interface StockRow {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  siteStock: number;
  lowStockThreshold: number;
  qty: number;
  byWarehouse: Record<string, number>;
  avgCost?: bigint;
  value?: bigint;
}

/** موجودی چند کالا در همه‌ی انبارها (+ بها اگر مجاز است) */
export async function stockRows(productIds: string[], withCost: boolean): Promise<Map<string, Omit<StockRow, "id" | "title" | "sku" | "image" | "siteStock" | "lowStockThreshold">>> {
  const [stocks, costs] = await Promise.all([
    prisma.accStock.findMany({ where: { productId: { in: productIds } } }),
    withCost ? prisma.accProductCost.findMany({ where: { productId: { in: productIds } } }) : Promise.resolve([]),
  ]);
  const map = new Map<string, { qty: number; byWarehouse: Record<string, number>; avgCost?: bigint; value?: bigint }>();
  for (const id of productIds) map.set(id, { qty: 0, byWarehouse: {} });
  for (const s of stocks) {
    const r = map.get(s.productId)!;
    r.qty += s.qty;
    r.byWarehouse[s.warehouseId] = s.qty;
  }
  for (const c of costs) {
    const r = map.get(c.productId)!;
    r.avgCost = c.avgCost;
    r.value = c.totalValue;
  }
  return map;
}
