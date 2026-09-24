import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { currentYear } from "@/lib/accounting/ledger/fiscal-year";
import { openingKey } from "@/lib/accounting/setup";
import { todayKey } from "@/lib/accounting/dates";
import { monthDashboard } from "@/lib/accounting/reports/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * داشبورد حسابداری داخلی — نقد، طلب، بدهی، بدهکاران اصلی، «شروع کار»، و عددهای
 * ماه جاری (فروش، هزینه، سری روزانه، کارهای مانده). بها و سود ناخالص فقط با
 * `ACC_COST_VIEW`.
 */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [settings, year, treasuries, tBal, pBal, voucherCount] = await Promise.all([
    prisma.accSettings.findUnique({ where: { id: "singleton" } }),
    currentYear(),
    prisma.accTreasury.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    balancesBy(prisma, "treasuryId"),
    balancesBy(prisma, "partyId"),
    prisma.accVoucher.count({ where: { status: "POSTED" } }),
  ]);

  let cash = 0n;
  const treasuryRows = treasuries.map((t) => {
    const b = tBal.get(t.id)?.balance ?? 0n;
    cash += b;
    return { id: t.id, name: t.name, kind: t.kind, balance: b };
  });

  let receivable = 0n;
  let payable = 0n;
  const debtorIds: { id: string; balance: bigint }[] = [];
  for (const [id, b] of pBal) {
    if (b.balance > 0n) {
      receivable += b.balance;
      debtorIds.push({ id, balance: b.balance });
    } else payable -= b.balance;
  }
  debtorIds.sort((a, b) => (b.balance > a.balance ? 1 : -1));
  const top = debtorIds.slice(0, 5);
  const names = new Map(
    (await prisma.accParty.findMany({ where: { id: { in: top.map((t) => t.id) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  );

  // چک‌های سررسید تا ۷ روز آینده (با سررسیدگذشته‌های باز) — بخش ۱۱ داشبورد
  const week = new Date(todayKey().getTime() + 7 * 86_400_000);
  const [chequesIn, chequesOut] = await Promise.all([
    prisma.accCheque.aggregate({ where: { direction: "RECEIVED", status: { in: ["IN_HAND", "IN_COLLECTION"] }, dueDate: { lte: week } }, _sum: { amount: true }, _count: true }),
    prisma.accCheque.aggregate({ where: { direction: "ISSUED", status: "ISSUED", dueDate: { lte: week } }, _sum: { amount: true }, _count: true }),
  ]);

  const cost = can(guard.access, "ACC_COST_VIEW");
  const m = settings?.mode === "INTERNAL" ? await monthDashboard(prisma) : null;
  const month = m && {
    from: m.month.from,
    to: m.month.to,
    netSales: m.totals.netSales,
    expenses: m.totals.expenses,
    gross: cost ? m.totals.gross : null,
    net: cost ? m.totals.net : null,
    prev: m.prevTotals && { netSales: m.prevTotals.netSales, expenses: m.prevTotals.expenses, gross: cost ? m.prevTotals.gross : null, net: cost ? m.prevTotals.net : null },
    series: { days: m.series.days, sales: m.series.sales, expenses: m.series.expenses, gross: cost ? m.series.sales.map((v, i) => v - m.series.cogs[i]) : null },
    alerts: m.alerts,
  };

  const hasOpening = year
    ? !!(await prisma.accVoucher.findFirst({ where: { source: "OPENING", sourceId: openingKey(year.id), status: "POSTED" }, select: { id: true } }))
    : false;

  return NextResponse.json(
    serialize({
      mode: settings?.mode ?? "NONE",
      year,
      lockDate: settings?.lockDate ?? null,
      cash,
      treasuries: treasuryRows,
      receivable,
      payable,
      topDebtors: top.map((t) => ({ id: t.id, name: names.get(t.id) ?? "—", balance: t.balance })),
      checklist: {
        bank: treasuries.some((t) => t.kind === "BANK"),
        opening: hasOpening,
        seller: !!settings?.sellerName,
        parties: (await prisma.accParty.count()) > 0,
      },
      voucherCount,
      month,
      can: { reports: can(guard.access, "ACC_REPORTS"), cost },
      cheques: {
        in: { count: chequesIn._count, total: chequesIn._sum.amount ?? 0n },
        out: { count: chequesOut._count, total: chequesOut._sum.amount ?? 0n },
      },
    }),
  );
}
