"use client";

/**
 * کارتابل ← آمار بازدید — دو تب:
 *   - «بازدید» از Umami (رفتار)
 *   - «منبع فروش» از `Order` (پول)
 * و دیالوگ تنظیمات برای `MARKETING_SETTINGS_MANAGE`.
 *
 * دو تب عمداً جمع نمی‌شوند: تعریف «بازدیدکننده» و «خریدار» یکی نیست.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۶
 * الگو: `bartar-crm/features/marketing/components/site-analytics-view.tsx`
 */

import { useState } from "react";
import { Activity, RefreshCw, Settings } from "lucide-react";
import { MultiLineChart, dayLabel } from "@/components/admin/reports/charts";
import {
  ANALYTICS_RANGES,
  CHANNEL_LABELS,
  COUNTRY_LABELS,
  DEFAULT_RANGE,
  DEVICE_LABELS,
  EVENT_LABELS,
  FUNNEL_EVENTS,
  type AnalyticsRangeKey,
} from "@/lib/analytics/events";
import type { MetricRow, SalesReport, SalesRow, TrafficReport } from "@/lib/analytics/site-analytics";
import { Dialog, Hint, Label, Skeleton, Switch, ToastProvider, btn, card, cn, fa, inputCls, send, useFetch, useToast } from "./ui";

type Traffic = TrafficReport & { canManage: boolean };
type Tab = "traffic" | "sales";

export default function AnalyticsClient() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

function Inner() {
  const [range, setRange] = useState<AnalyticsRangeKey>(DEFAULT_RANGE);
  const [tab, setTab] = useState<Tab>("traffic");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const traffic = useFetch<Traffic>(`/api/admin/worklist/analytics/traffic?range=${range}`);
  const sales = useFetch<SalesReport>(tab === "sales" ? `/api/admin/worklist/analytics/sales?range=${range}` : null);

  const canManage = traffic.data?.canManage ?? false;
  const online = traffic.data?.connected ? traffic.data.activeVisitors : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                range === r.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {online > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
              <Activity className="h-3.5 w-3.5" />
              {fa(online)} نفر همین الان
            </span>
          )}
          <button
            className={cn(btn.small, "border border-gray-200 dark:border-white/10")}
            onClick={() => {
              traffic.reload();
              sales.reload();
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", traffic.loading && "animate-spin")} />
            تازه‌سازی
          </button>
          {canManage && (
            <button
              className={cn(btn.small, "border border-gray-200 dark:border-white/10")}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" />
              تنظیمات
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-white/10">
        {(
          [
            ["traffic", "بازدید"],
            ["sales", "منبع فروش"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "relative px-3 py-2 text-[13px] font-extrabold transition",
              tab === key
                ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-blue-500"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "traffic" && (
        <TrafficView
          data={traffic.data}
          error={traffic.error}
          loading={traffic.loading && !traffic.data}
          canManage={canManage}
          onSetup={() => setSettingsOpen(true)}
        />
      )}
      {tab === "sales" && <SalesView data={sales.data} error={sales.error} />}

      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            traffic.reload();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// اجزای کوچک
// ─────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function Stat({
  label,
  value,
  hint,
  change,
  invert,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number | null;
  /** رشدِ این عدد بد است (نرخ پرش) */
  invert?: boolean;
}) {
  const good = change != null && (invert ? change < 0 : change > 0);
  const bad = change != null && (invert ? change > 0 : change < 0);
  return (
    <div className={cn(card, "p-3")}>
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-black text-gray-900 dark:text-white tabular-nums">{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px]">
        {change != null && (
          <span
            className={cn(
              "font-bold tabular-nums",
              good && "text-emerald-600 dark:text-emerald-400",
              bad && "text-red-600 dark:text-red-400",
              !good && !bad && "text-gray-400",
            )}
            dir="ltr"
          >
            {change > 0 ? "+" : ""}
            {fa(change)}٪
          </span>
        )}
        {hint && <span className="text-gray-400">{hint}</span>}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={cn(card, "p-4")}>
      <div className="mb-3">
        <h3 className="text-[13px] font-black text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function BarList({
  rows,
  label,
  showPercent,
  dirLtr,
}: {
  rows: MetricRow[];
  label?: (name: string) => string;
  showPercent?: boolean;
  /** آدرس و دامنه چپ‌به‌راست خوانا ترند */
  dirLtr?: boolean;
}) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-gray-400">داده‌ای در این بازه نیست</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={`${r.name}-${i}`} className="relative overflow-hidden rounded-lg">
          <div className="absolute inset-y-0 right-0 rounded-lg bg-blue-500/10" style={{ width: `${(r.value / max) * 100}%` }} />
          <div className="relative flex items-center justify-between gap-2 px-2 py-1.5 text-[11.5px]">
            <span className="truncate font-bold text-gray-700 dark:text-gray-200" dir={dirLtr ? "ltr" : undefined} title={r.name}>
              {label ? label(r.name) : r.name}
            </span>
            <span className="shrink-0 tabular-nums text-gray-500">
              {fa(r.value)}
              {showPercent && total > 0 && (
                <span className="text-gray-400"> · {fa(Math.round((r.value / total) * 100))}٪</span>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function faDuration(seconds: number) {
  if (seconds < 60) return `${fa(seconds)} ثانیه`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${fa(m)} دقیقه و ${fa(s)} ثانیه` : `${fa(m)} دقیقه`;
}

/** Umami «YYYY-MM-DD HH:mm:ss» می‌دهد؛ به new Date نمی‌دهیم چون بدون منطقه‌ی زمانی UTC خوانده می‌شود */
function seriesLabel(unit: "hour" | "day") {
  return (key: string) => (unit === "hour" ? key.slice(11, 16) || key : dayLabel(key.slice(0, 10)));
}

// ─────────────────────────────────────────────────────────────────
// تب بازدید
// ─────────────────────────────────────────────────────────────────

function TrafficView({
  data,
  error,
  loading,
  canManage,
  onSetup,
}: {
  data: Traffic | null;
  error: string | null;
  loading: boolean;
  canManage: boolean;
  onSetup: () => void;
}) {
  if (loading) return <Skeleton className="h-72" />;
  if (error)
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-xs font-bold text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  if (!data) return null;

  if (!data.connected) {
    return (
      <div className={cn(card, "p-6 text-center")}>
        <p className="text-sm font-black text-gray-900 dark:text-white">آمار بازدید هنوز وصل نیست</p>
        <p className="mt-1.5 text-xs leading-6 text-gray-500">
          این فروشگاه در Umami سرور خودش ثبت نشده یا کد اشتراکش وارد نشده است.
          {canManage ? "" : " از مدیر سئو بخواهید تنظیمش کند."}
        </p>
        {canManage && (
          <button className={cn(btn.primary, "mt-4")} onClick={onSetup}>
            تنظیم آمار بازدید
          </button>
        )}
      </div>
    );
  }

  const t = data.totals;
  const p = data.previous;
  const eventMap = new Map(data.events.map((e) => [e.name, e.value]));
  const contactEvents = data.events.filter((e) => !(FUNNEL_EVENTS as readonly string[]).includes(e.name));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="بازدید صفحه" value={fa(t.pageviews)} change={pctChange(t.pageviews, p.pageviews)} />
        <Stat label="بازدیدکننده" value={fa(t.visitors)} hint="افراد یکتا" change={pctChange(t.visitors, p.visitors)} />
        <Stat label="نشست" value={fa(t.visits)} change={pctChange(t.visits, p.visits)} />
        <Stat
          label="نرخ پرش"
          value={t.visits ? `${fa(Math.round((t.bounces / t.visits) * 100))}٪` : "—"}
          hint="یک صفحه دید و رفت"
          invert
          change={pctChange(t.bounces, p.bounces)}
        />
        <Stat
          label="میانگین زمان"
          value={t.visits ? faDuration(Math.round(t.totaltime / t.visits)) : "—"}
          hint="در هر نشست"
        />
      </div>

      <Panel title="روند بازدید" subtitle={data.unit === "hour" ? "به تفکیک ساعت — وقت تهران" : "به تفکیک روز"}>
        <MultiLineChart
          id="traffic-trend"
          days={data.series.map((s) => s.key)}
          label={seriesLabel(data.unit)}
          series={[
            { key: "pv", label: "بازدید صفحه", color: "#3b82f6", data: data.series.map((s) => s.pageviews) },
            { key: "ss", label: "نشست", color: "#10b981", data: data.series.map((s) => s.sessions) },
          ]}
        />
      </Panel>

      {/* رویدادها اول: بازدید خبر است، این‌ها نتیجه‌اند */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="قیف خرید" subtitle="نسبت به بازدیدکننده‌ی یکتا">
          <div className="space-y-2">
            {(FUNNEL_EVENTS as readonly string[]).map((name) => {
              const value = eventMap.get(name) ?? 0;
              const rate = t.visitors ? (value / t.visitors) * 100 : 0;
              return (
                <div key={name}>
                  <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
                    <span className="font-bold text-gray-700 dark:text-gray-200">{EVENT_LABELS[name]}</span>
                    <span className="tabular-nums text-gray-500">
                      {fa(value)} · {rate < 10 ? (Math.round(rate * 10) / 10).toLocaleString("fa-IR") : fa(Math.round(rate))}٪
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(rate, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <Hint>
            «ثبت سفارش» یعنی سفارش ساخته شد نه پرداخت شد؛ پرداخت را تب «منبع فروش» از خود سفارش‌ها می‌گوید.
          </Hint>
        </Panel>
        <Panel title="تماس و گفتگو" subtitle="کاری که بازدیدکننده بیرون از قیف انجام داد">
          <BarList rows={contactEvents} label={(n) => EVENT_LABELS[n] ?? n} />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="پربازدیدترین صفحه‌ها" subtitle="آدرس صفحه">
          <BarList rows={data.pages} dirLtr />
        </Panel>
        <Panel title="عنوان صفحه‌ها">
          <BarList rows={data.titles} />
        </Panel>
        <Panel title="صفحه‌ی ورود" subtitle="اولین صفحه‌ای که دیده شد">
          <BarList rows={data.entryPages} dirLtr />
        </Panel>
        <Panel title="صفحه‌ی خروج" subtitle="آخرین صفحه پیش از رفتن">
          <BarList rows={data.exitPages} dirLtr />
        </Panel>
        <Panel title="کانال ورود" subtitle="از کجا آمدند">
          <BarList rows={data.channels} label={(n) => CHANNEL_LABELS[n] ?? n} showPercent />
        </Panel>
        <Panel title="ارجاع‌دهنده" subtitle="دامنه‌ی فرستنده">
          <BarList rows={data.referrers} dirLtr />
        </Panel>
        <Panel title="نوع دستگاه">
          <BarList rows={data.devices} label={(n) => DEVICE_LABELS[n] ?? n} showPercent />
        </Panel>
        <Panel title="مرورگر">
          <BarList rows={data.browsers} showPercent />
        </Panel>
        <Panel title="سیستم‌عامل">
          <BarList rows={data.operatingSystems} showPercent />
        </Panel>
        <Panel title="کشور">
          <BarList rows={data.countries} label={(n) => COUNTRY_LABELS[n] ?? n} showPercent />
        </Panel>
        <Panel title="شهر">
          <BarList rows={data.cities} />
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// تب منبع فروش
// ─────────────────────────────────────────────────────────────────

function SalesTable({ rows, label, dirLtr }: { rows: SalesRow[]; label?: (k: string) => string; dirLtr?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-gray-400">سفارشی با منبع در این بازه نیست</p>;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-gray-400">
            <th className="py-1.5 text-start font-bold">منبع</th>
            <th className="py-1.5 text-center font-bold">سفارش</th>
            <th className="py-1.5 text-center font-bold">پرداخت‌شده</th>
            <th className="py-1.5 text-end font-bold">مبلغ (تومان)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-gray-100 dark:border-white/5">
              <td className="relative py-1.5 pe-2 max-w-[220px]">
                <div className="absolute inset-y-1 right-0 rounded bg-emerald-500/10" style={{ width: `${(r.revenue / max) * 100}%` }} />
                <span className="relative block truncate font-bold text-gray-700 dark:text-gray-200" dir={dirLtr ? "ltr" : undefined} title={r.key}>
                  {label ? label(r.key) : r.key}
                </span>
              </td>
              <td className="py-1.5 text-center tabular-nums">{fa(r.orders)}</td>
              <td className="py-1.5 text-center tabular-nums">{fa(r.paidOrders)}</td>
              <td className="py-1.5 text-end tabular-nums font-bold">{fa(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalesView({ data, error }: { data: SalesReport | null; error: string | null }) {
  if (error) return <p className="text-sm font-bold text-red-600">{error}</p>;
  if (!data) return <Skeleton className="h-72" />;
  const t = data.totals;
  const unknownShare = t.orders ? Math.round((t.unknownOrders / t.orders) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="سفارش آنلاین" value={fa(t.orders)} hint="بدون لغو و برگشتی" />
        <Stat label="پرداخت‌شده" value={fa(t.paidOrders)} />
        <Stat label="مبلغ پرداخت‌شده" value={fa(t.revenue)} hint="تومان" />
        <Stat label="منبع نامعلوم" value={`${fa(unknownShare)}٪`} hint={`${fa(t.unknownOrders)} سفارش`} />
      </div>

      <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-[11.5px] leading-6 text-amber-700 dark:text-amber-300">
        {data.dataSince
          ? `ثبت منبع ورود از ${new Date(data.dataSince).toLocaleDateString("fa-IR")} شروع شده است. `
          : "هنوز هیچ سفارشی با منبع ورود ثبت نشده است. "}
        «نامعلوم» یعنی سفارشِ پیش از آن تاریخ، یا خریداری که کوکی‌اش پاک شده — نه «ورود مستقیم». سفارش تلفنی و بازارگاه اینجا نیستند.
      </div>

      <Panel title="فروش به تفکیک کانال" subtitle="آخرین ورودِ غیرمستقیم خریدار در ۳۰ روز پیش از سفارش">
        <SalesTable rows={data.channels} label={(k) => CHANNEL_LABELS[k] ?? k} />
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="صفحه‌ی ورودِ پرفروش" subtitle="اولین صفحه‌ای که خریدار از آن وارد شد">
          <SalesTable rows={data.landingPages} dirLtr />
        </Panel>
        <Panel title="ارجاع‌دهنده" subtitle="دامنه‌ی سایت فرستنده">
          <SalesTable rows={data.referrers} dirLtr />
        </Panel>
        <Panel title="کمپین‌ها" subtitle="utm_campaign در لینک">
          <SalesTable rows={data.campaigns} dirLtr />
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// تنظیمات
// ─────────────────────────────────────────────────────────────────

type SettingsDto = {
  trackingEnabled: boolean;
  umamiWebsiteId: string;
  umamiShareSlug: string;
  updatedAt: string | null;
  updatedByName: string | null;
  umamiBaseUrl: string;
};

function SettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data, error } = useFetch<SettingsDto>("/api/admin/worklist/analytics/settings");
  const [form, setForm] = useState<Pick<SettingsDto, "trackingEnabled" | "umamiWebsiteId" | "umamiShareSlug"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<string | null>(null);

  const f = form ?? (data ? { trackingEnabled: data.trackingEnabled, umamiWebsiteId: data.umamiWebsiteId, umamiShareSlug: data.umamiShareSlug } : null);
  const set = (patch: Partial<NonNullable<typeof f>>) => f && setForm({ ...f, ...patch });

  async function runTest() {
    if (!f) return;
    setBusy(true);
    setTest(null);
    try {
      const r = await send<{ websiteMatches: boolean; pageviews24h: number; shareWebsiteId: string }>(
        "/api/admin/worklist/analytics/settings/test",
        "POST",
        f,
      );
      setTest(
        r.websiteMatches
          ? `✓ وصل شد — ${fa(r.pageviews24h)} بازدید در ۲۴ ساعت گذشته`
          : `⚠️ کد اشتراک مال سایت دیگری است (${r.shareWebsiteId}) — شناسه‌ی سایت را با همین یکی کنید`,
      );
    } catch (e) {
      setTest(`✗ ${e instanceof Error ? e.message : "وصل نشد"}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!f) return;
    setBusy(true);
    try {
      await send("/api/admin/worklist/analytics/settings", "PUT", f);
      toast("تنظیمات آمار بازدید ذخیره شد");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ذخیره نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="تنظیمات آمار بازدید">
      {error && <Hint tone="error">{error}</Hint>}
      {!f ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4">
          <p className="text-[11.5px] leading-6 text-gray-500">
            هر سرور Umami خودش را دارد. در پنل Umami همین سرور یک «Website» برای این فروشگاه بسازید و
            از بخش Share یک کد اشتراک بگیرید. آدرس Umami روی این سرور:{" "}
            <span dir="ltr" className="font-mono">{data?.umamiBaseUrl}</span>
          </p>
          <div>
            <Label htmlFor="uw">شناسه‌ی سایت (Website ID)</Label>
            <input
              id="uw"
              dir="ltr"
              className={cn(inputCls, "font-mono")}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={f.umamiWebsiteId}
              onChange={(e) => set({ umamiWebsiteId: e.target.value })}
            />
            <Hint>برای ردیاب صفحه‌های فروشگاه — عمومی است و در صفحه دیده می‌شود.</Hint>
          </div>
          <div>
            <Label htmlFor="us">کد اشتراک (Share)</Label>
            <input
              id="us"
              dir="ltr"
              className={cn(inputCls, "font-mono")}
              value={f.umamiShareSlug}
              onChange={(e) => set({ umamiShareSlug: e.target.value })}
            />
            <Hint>برای خواندن آمار در همین پنل — فقط‌خواندنی است. رمز ادمین Umami هرگز اینجا وارد نمی‌شود.</Hint>
          </div>
          <Switch
            checked={f.trackingEnabled}
            onChange={(v) => set({ trackingEnabled: v })}
            label="ردیاب روی صفحه‌های فروشگاه روشن باشد"
          />
          {test && (
            <p className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2 text-[11.5px] font-bold text-gray-700 dark:text-gray-200">
              {test}
            </p>
          )}
          {data?.updatedByName && (
            <p className="text-[10.5px] text-gray-400">آخرین تغییر: {data.updatedByName}</p>
          )}
          <div className="flex gap-2">
            <button className={cn(btn.primary, "flex-1")} disabled={busy} onClick={save}>
              ذخیره
            </button>
            <button className={btn.outline} disabled={busy || !f.umamiShareSlug} onClick={runTest}>
              آزمایش اتصال
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
