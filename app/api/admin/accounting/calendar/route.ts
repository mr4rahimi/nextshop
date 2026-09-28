import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { fromJalali, toJalali } from "@/lib/club/jalali";
import { jalaliMonthBounds, todayKey } from "@/lib/accounting/dates";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { invoiceOpenAmounts } from "@/lib/accounting/cash/allocation";
import { planRows } from "@/lib/accounting/installments";
import { accErrorResponse } from "@/lib/accounting/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = {
  kind: "cheque" | "installment" | "invoice";
  dir: "in" | "out";
  id: string;
  date: Date;
  amount: bigint;
  title: string;
  sub: string;
  href: string;
  done: boolean;
  bad?: boolean;
};

/**
 * GET ?month=1405-07 — تقویم سررسید (فاز ۱۰): چک‌های دریافتی و صادره، قسط‌ها و
 * فاکتورهای مدت‌دارِ بی‌برنامه در یک ماه شمسی. `in` = پولی که باید بیاید.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_CHEQUE", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const m = new URL(req.url).searchParams.get("month");
    const today = todayKey();
    const tj = toJalali(today);
    const [jy, jm] = m && /^\d{4}-\d{1,2}$/.test(m) ? m.split("-").map(Number) : [tj.year, tj.month];
    const { start, end } = jalaliMonthBounds(fromJalali(jy, jm, 1)!);
    const inMonth = { gte: start, lte: end };
    const seeCheques = can(guard.access, "ACC_VIEW") || can(guard.access, "ACC_CHEQUE");
    const seeSales = can(guard.access, "ACC_VIEW") || can(guard.access, "ACC_SALES");
    const seeBuy = can(guard.access, "ACC_VIEW") || can(guard.access, "ACC_PURCHASE");
    const items: Item[] = [];

    if (seeCheques) {
      const cheques = await prisma.accCheque.findMany({
        where: { dueDate: inMonth, status: { not: "RETURNED" } },
        include: { party: { select: { name: true } } },
      });
      for (const c of cheques) {
        const rec = c.direction === "RECEIVED";
        items.push({
          kind: "cheque",
          dir: rec ? "in" : "out",
          id: c.id,
          date: c.dueDate,
          amount: c.amount,
          title: `${rec ? "چک از" : "چک به"} ${c.party.name}`,
          sub: `شماره‌ی ${c.serialNo} · ${c.bankName}`,
          href: `/admin/accounting/cheques/${c.id}`,
          done: c.status === "CLEARED" || c.status === "ENDORSED",
          bad: c.status === "BOUNCED",
        });
      }
    }

    const types = [...(seeSales ? ["SALES" as const] : []), ...(seeBuy ? ["PURCHASE" as const] : [])];
    if (types.length) {
      const rows = await planRows(prisma, { invoice: { type: { in: types }, status: "ISSUED" }, items: { some: { dueDate: inMonth } } });
      for (const r of rows) {
        if (r.dueDate < start || r.dueDate > end || r.cheque) continue; // قسط چک‌دار همان چک است
        const sales = r.invoice.type === "SALES";
        items.push({
          kind: "installment",
          dir: sales ? "in" : "out",
          id: r.id,
          date: r.dueDate,
          amount: r.left > 0n ? r.left : r.amount,
          title: `قسط ${r.seq} از ${r.count} — ${r.party.name}`,
          sub: `فاکتور ${sales ? "فروش" : "خرید"} ${r.invoice.number ?? ""}`,
          href: `/admin/accounting/invoices/${r.invoice.id}#installments`,
          done: r.left === 0n,
        });
      }
      const invs = await prisma.accInvoice.findMany({
        where: { type: { in: types }, status: "ISSUED", dueDate: inMonth, installmentPlan: null },
        select: { id: true, type: true, number: true, dueDate: true, partyName: true },
      });
      const open = await invoiceOpenAmounts(prisma, invs.map((i) => i.id));
      for (const i of invs) {
        const o = open.get(i.id);
        items.push({
          kind: "invoice",
          dir: i.type === "SALES" ? "in" : "out",
          id: i.id,
          date: i.dueDate!,
          amount: o && o.open > 0n ? o.open : (o?.total ?? 0n),
          title: `${i.type === "SALES" ? "طلب از" : "بدهی به"} ${i.partyName}`,
          sub: `سررسید فاکتور ${i.type === "SALES" ? "فروش" : "خرید"} ${i.number ?? ""}`,
          href: `/admin/accounting/invoices/${i.id}`,
          done: !o || o.open === 0n,
        });
      }
    }

    items.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.dir === b.dir ? 0 : a.dir === "in" ? -1 : 1));
    const pending = items.filter((i) => !i.done);
    const tBal = can(guard.access, "ACC_VIEW") ? await balancesBy(prisma, "treasuryId") : null;
    const cash = tBal ? [...tBal.values()].reduce((s, b) => s + b.balance, 0n) : null;
    return NextResponse.json(
      serialize({
        month: { year: jy, month: jm, start, end },
        today,
        items,
        totals: {
          in: pending.filter((i) => i.dir === "in").reduce((s, i) => s + i.amount, 0n),
          out: pending.filter((i) => i.dir === "out").reduce((s, i) => s + i.amount, 0n),
          overdue: pending.filter((i) => i.date < today).length,
          cash,
        },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-calendar]");
  }
}
