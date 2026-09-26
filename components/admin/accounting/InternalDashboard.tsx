"use client";

/**
 * خانه‌ی حسابداری داخلی — docs/plans/accounting.md بخش ۱۱ (داشبورد) و ۱۳.
 *
 * بالا: سه عددی که صاحب کسب‌وکار هر روز می‌خواهد (پول نقد، طلب، بدهی).
 * «این ماه»: فروش خالص، سود ناخالص، هزینه و سود خالص از اول ماه شمسی، با
 * نمودار روزانه (نمای جدول هم دارد) و مقایسه با همین تعداد روزِ قبل.
 * «کارهای مانده»: رویداد گیرکرده، فاکتور سررسیدگذشته، کالای منفی یا کم.
 * «شروع کار»: تا وقتی کامل نشده، قدم بعدی را جلوی چشم نگه می‌دارد.
 * سود ناخالص و خالص فقط با مجوز «دیدن بهای تمام‌شده» از سرور می‌آید.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayLabel, MultiLineChart, type Series } from "@/components/admin/reports/charts";
import { Amt, Change, SERIES, useIsDark } from "./reports/kit";
import { api, BalanceLabel, Card, Money, PageHeader, SectionTitle, Stat, btn } from "./ui";
import { faNum, formatAmount } from "@/lib/accounting/money";
import {
  AlarmClock, ChartColumn, ChartLine, ChevronLeft, CreditCard, Globe, Landmark, Package, Plus,
  Table2, TrendingDown, Wallet, Zap, type LucideIcon,
} from "lucide-react";
import { AppGrid } from "../AppGrid";
import { useAccountingShell } from "./AccountingShell";

interface Summary {
  year: { title: string; startDate: string; endDate: string } | null;
  lockDate: string | null;
  cash: string;
  treasuries: { id: string; name: string; kind: string; balance: string }[];
  receivable: string;
  payable: string;
  topDebtors: { id: string; name: string; balance: string }[];
  checklist: { bank: boolean; opening: boolean; seller: boolean; parties: boolean };
  voucherCount: number;
  cheques: { in: { count: number; total: string }; out: { count: number; total: string } };
  month: {
    from: string;
    to: string;
    netSales: string;
    expenses: string;
    gross: string | null;
    net: string | null;
    prev: { netSales: string; expenses: string; gross: string | null; net: string | null } | null;
    series: { days: string[]; sales: string[]; expenses: string[]; gross: string[] | null };
    alerts: { events: number; overdue: string; overdueCount: number; negative: number; lowStock: number };
  } | null;
  can: { reports: boolean; cost: boolean };
}

const KIND_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  CASH: { icon: Wallet, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  BANK: { icon: Landmark, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  POS: { icon: CreditCard, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  GATEWAY: { icon: Globe, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
};

export default function InternalDashboard({ canLeave, onLeft }: { canLeave: boolean; onLeft: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shell = useAccountingShell();

  const load = useCallback(() => {
    api<Summary>("/api/admin/accounting/summary")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function leave() {
    if (!window.confirm("حسابداری داخلی خاموش شود؟ هنوز سندی ثبت نشده، پس چیزی از دست نمی‌رود.")) return;
    try {
      await api("/api/admin/accounting/settings", { method: "PATCH", json: { mode: "NONE" } });
      onLeft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    }
  }

  if (!data) return error ? <p className="text-xs font-bold text-red-600">{error}</p> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const steps = [
    { done: true, label: "حسابداری داخلی راه‌اندازی شد", href: null },
    { done: data.checklist.bank, label: "حساب‌های بانکی، کارتخوان و درگاه را اضافه کنید", href: "/admin/accounting/treasury?new=1" },
    { done: data.checklist.opening, label: "موجودی صندوق و بانک و طلب و بدهی اول دوره را وارد کنید", href: "/admin/accounting/opening" },
    { done: data.checklist.seller, label: "اطلاعات کسب‌وکار را برای فاکتور رسمی کامل کنید", href: "/admin/accounting/settings?tab=seller" },
  ];
  const pending = steps.filter((s) => !s.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="حسابداری"
        help="accounting"
        desc={
          data.year ? (
            <>
              سال مالی {faNum(data.year.title)} — از {formatJalali(new Date(data.year.startDate))} تا {formatJalali(new Date(data.year.endDate))}
              {data.lockDate && <> · دفاتر تا {formatJalali(new Date(data.lockDate))} قفل است</>}
            </>
          ) : (
            "سال مالی جاری تعریف نشده است"
          )
        }
        actions={
          shell && (
            <button onClick={shell.openQuick} className={`${btn.primary} hidden md:inline-flex shadow-lg shadow-blue-600/20`}>
              <Plus className="h-4 w-4" aria-hidden />
              ثبت سریع
            </button>
          )
        }
      />

      {/* بخش‌ها به شکل کاشی اپ — «خانه» همین صفحه است و کاشی نمی‌خواهد */}
      {shell && (
        <Card className="px-2 py-2 sm:px-3">
          <AppGrid
            apps={shell.apps.filter((a) => a.href !== "/admin/accounting")}
            badges={data.month?.alerts.events ? { "/admin/accounting/events": data.month.alerts.events } : undefined}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="پول نقد و بانک" value={<Money value={data.cash} />} href="/admin/accounting/treasury" />
        <Stat label="طلب از اشخاص" value={<Money value={data.receivable} tone="green" />} href="/admin/accounting/parties?balance=debtor" />
        <Stat label="بدهی به اشخاص" value={<Money value={data.payable} tone="red" />} href="/admin/accounting/parties?balance=creditor" />
      </div>

      {data.month && <MonthSection m={data.month} canReports={data.can.reports} />}

      {(data.cheques.in.count > 0 || data.cheques.out.count > 0) && (
        <Card className="p-4">
          <SectionTitle title="چک‌های ۷ روز آینده" help="accountingCheques" />
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={`دریافتی — ${faNum(data.cheques.in.count)} چک`}
              value={<Money value={data.cheques.in.total} tone="green" />}
              sub="وصول کنید"
              href="/admin/accounting/cheques?dir=RECEIVED&view=week"
            />
            <Stat
              label={`صادره — ${faNum(data.cheques.out.count)} چک`}
              value={<Money value={data.cheques.out.total} tone="amber" />}
              sub="موجودی بانک را چک کنید"
              href="/admin/accounting/cheques?dir=ISSUED&view=week"
            />
          </div>
        </Card>
      )}

      {pending > 0 && (
        <Card className="p-4">
          <SectionTitle title={`شروع کار — ${formatAmount(pending)} قدم مانده`} help="accountingSetup" />
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                    s.done ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-white/10 text-gray-500"
                  }`}
                >
                  {s.done ? "✓" : formatAmount(i + 1)}
                </span>
                {s.done || !s.href ? (
                  <span className={`text-sm ${s.done ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-100"}`}>{s.label}</span>
                ) : (
                  <Link href={s.href} className="text-sm font-bold text-blue-600 hover:underline">
                    {s.label} ←
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <SectionTitle
            title="صندوق و بانک"
            help="accountingTreasury"
            actions={
              <Link href="/admin/accounting/treasury" className="text-xs font-bold text-blue-600">
                همه ←
              </Link>
            }
          />
          <Card className="divide-y divide-gray-100 dark:divide-white/5">
            {data.treasuries.map((t) => (
              <Link key={t.id} href={`/admin/accounting/treasury/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="flex items-center gap-2.5 min-w-0">
                  <KindIcon kind={t.kind} />
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{t.name}</span>
                </span>
                <BalanceLabel balance={t.balance} kind="treasury" />
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle
            title="بیشترین طلب‌ها"
            actions={
              <Link href="/admin/accounting/parties?balance=debtor" className="text-xs font-bold text-blue-600">
                همه ←
              </Link>
            }
          />
          <Card className="divide-y divide-gray-100 dark:divide-white/5">
            {data.topDebtors.map((p) => (
              <Link key={p.id} href={`/admin/accounting/parties/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{p.name}</span>
                <BalanceLabel balance={p.balance} />
              </Link>
            ))}
            {!data.topDebtors.length && <p className="px-4 py-6 text-center text-xs text-gray-400">فعلاً از کسی طلبی نیست.</p>}
          </Card>
        </section>
      </div>

      {(data.can.reports || (canLeave && data.voucherCount === 0)) && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">گزارش‌های مالی</p>
            <p className="text-xs text-gray-500 mt-1 leading-6">سود و زیان، ترازنامه، سنی بدهی، سود هر کالا، ارزش افزوده و بقیه — با خروجی اکسل و چاپ.</p>
          </div>
          <div className="flex gap-2">
            {data.can.reports && (
              <Link href="/admin/accounting/reports" className={btn.primary}>
                <ChartColumn className="h-4 w-4" aria-hidden />
                گزارش‌ها
              </Link>
            )}
            {canLeave && data.voucherCount === 0 && (
              <button onClick={leave} className={btn.soft}>
                خاموش کردن حسابداری داخلی
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

type Month = NonNullable<Summary["month"]>;

/** عددهای ماه جاری + نمودار روزانه + کارهای مانده */
function MonthSection({ m, canReports }: { m: Month; canReports: boolean }) {
  const dark = useIsDark();
  const [table, setTable] = useState(false);
  const c = dark ? SERIES.dark : SERIES.light;
  const series: Series[] = [
    { key: "sales", label: "فروش خالص", color: c.sales, data: m.series.sales.map(Number) },
    ...(m.series.gross ? [{ key: "gross", label: "سود ناخالص", color: c.gross, data: m.series.gross.map(Number) }] : []),
    { key: "expenses", label: "هزینه‌ها", color: c.expenses, data: m.series.expenses.map(Number) },
  ];
  const tiles = [
    { label: "فروش خالص", v: m.netSales, p: m.prev?.netSales ?? null, href: "/admin/accounting/reports/pl" },
    ...(m.gross !== null ? [{ label: "سود ناخالص", v: m.gross, p: m.prev?.gross ?? null, href: "/admin/accounting/reports/profit" }] : []),
    { label: "هزینه‌ها", v: m.expenses, p: m.prev?.expenses ?? null, href: "/admin/accounting/reports/expenses", bad: true },
    ...(m.net !== null ? [{ label: "سود خالص", v: m.net, p: m.prev?.net ?? null, href: "/admin/accounting/reports/pl" }] : []),
  ];
  const a = m.alerts;
  const alerts = [
    a.events > 0 && { icon: Zap, text: `${faNum(a.events)} ثبت خودکار گیر کرده`, href: "/admin/accounting/events", tone: "text-red-600" },
    a.overdueCount > 0 && { icon: AlarmClock, text: `${faNum(a.overdueCount)} فاکتور سررسیدگذشته — ${formatAmount(a.overdue)} تومان`, href: "/admin/accounting/reports/aging", tone: "text-red-600" },
    a.negative > 0 && { icon: TrendingDown, text: `${faNum(a.negative)} کالا با موجودی منفی`, href: "/admin/accounting/inventory?filter=negative", tone: "text-amber-600" },
    a.lowStock > 0 && { icon: Package, text: `${faNum(a.lowStock)} کالا زیر نقطه‌ی سفارش`, href: "/admin/accounting/inventory?filter=low", tone: "text-amber-600" },
  ].filter(Boolean) as { icon: LucideIcon; text: string; href: string; tone: string }[];

  return (
    <>
      <section>
        <SectionTitle title={`این ماه — از ${formatJalali(new Date(m.from))}`} help="accounting" />
        {/* موبایل: کارت‌های افقی قابل اسکرول (بخش ۱۳.۳) */}
        <div className="flex sm:grid sm:grid-cols-4 gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x">
          {tiles.map((t) => {
            const inner = (
              <Card className="p-4 min-w-[10.5rem] snap-start h-full">
                <p className="text-[11px] text-gray-500">{t.label}</p>
                <p className="text-lg mt-1">
                  <Amt v={t.v} strong />
                </p>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Change cur={t.v} prev={t.p} goodWhenUp={!t.bad} />
                  {t.p !== null && <span>نسبت به همین روزهای ماه قبل</span>}
                </div>
              </Card>
            );
            return canReports ? (
              <Link key={t.label} href={t.href} className="shrink-0 sm:shrink">
                {inner}
              </Link>
            ) : (
              <div key={t.label} className="shrink-0 sm:shrink">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <Card className="p-4 space-y-3">
        <SectionTitle
          title="روز به روز"
          actions={
            <button onClick={() => setTable((x) => !x)} className={btn.small}>
              {table ? <ChartLine className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
              {table ? "نمودار" : "نمای جدول"}
            </button>
          }
        />
        {table ? (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-right py-1.5 px-2">روز</th>
                  {series.map((s) => (
                    <th key={s.key} className="text-left py-1.5 px-2">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {m.series.days.map((d, i) => (
                  <tr key={d}>
                    <td className="py-1.5 px-2 whitespace-nowrap">{dayLabel(d)}</td>
                    {series.map((s) => (
                      <td key={s.key} className="py-1.5 px-2 text-left">
                        <Amt v={String(s.data[i])} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <MultiLineChart id="acc-month" days={m.series.days} series={series} height={240} />
        )}
      </Card>

      {alerts.length > 0 && (
        <Card className="p-4">
          <SectionTitle title="کارهای مانده" />
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {alerts.map((x) => (
              <Link key={x.href} href={x.href} className="group flex items-center gap-3 py-2.5 text-sm">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-current/10 ${x.tone}`}>
                  <x.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className={`font-bold ${x.tone}`}>{x.text}</span>
                <ChevronLeft className="mr-auto h-4 w-4 text-gray-400 transition-transform group-hover:-translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function KindIcon({ kind }: { kind: string }) {
  const k = KIND_ICON[kind] ?? KIND_ICON.CASH;
  return (
    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] ${k.cls}`}>
      <k.icon className="h-4 w-4" aria-hidden />
    </span>
  );
}
