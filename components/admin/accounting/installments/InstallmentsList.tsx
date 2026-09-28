"use client";

/**
 * «اقساط» — همه‌ی قسط‌های فروش و خرید اقساطی. docs/plans/accounting.md بخش ۹.۳.
 * نماها: سررسید گذشته، این هفته، این ماه، باز، همه. کنار هر قسط «دریافت/پرداخت»
 * با مبلغ همان قسط.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader, Segmented, Stat } from "../ui";
import { StateBadge, type InstRow } from "./shared";

type View = "overdue" | "week" | "month" | "open" | "all";
interface Data {
  rows: InstRow[];
  truncated: boolean;
  counts: Record<View, number>;
  totals: { plans: number; overdue: string; open: string; paid: string; view: string };
  can: { pay: boolean };
}

export default function InstallmentsList() {
  const sp = useSearchParams();
  const router = useRouter();
  const side = sp.get("side") === "purchase" ? "purchase" : "sales";
  const [view, setView] = useState<View>((sp.get("view") as View) || "open");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sales = side === "sales";

  const load = useCallback(() => {
    const p = new URLSearchParams({ side, view });
    if (q.trim()) p.set("q", q.trim());
    api<Data>(`/api/admin/accounting/installments?${p}`).then(setD).catch((e) => setError(e.message));
  }, [side, view, q]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  // گروه‌بندی بر اساس روز سررسید
  const groups: [string, InstRow[]][] = [];
  for (const r of d?.rows ?? []) {
    const k = r.dueDate.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last[0] === k) last[1].push(r);
    else groups.push([k, [r]]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="اقساط"
        help="accountingInstallments"
        desc={sales ? "قسط‌هایی که مشتری‌ها باید بپردازند." : "قسط‌هایی که شما باید به تأمین‌کننده‌ها بپردازید."}
        actions={
          <Link href="/admin/accounting/calendar" className={btn.soft}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            تقویم سررسیدها
          </Link>
        }
      />
      <Segmented
        value={side}
        onChange={(v) => router.replace(`/admin/accounting/installments?side=${v}`)}
        options={[
          { value: "sales", label: "فروش — دریافتنی" },
          { value: "purchase", label: "خرید — پرداختنی" },
        ]}
      />

      {d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="برنامه‌های اقساط" value={faNum(d.totals.plans)} />
          <Stat label="سررسید گذشته" value={<Money value={d.totals.overdue} tone={BigInt(d.totals.overdue) > 0n ? "red" : "gray"} />} sub={`${faNum(d.counts.overdue)} قسط`} tone="red" />
          <Stat label={sales ? "مانده برای دریافت" : "مانده برای پرداخت"} value={<Money value={d.totals.open} />} sub={`${faNum(d.counts.open)} قسط`} />
          <Stat label={sales ? "دریافت‌شده" : "پرداخت‌شده"} value={<Money value={d.totals.paid} tone="green" />} />
        </div>
      )}

      <Chips<View>
        value={view}
        onChange={setView}
        options={[
          { value: "overdue", label: "سررسید گذشته", count: d?.counts.overdue },
          { value: "week", label: "این هفته", count: d?.counts.week },
          { value: "month", label: "این ماه", count: d?.counts.month },
          { value: "open", label: "باز", count: d?.counts.open },
          { value: "all", label: "همه", count: d?.counts.all },
        ]}
      />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: نام یا موبایل" className={inputCls} />
      <ErrorText>{error}</ErrorText>

      <Card className="overflow-hidden">
        {groups.map(([day, rows]) => (
          <div key={day}>
            <div className="px-4 py-1.5 bg-gray-50 dark:bg-white/[0.03] text-[11px] font-bold text-gray-500 flex justify-between">
              <span>{formatJalali(new Date(day))}</span>
              <span>{formatAmount(rows.reduce((s, r) => s + BigInt(r.left), 0n))}</span>
            </div>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/5">
                <Link href={`/admin/accounting/invoices/${r.invoice.id}#installments`} className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 text-[11px] font-black flex flex-col items-center justify-center shrink-0 leading-4">
                    {faNum(r.seq)}
                    <span className="text-[9px] font-bold opacity-70">از {faNum(r.count)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{r.party.name}</span>
                    <span className="block text-[11px] text-gray-400 truncate">
                      فاکتور {faNum(r.invoice.number ?? 0)}
                      {r.cheque && ` · چک ${faNum(r.cheque.serialNo)}`}
                      {r.party.mobile && ` · ${faNum(r.party.mobile)}`}
                    </span>
                  </span>
                </Link>
                <div className="text-left space-y-1 shrink-0">
                  <Money value={BigInt(r.left) > 0n ? r.left : r.amount} className="text-sm" tone={r.state === "OVERDUE" ? "red" : undefined} />
                  <div>
                    <StateBadge row={r} />
                  </div>
                </div>
                {d?.can.pay && BigInt(r.left) > 0n && !r.cheque && (
                  <Link
                    href={`/admin/accounting/money/new?kind=${sales ? "RECEIPT" : "PAYMENT"}&partyId=${r.party.id}&invoiceId=${r.invoice.id}&amount=${r.left}`}
                    className={`${btn.small} hidden sm:inline-flex`}
                  >
                    {sales ? "دریافت" : "پرداخت"}
                  </Link>
                )}
              </div>
            ))}
          </div>
        ))}
        {d && !d.rows.length && (
          <Empty
            title={view === "overdue" ? "قسط سررسیدگذشته‌ای نیست 🎉" : "قسطی در این نما نیست"}
            desc={`برای ${sales ? "فروش" : "خرید"} اقساطی، فاکتور را صادر کنید و در صفحه‌ی فاکتور «قسط‌بندی» را بزنید.`}
            action={
              <Link href={sales ? "/admin/accounting/sales" : "/admin/accounting/purchases"} className={btn.primary}>
                {sales ? "فاکتورهای فروش" : "فاکتورهای خرید"}
              </Link>
            }
          />
        )}
        {d?.truncated && <p className="px-4 py-2 text-[11px] text-gray-400">فقط ۵۰۰ قسط اول نشان داده شد؛ جستجو را دقیق‌تر کنید.</p>}
      </Card>
    </div>
  );
}
