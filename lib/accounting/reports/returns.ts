/**
 * گزارش «مرجوعی‌ها» — docs/plans/webhesab-parity.md بخش ۳۴.۱.
 *
 * برگشت از فروش‌های صادرشده‌ی بازه: جمع و نرخ مرجوعی (به فروش همان بازه)، به تفکیک دلیل،
 * کالا یا مدل (با نرخ برگشت = برگشتی ÷ فروخته‌ی بازه) و فهرست هر مرجوعی با فاصله‌ی روز تا
 * فروش اولیه، فروشنده‌ی آن فروش و صندوقدار مرجوعی. مبلغ‌ها همان جمع فاکتورها (تومان).
 * مقداری است، نه دفتری (مثل تحلیل فروش): از ردیف فاکتور می‌آید.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export const NO_REASON = "بی‌دلیل";
const MAX_ROWS = 500;

export async function returnsReport(db: Db, range: { from: Date | null; to: Date | null }, by: "item" | "model" = "model") {
  const date = { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) };
  const [returns, sales] = await Promise.all([
    db.accInvoice.findMany({
      where: { type: "SALES_RETURN", status: "ISSUED", date },
      select: {
        id: true,
        number: true,
        date: true,
        partyId: true,
        partyName: true,
        total: true,
        returnReason: true,
        refInvoiceId: true,
        lines: { select: { productId: true, title: true, qty: true, lineTotal: true } },
      },
      orderBy: [{ date: "desc" }, { number: "desc" }],
    }),
    db.accInvoice.aggregate({ where: { type: "SALES", status: "ISSUED", date }, _sum: { total: true }, _count: true }),
  ]);

  const refIds = [...new Set(returns.map((r) => r.refInvoiceId).filter((x): x is string => !!x))];
  const productIds = [...new Set(returns.flatMap((r) => r.lines.map((l) => l.productId).filter((x): x is string => !!x)))];
  const [refs, saleTickets, retTickets, items, soldLines] = await Promise.all([
    db.accInvoice.findMany({ where: { id: { in: refIds } }, select: { id: true, number: true, date: true } }),
    db.accPosTicket.findMany({ where: { saleInvoiceId: { in: refIds } }, select: { saleInvoiceId: true, sellerName: true, number: true } }),
    db.accPosTicket.findMany({ where: { returnInvoiceId: { in: returns.map((r) => r.id) } }, select: { returnInvoiceId: true, cashierName: true, number: true, terminal: { select: { name: true } } } }),
    db.accItem.findMany({ where: { id: { in: productIds } }, select: { id: true, code: true, title: true, modelId: true, model: { select: { id: true, title: true, code: true, specs: true } } } }),
    db.accInvoiceLine.groupBy({ by: ["productId"], where: { productId: { in: productIds }, invoice: { type: "SALES", status: "ISSUED", date } }, _sum: { qty: true } }),
  ]);
  const refOf = new Map(refs.map((r) => [r.id, r]));
  const sellerOf = new Map(saleTickets.map((t) => [t.saleInvoiceId!, t]));
  const retTicketOf = new Map(retTickets.map((t) => [t.returnInvoiceId!, t]));
  const itemOf = new Map(items.map((i) => [i.id, i]));
  const soldOf = new Map(soldLines.map((s) => [s.productId!, s._sum.qty ?? 0]));

  // ── به تفکیک دلیل ──
  const reasons = new Map<string, { reason: string; count: number; qty: number; amount: bigint }>();
  // ── به تفکیک کالا/مدل ──
  const groups = new Map<string, { key: string; title: string; code: string | null; productIds: Set<string>; qty: number; amount: bigint; sold: number; reasons: Map<string, number> }>();

  let qty = 0;
  let amount = 0n;
  let daysSum = 0;
  let daysN = 0;
  const rows = returns.map((r) => {
    const reason = r.returnReason?.trim() || NO_REASON;
    const rq = r.lines.reduce((s, l) => s + l.qty, 0);
    qty += rq;
    amount += r.total;
    const rr = reasons.get(reason) ?? { reason, count: 0, qty: 0, amount: 0n };
    rr.count++;
    rr.qty += rq;
    rr.amount += r.total;
    reasons.set(reason, rr);

    for (const l of r.lines) {
      if (!l.productId) continue;
      const it = itemOf.get(l.productId);
      const useModel = by === "model" && it?.model;
      const key = useModel ? `m:${it!.model!.id}` : `i:${l.productId}`;
      const specs = it?.model?.specs as { base?: string } | null | undefined;
      const g = groups.get(key) ?? {
        key,
        title: useModel ? specs?.base?.trim() || it!.model!.title : it?.title ?? l.title,
        code: useModel ? it!.model!.code : it?.code ?? null,
        productIds: new Set<string>(),
        qty: 0,
        amount: 0n,
        sold: 0,
        reasons: new Map<string, number>(),
      };
      if (!g.productIds.has(l.productId)) {
        g.productIds.add(l.productId);
        g.sold += soldOf.get(l.productId) ?? 0;
      }
      g.qty += l.qty;
      g.amount += l.lineTotal;
      g.reasons.set(reason, (g.reasons.get(reason) ?? 0) + l.qty);
      groups.set(key, g);
    }

    const ref = r.refInvoiceId ? refOf.get(r.refInvoiceId) : null;
    const days = ref ? Math.max(0, Math.round((r.date.getTime() - ref.date.getTime()) / 86_400_000)) : null;
    if (days !== null) {
      daysSum += days;
      daysN++;
    }
    const st = r.refInvoiceId ? sellerOf.get(r.refInvoiceId) : null;
    const rt = retTicketOf.get(r.id);
    return {
      id: r.id,
      number: r.number,
      date: r.date,
      partyId: r.partyId,
      partyName: r.partyName,
      reason,
      qty: rq,
      amount: r.total,
      items: r.lines.map((l) => `${l.title}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join("، "),
      productIds: [...new Set(r.lines.map((l) => l.productId).filter((x): x is string => !!x))],
      ref: ref ? { id: ref.id, number: ref.number, date: ref.date, ticket: st?.number ?? null } : null,
      days,
      seller: st?.sellerName ?? null,
      where: rt ? `صندوق ${rt.terminal?.name ?? ""}`.trim() : "فاکتور دستی",
      cashier: rt?.cashierName ?? null,
    };
  });

  const salesAmount = sales._sum.total ?? 0n;
  return {
    by,
    summary: {
      count: returns.length,
      qty,
      amount,
      salesCount: sales._count,
      salesAmount,
      /** درصد مبلغ مرجوعی به فروش بازه (صدم درصد) */
      rateBp: salesAmount > 0n ? Number((amount * 10000n) / salesAmount) : null,
      avgDays: daysN ? Math.round((daysSum / daysN) * 10) / 10 : null,
    },
    reasons: [...reasons.values()].sort((a, b) => b.count - a.count),
    groups: [...groups.values()]
      .map((g) => ({
        key: g.key,
        title: g.title,
        code: g.code,
        productIds: [...g.productIds],
        qty: g.qty,
        amount: g.amount,
        sold: g.sold,
        /** برگشتی ÷ فروخته‌ی همین بازه (صدم درصد)؛ فروش بیرون از بازه ← null */
        rateBp: g.sold > 0 ? Math.round((g.qty * 10000) / g.sold) : null,
        topReason: [...g.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      }))
      .sort((a, b) => b.qty - a.qty),
    rows: rows.slice(0, MAX_ROWS),
    truncated: rows.length > MAX_ROWS,
  };
}
