/**
 * سنی بدهی — طلب از مشتریان (یا بدهی به تأمین‌کنندگان) به تفکیک عمر.
 *
 * هر فاکتور باز (`invoiceOpenAmounts`: جمع − برگشتی − تخصیص) در ستون عمرش
 * می‌نشیند؛ عمر از سررسید (یا تاریخ فاکتور اگر سررسید ندارد) تا امروز است.
 * ستون «مانده‌ی کل شخص» از دفتر است تا پیش‌دریافت‌ها و مانده‌های بی‌فاکتور
 * (اول دوره، سند دستی) هم دیده شوند — اختلافش با جمع فاکتورها همین‌هاست.
 */

import { invoiceOpenAmounts } from "../cash/allocation";
import { balancesBy } from "../ledger/balances";
import { todayKey } from "../dates";
import type { Db } from "./common";

export const AGING_BUCKETS = ["notDue", "d30", "d60", "d90", "d90plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export interface AgingRow {
  partyId: string;
  name: string;
  mobile: string | null;
  buckets: Record<AgingBucket, bigint>;
  invoices: number;
  open: bigint;
  /** مانده‌ی کل شخص در دفتر (مثبت = طلب ما) */
  balance: bigint;
}

const DAY = 86_400_000;

export function bucketOf(ageDays: number): AgingBucket {
  if (ageDays < 0) return "notDue";
  if (ageDays <= 30) return "d30";
  if (ageDays <= 60) return "d60";
  if (ageDays <= 90) return "d90";
  return "d90plus";
}

export async function aging(db: Db, side: "sales" | "purchase") {
  const today = todayKey();
  const invs = await db.accInvoice.findMany({
    where: { status: "ISSUED", type: side === "sales" ? "SALES" : "PURCHASE" },
    select: { id: true, partyId: true, date: true, dueDate: true },
  });
  const open = await invoiceOpenAmounts(db, invs.map((i) => i.id));
  const bal = await balancesBy(db, "partyId");

  const rows = new Map<string, AgingRow>();
  for (const inv of invs) {
    const o = open.get(inv.id)?.open ?? 0n;
    if (o <= 0n) continue;
    let r = rows.get(inv.partyId);
    if (!r) {
      r = { partyId: inv.partyId, name: "", mobile: null, buckets: { notDue: 0n, d30: 0n, d60: 0n, d90: 0n, d90plus: 0n }, invoices: 0, open: 0n, balance: bal.get(inv.partyId)?.balance ?? 0n };
      rows.set(inv.partyId, r);
    }
    const age = Math.floor((today.getTime() - (inv.dueDate ?? inv.date).getTime()) / DAY);
    r.buckets[bucketOf(age)] += o;
    r.invoices++;
    r.open += o;
  }
  const parties = await db.accParty.findMany({ where: { id: { in: [...rows.keys()] } }, select: { id: true, name: true, mobile: true } });
  for (const p of parties) {
    const r = rows.get(p.id)!;
    r.name = p.name;
    r.mobile = p.mobile;
  }
  const list = [...rows.values()].sort((a, b) => (b.open > a.open ? 1 : b.open < a.open ? -1 : 0));
  const totals = { notDue: 0n, d30: 0n, d60: 0n, d90: 0n, d90plus: 0n, open: 0n } as Record<AgingBucket | "open", bigint>;
  for (const r of list) {
    for (const b of AGING_BUCKETS) totals[b] += r.buckets[b];
    totals.open += r.open;
  }
  return { rows: list, totals };
}
