/**
 * تعداد فاکتورشده‌ی ردیف‌های سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳.
 * جدا از `orders.ts` تا `invoices/service.ts` بی‌چرخه‌ی import سقف را بسنجد.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** تعداد فاکتورشده‌ی هر ردیف سفارش: صادرشده (`received`) و پیش‌نویس (`draft`) */
export async function poLineProgress(db: Db, poLineIds: string[], excludeInvoiceId?: string | null) {
  const out = new Map<string, { received: number; draft: number }>();
  if (!poLineIds.length) return out;
  const rows = await db.accInvoiceLine.groupBy({
    by: ["poLineId", "invoiceId"],
    where: {
      poLineId: { in: poLineIds },
      invoice: { type: "PURCHASE", status: { not: "VOID" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) },
    },
    _sum: { qty: true },
  });
  const status = new Map(
    (await db.accInvoice.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.invoiceId))] } }, select: { id: true, status: true } })).map((i) => [i.id, i.status]),
  );
  for (const r of rows) {
    const o = out.get(r.poLineId!) ?? { received: 0, draft: 0 };
    if (status.get(r.invoiceId) === "ISSUED") o.received += r._sum.qty ?? 0;
    else o.draft += r._sum.qty ?? 0;
    out.set(r.poLineId!, o);
  }
  return out;
}
