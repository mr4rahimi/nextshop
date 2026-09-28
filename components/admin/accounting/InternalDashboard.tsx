"use client";

/**
 * خانه‌ی حسابداری داخلی — docs/plans/accounting.md بخش ۱۱ (داشبورد) و ۱۳،
 * ظاهر: docs/features/admin-ui.md بخش «تم سه‌بعدی حسابداری».
 *
 * اول کاشی بخش‌ها (کنسول برجسته)، بعد سه عددی که صاحب کسب‌وکار هر روز
 * می‌خواهد (پول نقد، طلب، بدهی) و ترکیب پول نقد به تفکیک نوع حساب.
 * «این ماه»: فروش خالص، سود ناخالص، هزینه و سود خالص از اول ماه شمسی، با
 * نمودار روزانه (نمای جدول هم دارد) و مقایسه با همین تعداد روزِ قبل.
 * «کارهای مانده»: رویداد گیرکرده، فاکتور سررسیدگذشته، کالای منفی یا کم.
 * «شروع کار»: تا وقتی کامل نشده، قدم بعدی را جلوی چشم نگه می‌دارد.
 * سود ناخالص و خالص فقط با مجوز «دیدن بهای تمام‌شده» از سرور می‌آید.
 * خاموش کردن حسابداری داخلی (تا وقتی سندی نیست) از ۲.۶۳.۰ در «تنظیمات ›
 * حسابداری کسب‌وکار» است.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayLabel, DonutChart, MultiLineChart, type Series } from "@/components/admin/reports/charts";
import { Amt, Change, SERIES, useIsDark } from "./reports/kit";
import { api, BalanceLabel, Card, Money, PageHeader, SectionTitle, Stat, btn } from "./ui";
import type { ReactNode } from "react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import {
  AlarmClock, ArrowDownLeft, ArrowUpRight, ChartColumn, ChartLine, ChevronLeft, CreditCard, Globe, Landmark, Package, Plus,
  Settings, Table2, TrendingDown, Wallet, Zap, type LucideIcon,
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
    alerts: { events: number; overdue: string; overdueCount: number; negative: number; lowStock: number; installments?: number; installmentsDue?: string };
  } | null;
  can: { reports: boolean; cost: boolean };
}

const KIND_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  CASH: { icon: Wallet, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  BANK: { icon: Landmark, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  POS: { icon: CreditCard, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  GATEWAY: { icon: Globe, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
};

export default function InternalDashboard() {
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
          <>
            <Link href="/admin/accounting/settings" className={btn.soft} aria-label="تنظیمات حسابداری" title="تنظیمات حسابداری">
              <Settings className="h-4 w-4" aria-hidden />
            </Link>
            {shell && (
              <button onClick={shell.openQuick} className={`${btn.primary} hidden md:inline-flex`}>
                <Plus className="h-4 w-4" aria-hidden />
                ثبت سریع
              </button>
            )}
          </>
        }
      />

      {/* بخش‌ها به شکل کاشی اپ — «خانه» همین صفحه است و کاشی نمی‌خواهد */}
      {shell && (
        <Card className="px-2 py-3 sm:px-4">
          <AppGrid
            apps={shell.apps.filter((a) => a.href !== "/admin/accounting")}
            badges={data.month?.alerts.events ? { "/admin/accounting/events": data.month.alerts.events } : undefined}
            wide
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          icon={Wallet}
          tone="blue"
          label="پول نقد و بانک"
          value={<Money value={data.cash} className="text-xl sm:text-2xl" />}
          sub={`${faNum(data.treasuries.length)} صندوق و حساب`}
          href="/admin/accounting/treasury"
        />
        <Kpi
          icon={ArrowDownLeft}
          tone="emerald"
          label="طلب از اشخاص"
          value={<Money value={data.receivable} tone="green" className="text-xl sm:text-2xl" />}
          sub={<Share part={data.receivable} other={data.payable} />}
          href="/admin/accounting/parties?balance=debtor"
        />
        <Kpi
          icon={ArrowUpRight}
          tone="rose"
          label="بدهی به اشخاص"
          value={<Money value={data.payable} tone="red" className="text-xl sm:text-2xl" />}
          sub={<Share part={data.payable} other={data.receivable} />}
          href="/admin/accounting/parties?balance=creditor"
        />
      </div>

      {data.month && <MonthSection m={data.month} canReports={data.can.reports} treasuries={data.treasuries} />}
      {!data.month && <CashMix treasuries={data.treasuries} />}

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

      {data.can.reports && (
        <Card className="acc-kpi flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Badge3d icon={ChartColumn} tone="violet" />
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">گزارش‌های مالی</p>
              <p className="text-xs text-gray-500 mt-1 leading-6">سود و زیان، ترازنامه، سنی بدهی، سود هر کالا، ارزش افزوده و بقیه — با خروجی اکسل و چاپ.</p>
            </div>
          </div>
          <Link href="/admin/accounting/reports" className={btn.primary}>
            <ChartColumn className="h-4 w-4" aria-hidden />
            گزارش‌ها
          </Link>
        </Card>
      )}
    </div>
  );
}

type Month = NonNullable<Summary["month"]>;

/** عددهای ماه جاری + نمودار روزانه + کارهای مانده */
function MonthSection({ m, canReports, treasuries }: { m: Month; canReports: boolean; treasuries: Summary["treasuries"] }) {
  const dark = useIsDark();
  const [table, setTable] = useState(false);
  const c = dark ? SERIES.dark : SERIES.light;
  const series: Series[] = [
    { key: "sales", label: "فروش خالص", color: c.sales, data: m.series.sales.map(Number) },
    ...(m.series.gross ? [{ key: "gross", label: "سود ناخالص", color: c.gross, data: m.series.gross.map(Number) }] : []),
    { key: "expenses", label: "هزینه‌ها", color: c.expenses, data: m.series.expenses.map(Number) },
  ];
  const sales = m.series.sales.map(Number);
  const expenses = m.series.expenses.map(Number);
  const gross = m.series.gross?.map(Number) ?? null;
  const tiles = [
    { label: "فروش خالص", v: m.netSales, p: m.prev?.netSales ?? null, href: "/admin/accounting/reports/pl", spark: sales, color: c.sales },
    ...(m.gross !== null && gross ? [{ label: "سود ناخالص", v: m.gross, p: m.prev?.gross ?? null, href: "/admin/accounting/reports/profit", spark: gross, color: c.gross }] : []),
    { label: "هزینه‌ها", v: m.expenses, p: m.prev?.expenses ?? null, href: "/admin/accounting/reports/expenses", bad: true, spark: expenses, color: c.expenses },
    ...(m.net !== null && gross
      ? [{ label: "سود خالص", v: m.net, p: m.prev?.net ?? null, href: "/admin/accounting/reports/pl", spark: gross.map((g, i) => g - expenses[i]), color: c.net }]
      : []),
  ];
  const a = m.alerts;
  const alerts = [
    a.events > 0 && { icon: Zap, text: `${faNum(a.events)} ثبت خودکار گیر کرده`, href: "/admin/accounting/events", tone: "text-red-600" },
    a.overdueCount > 0 && { icon: AlarmClock, text: `${faNum(a.overdueCount)} فاکتور سررسیدگذشته — ${formatAmount(a.overdue)} تومان`, href: "/admin/accounting/reports/aging", tone: "text-red-600" },
    (a.installments ?? 0) > 0 && { icon: AlarmClock, text: `${faNum(a.installments ?? 0)} قسط سررسیدگذشته — ${formatAmount(a.installmentsDue ?? "0")} تومان`, href: "/admin/accounting/installments?view=overdue", tone: "text-red-600" },
    a.negative > 0 && { icon: TrendingDown, text: `${faNum(a.negative)} کالا با موجودی منفی`, href: "/admin/accounting/inventory?filter=negative", tone: "text-amber-600" },
    a.lowStock > 0 && { icon: Package, text: `${faNum(a.lowStock)} کالا زیر نقطه‌ی سفارش`, href: "/admin/accounting/inventory?filter=low", tone: "text-amber-600" },
  ].filter(Boolean) as { icon: LucideIcon; text: string; href: string; tone: string }[];

  return (
    <>
      <section>
        <SectionTitle title={`این ماه — از ${formatJalali(new Date(m.from))}`} help="accounting" />
        {/* موبایل: کارت‌های افقی قابل اسکرول (بخش ۱۳.۳) */}
        <div className="flex sm:grid sm:grid-cols-4 gap-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pt-1 pb-4 snap-x">
          {tiles.map((t) => {
            const inner = (
              <Card className="h-full min-w-[11.5rem] snap-start p-4 transition duration-200 hover:-translate-y-0.5">
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t.label}</p>
                <p className="text-lg mt-1">
                  <Amt v={t.v} strong />
                </p>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Change cur={t.v} prev={t.p} goodWhenUp={!t.bad} />
                  {t.p !== null && <span>نسبت به همین روزهای ماه قبل</span>}
                </div>
                <Sparkline id={t.label} data={t.spark} color={t.color} />
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

      <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-4 space-y-3 lg:col-span-2">
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
          <div className="acc-well rounded-2xl p-2">
            <MultiLineChart id="acc-month" days={m.series.days} series={series} height={240} />
          </div>
        )}
      </Card>
      <CashMix treasuries={treasuries} />
      </div>

      {alerts.length > 0 && (
        <Card className="p-4">
          <SectionTitle title="کارهای مانده" />
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {alerts.map((x) => (
              <Link key={x.href} href={x.href} className="group flex items-center gap-3 py-2.5 text-sm">
                <span className={`acc-badge3d flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-current/10 ${x.tone}`}>
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
    <span className={`acc-badge3d flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${k.cls}`}>
      <k.icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

// ── اجزای داشبورد ──────────────────────────────────────────────────────────

type BadgeTone = "blue" | "emerald" | "rose" | "violet";

/** نشان آیکن برجسته — شیب رنگی با برق بالا، مثل دکمه‌ی فیزیکی */
const BADGE_TONE: Record<BadgeTone, { cls: string; glow: string }> = {
  blue: { cls: "from-blue-400 to-blue-700 shadow-blue-600/40", glow: "rgb(59 130 246 / 0.18)" },
  emerald: { cls: "from-emerald-400 to-emerald-700 shadow-emerald-600/40", glow: "rgb(16 185 129 / 0.16)" },
  rose: { cls: "from-rose-400 to-rose-700 shadow-rose-600/40", glow: "rgb(244 63 94 / 0.14)" },
  violet: { cls: "from-violet-400 to-violet-700 shadow-violet-600/40", glow: "rgb(139 92 246 / 0.16)" },
};

function Badge3d({ icon: I, tone }: { icon: LucideIcon; tone: BadgeTone }) {
  return (
    <span
      className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 ${BADGE_TONE[tone].cls}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
      <I className="relative h-6 w-6" strokeWidth={2.1} aria-hidden />
    </span>
  );
}

/** کارت شاخص بالای داشبورد — نشان برجسته + عدد + زیرنویس، با هاله‌ی رنگ همان شاخص */
function Kpi({ icon, tone, label, value, sub, href }: { icon: LucideIcon; tone: BadgeTone; label: string; value: ReactNode; sub?: ReactNode; href: string }) {
  return (
    <Link
      href={href}
      style={{ "--acc-kpi": BADGE_TONE[tone].glow } as React.CSSProperties}
      className="acc-card acc-kpi group block rounded-3xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--adm-shadow-lg)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 tracking-tight">{value}</p>
        </div>
        <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105">
          <Badge3d icon={icon} tone={tone} />
        </span>
      </div>
      {sub && <div className="mt-3 text-[11px] text-gray-400">{sub}</div>}
    </Link>
  );
}

/** سهم طلب از مجموع طلب و بدهی (یا برعکس) — نوار فرورفته */
function Share({ part, other }: { part: string; other: string }) {
  const a = Number(part);
  const b = Number(other);
  const total = Math.abs(a) + Math.abs(b);
  const pct = total ? Math.round((Math.abs(a) / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="acc-well h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
        <span className="block h-full rounded-full bg-gradient-to-l from-blue-400 to-blue-600" style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">{faNum(pct)}٪ از کل طلب و بدهی</span>
    </div>
  );
}

/**
 * روند تجمعی ماه در کارت — یک سری، بی‌محور؛ عنوان کارت نامش است و عدد کارت
 * مقدارش. فقط برای شکل روند است؛ ریز روزانه در نمودار «روز به روز».
 */
function Sparkline({ id, data, color }: { id: string; data: number[]; color: string }) {
  if (data.length < 2) return null;
  const cum: number[] = [];
  for (const v of data) cum.push((cum[cum.length - 1] ?? 0) + v);
  const W = 160;
  const H = 36;
  const min = Math.min(...cum, 0);
  const max = Math.max(...cum, 1);
  const X = (i: number) => (i * W) / (cum.length - 1);
  const Y = (v: number) => H - 2 - ((v - min) / (max - min || 1)) * (H - 4);
  const line = cum.map((v, i) => `${i ? "L" : "M"} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const gid = `spark-${id.replace(/\s/g, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-9 w-full" preserveAspectRatio="none" aria-hidden style={{ direction: "ltr" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const KIND_LABEL: Record<string, string> = { CASH: "صندوق", BANK: "بانک", POS: "کارتخوان", GATEWAY: "درگاه" };
/** رنگ نوع حساب — خانه‌های ۱ تا ۴ پالت دسته‌ای اعتبارسنجی‌شده (dataviz)، به ترتیب ثابت */
const KIND_COLOR: Record<string, { light: string; dark: string }> = {
  BANK: { light: "#2a78d6", dark: "#3987e5" },
  CASH: { light: "#eb6834", dark: "#d95926" },
  POS: { light: "#1baf7a", dark: "#199e70" },
  GATEWAY: { light: "#eda100", dark: "#c98500" },
};

/** ترکیب پول نقد به تفکیک نوع حساب — فقط مانده‌های مثبت */
function CashMix({ treasuries }: { treasuries: Summary["treasuries"] }) {
  const dark = useIsDark();
  const sums = new Map<string, number>();
  for (const t of treasuries) {
    const v = Number(t.balance);
    if (v > 0) sums.set(t.kind, (sums.get(t.kind) ?? 0) + v);
  }
  const items = ["BANK", "CASH", "POS", "GATEWAY"]
    .filter((k) => sums.has(k))
    .map((k) => ({ label: KIND_LABEL[k], value: sums.get(k) ?? 0, color: KIND_COLOR[k][dark ? "dark" : "light"] }));
  return (
    <Card className="p-4">
      <SectionTitle title="پول نقد به تفکیک" help="accountingTreasury" />
      {items.length ? (
        <DonutChart items={items} size={156} />
      ) : (
        <p className="py-10 text-center text-xs text-gray-400">هنوز موجودی مثبتی در صندوق و بانک نیست.</p>
      )}
    </Card>
  );
}
