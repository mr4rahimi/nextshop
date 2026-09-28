/**
 * روند ماهانه — نمودار فروش، سود و هزینه و جریان نقد در ۱۲ ماه شمسی اخیر
 * (docs/plans/accounting.md بخش ۱۱، فاز ۱۰).
 *
 * دسته‌بندی حساب‌ها همان `profitLoss` است (فروش خالص = حساب‌های کلِ فروش،
 * بهای تمام‌شده = گروه COGS، …) تا جمع ماه‌ها با سود و زیان همان بازه بخواند.
 * سند اختتامیه کنار است. جریان نقد: ردیف‌های خزانه‌ای، بی‌انتقال بین حساب‌ها
 * (پول از جیب به جیب ورود و خروج نیست) و بی‌افتتاحیه/اختتامیه.
 */

import { toJalali } from "@/lib/club/jalali";
import { jalaliMonthBounds, todayKey } from "../dates";
import { accountIndex, type Db } from "./common";
import { profitLoss } from "./statements";

const DAY_MS = 86_400_000;

export async function monthlyTrend(db: Db, months = 12) {
  const today = todayKey();
  // مرز ماه‌ها — از ماه جاری عقب
  const bounds: { key: string; label: string; start: Date; end: Date }[] = [];
  let cur = jalaliMonthBounds(today);
  for (let i = 0; i < months; i++) {
    const j = toJalali(cur.start);
    bounds.unshift({ key: `${j.year}-${String(j.month).padStart(2, "0")}`, label: "", start: cur.start, end: cur.end });
    cur = jalaliMonthBounds(new Date(cur.start.getTime() - DAY_MS));
  }
  const from = bounds[0].start;
  const to = bounds[bounds.length - 1].end;

  const [pl, idx] = await Promise.all([profitLoss(db, { from, to }, null), accountIndex(db)]);
  const salesIds = new Set(pl.groups.sales.lines.map((l) => l.accountId));
  const cogsIds = new Set(pl.groups.cogs.lines.map((l) => l.accountId));
  // حساب‌هایی که در بازه گردش نداشتند در `pl` نیستند — از درخت هم دسته‌شان را پیدا کن
  const cogsGroup = idx.chain(idx.byKey.get("COGS")?.id ?? "").find((a) => a.level === "GROUP");
  const salesLedger = idx.chain(idx.byKey.get("SALES")?.id ?? "").find((a) => a.level === "LEDGER");
  const kindOf = (accountId: string): "sales" | "cogs" | "other" | "expense" | null => {
    if (salesIds.has(accountId) || idx.chain(accountId).some((a) => a.id === salesLedger?.id)) return "sales";
    if (cogsIds.has(accountId) || idx.chain(accountId).some((a) => a.id === cogsGroup?.id)) return "cogs";
    const a = idx.byId.get(accountId);
    if (a?.class === "REVENUE") return "other";
    if (a?.class === "EXPENSE") return "expense";
    return null;
  };

  const [pnl, cash] = await Promise.all([
    db.accVoucherLine.groupBy({
      by: ["date", "accountId"],
      where: { isVoid: false, date: { gte: from, lte: to }, account: { class: { in: ["REVENUE", "EXPENSE"] } }, voucher: { source: { not: "CLOSING" } } },
      _sum: { debit: true, credit: true },
    }),
    db.accVoucherLine.groupBy({
      by: ["date"],
      where: { isVoid: false, treasuryId: { not: null }, date: { gte: from, lte: to }, voucher: { source: { notIn: ["TRANSFER", "OPENING", "CLOSING"] } } },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const pos = (d: Date) => bounds.findIndex((b) => d.getTime() >= b.start.getTime() && d.getTime() <= b.end.getTime());
  const z = () => bounds.map(() => 0n);
  const sales = z(), cogs = z(), other = z(), expenses = z(), cashIn = z(), cashOut = z();
  for (const r of pnl) {
    const i = pos(r.date);
    if (i < 0) continue;
    const d = r._sum.debit ?? 0n;
    const c = r._sum.credit ?? 0n;
    switch (kindOf(r.accountId)) {
      case "sales":
        sales[i] += c - d;
        break;
      case "cogs":
        cogs[i] += d - c;
        break;
      case "other":
        other[i] += c - d;
        break;
      case "expense":
        expenses[i] += d - c;
        break;
    }
  }
  for (const r of cash) {
    const i = pos(r.date);
    if (i < 0) continue;
    cashIn[i] += r._sum.debit ?? 0n;
    cashOut[i] += r._sum.credit ?? 0n;
  }
  const gross = sales.map((s, i) => s - cogs[i]);
  const net = gross.map((g, i) => g + other[i] - expenses[i]);
  const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);
  return {
    months: bounds.map((b) => ({ key: b.key, from: b.start, to: b.end })),
    sales,
    cogs,
    gross,
    otherIncome: other,
    expenses,
    net,
    cashIn,
    cashOut,
    totals: { sales: sum(sales), gross: sum(gross), expenses: sum(expenses), net: sum(net), cashIn: sum(cashIn), cashOut: sum(cashOut) },
  };
}
