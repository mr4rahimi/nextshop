/**
 * سود هر کالا، دسته یا کانال — docs/plans/accounting.md بخش ۱۱.
 *
 * فروش = مبلغ ردیف‌های فاکتور فروش صادرشده پس از تخفیف‌ها و بدون مالیات
 * (`lineTotal − vatAmount`)؛ برگشت از فروش با علامت منفی. بها از کاردکس
 * (`AccStockMove.totalCost` همان ردیف) — همان عددی که سند بهای تمام‌شده دارد و
 * با خرید تاریخ‌گذشته بازسازی می‌شود.
 *
 * ⚠️ کرایه‌ی ارسال (`additions`) و تخفیف‌های بیرون از ردیف در این گزارش
 *    نیستند — سود هر کالاست، نه سود خالص؛ جمعش با سود ناخالص «سود و زیان» به
 *    همین اندازه فاصله دارد.
 */

import type { AccChannel } from "@prisma/client";
import { INVOICE_SOURCE } from "../invoices/service";
import type { Db, DateRange } from "./common";

export type ProfitDim = "product" | "category" | "channel";

export const CHANNEL_LABELS: Record<AccChannel, string> = {
  SHOP: "سایت",
  PHONE: "سفارش تلفنی",
  MARKETPLACE: "بازارگاه",
  WORKLIST: "کارتابل",
  MANUAL: "فاکتور دستی",
};

export interface ProfitRow {
  key: string;
  label: string;
  qty: number;
  revenue: bigint;
  cost: bigint;
  profit: bigint;
  /** درصد سود از فروش × ۱۰۰ (برای نمایش یک رقم اعشار) */
  marginBp: number | null;
}

export async function profitBy(db: Db, range: DateRange, dim: ProfitDim) {
  const invs = await db.accInvoice.findMany({
    where: {
      status: "ISSUED",
      type: { in: ["SALES", "SALES_RETURN"] },
      ...(range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
    },
    select: { id: true, type: true, channel: true, platformCode: true, lines: { select: { id: true, productId: true, title: true, qty: true, lineTotal: true, vatAmount: true } } },
  });
  const moves = await db.accStockMove.findMany({
    where: { sourceType: INVOICE_SOURCE, sourceId: { in: invs.map((i) => i.id) } },
    select: { sourceLineId: true, totalCost: true },
  });
  const costOf = new Map<string, bigint>();
  for (const m of moves) if (m.sourceLineId) costOf.set(m.sourceLineId, (costOf.get(m.sourceLineId) ?? 0n) + m.totalCost);

  const productIds = [...new Set(invs.flatMap((i) => i.lines.map((l) => l.productId)).filter((x): x is string => !!x))];
  const products = dim === "channel" ? [] : await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, categoryId: true } });
  const pInfo = new Map(products.map((p) => [p.id, p]));
  const cats = dim === "category" ? await db.category.findMany({ where: { id: { in: [...new Set(products.map((p) => p.categoryId))] } }, select: { id: true, title: true } }) : [];
  const catName = new Map(cats.map((c) => [c.id, c.title]));

  const rows = new Map<string, ProfitRow>();
  for (const inv of invs) {
    const sign = inv.type === "SALES" ? 1n : -1n;
    for (const l of inv.lines) {
      let key: string;
      let label: string;
      if (dim === "channel") {
        key = inv.platformCode ? `MARKETPLACE:${inv.platformCode}` : inv.channel;
        label = inv.platformCode ? `بازارگاه — ${inv.platformCode}` : CHANNEL_LABELS[inv.channel];
      } else if (!l.productId) {
        key = "_service";
        label = "خدمات (بی‌کالا)";
      } else if (dim === "product") {
        key = l.productId;
        label = pInfo.get(l.productId)?.title ?? l.title;
      } else {
        const c = pInfo.get(l.productId)?.categoryId;
        key = c ?? "_none";
        label = (c && catName.get(c)) || "بی‌دسته";
      }
      const r = rows.get(key) ?? { key, label, qty: 0, revenue: 0n, cost: 0n, profit: 0n, marginBp: null };
      r.qty += Number(sign) * l.qty;
      r.revenue += sign * (l.lineTotal - l.vatAmount);
      r.cost += sign * (costOf.get(l.id) ?? 0n);
      rows.set(key, r);
    }
  }
  const list = [...rows.values()].map((r) => {
    const profit = r.revenue - r.cost;
    return { ...r, profit, marginBp: r.revenue > 0n ? Number((profit * 10_000n) / r.revenue) : null };
  });
  list.sort((a, b) => (b.profit > a.profit ? 1 : b.profit < a.profit ? -1 : 0));
  const totals = list.reduce((t, r) => ({ qty: t.qty + r.qty, revenue: t.revenue + r.revenue, cost: t.cost + r.cost, profit: t.profit + r.profit }), { qty: 0, revenue: 0n, cost: 0n, profit: 0n });
  return { rows: list, totals };
}
