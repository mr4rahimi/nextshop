"use client";

/**
 * گزارش عملکرد تیم — فاز ۶، بخش ۱۴ مستندات.
 *
 * سه قاعده که این صفحه رویشان ساخته شده:
 *
 * **۱. کار دستی و کار خودکار جمع نمی‌شوند.** دو ستون جدا در جدول و دو
 * کارت جدا بالای صفحه. جمع‌زدنشان یعنی ثبت محصول دو بار شمرده شود.
 *
 * **۲. عدد خام همیشه کنار نسبت.** نرخ ثبت نتیجه بدون «از چند کار» بی‌معنی
 * است و همان چیزی است که بحث «چرا عدد من این است» را تمام می‌کند.
 *
 * **۳. کلیک روی هر کارمند، همان گزارش را برای خودش باز می‌کند** — نه یک
 * صفحه‌ی تازه. جدول کارکنان ولی کل تیم می‌ماند تا او کنار بقیه دیده شود.
 * کلیک روی هر عدد جدول، کارهای پشت همان عدد را در پنجره نشان می‌دهد.
 */

import { useEffect, useMemo, useState } from "react";
import { DonutChart, HBarChart, fa, faShort, dayLabel } from "@/components/admin/reports/charts";
import { Sheet } from "@/components/admin/accounting/ui";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { formatDateTime, PRIORITY_LABELS, STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS } from "@/lib/worklist/types";
import type { StaffPriority, StaffTaskStatus, StaffChannel } from "@prisma/client";
import {
  Sparkline, RingGauge, ComboChart, ColumnChart, Heatmap, RadarChart, ScatterChart, StackedRows, ShareBar,
} from "./team-charts";

type Preset = "7d" | "30d" | "90d" | "month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "۷ روز" },
  { key: "30d", label: "۳۰ روز" },
  { key: "90d", label: "۹۰ روز" },
  { key: "month", label: "این ماه" },
  { key: "custom", label: "بازه‌ی دلخواه" },
];

type Drill =
  | "done" | "created" | "late" | "noOutcome" | "overdue" | "calls" | "success"
  | "documented" | "deals" | "attendance" | "system";

/** ریزکننده‌های پنجره — همان پارامترهای `DrillFilter` در lib/worklist/team-report.ts */
type DrillExtra = Partial<Record<"typeId" | "outcome" | "domain" | "channel" | "priority" | "source" | "day" | "wd" | "hour" | "bucket" | "systemKey", string>>;

interface DrillState { metric: Drill; title: string; ownerId: string | null; extra?: DrillExtra }

interface StaffRow {
  userId: string;
  name: string;
  done: number;
  created: number;
  withOutcome: number;
  documented: number;
  overdue: number;
  system: number;
  onTime: number;
  withDue: number;
  success: number;
  rated: number;
  closeMin: number | null;
  calls: number;
  referralsOut: number;
  referralsIn: number;
  notes: number;
  activeMin: number;
  presentDays: number;
  deals: number;
  revenue: number;
  profit: number;
  spark: number[];
  byDomain: Record<string, number>;
}

type Item = { key?: string; label: string; value: number; color: string };

interface Summary {
  days: string[];
  kpi: {
    done: number;
    created: number;
    outcomeRate: number;
    overdue: number;
    overdueUrgent: number;
    documented: number;
    system: number;
    openNow: number;
    onTime: number;
    withDue: number;
    onTimeRate: number | null;
    success: number;
    rated: number;
    successRate: number | null;
    closeMin: number | null;
    calls: number;
    referrals: number;
    activeMin: number;
    presentDays: number;
    perHour: number | null;
    deals: number;
    revenue: number;
    profit: number;
    activeStaff: number;
  };
  prev: { done: number; created: number; onTimeRate: number | null; revenue: number };
  series: { done: number[]; created: number[]; late: number[]; hours: number[] };
  byDomain: (Item & { key: string })[];
  domains: { key: string; label: string; color: string }[];
  byType: Item[];
  byChannel: Item[];
  byPriority: Item[];
  bySource: Item[];
  byOutcome: Item[];
  closeTime: { key: string; label: string; value: number }[];
  heatmap: number[][];
  system: { key: string; label: string; value: number }[];
  staff: StaffRow[];
  canExport: boolean;
}

/** «۲ ساعت»، «۳٫۵ روز» — زمان بستن کوتاه و خوانا */
function duration(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${fa(min)} دقیقه`;
  if (min < 1440) return `${(Math.round(min / 6) / 10).toLocaleString("fa-IR")} ساعت`;
  return `${(Math.round(min / 144) / 10).toLocaleString("fa-IR")} روز`;
}
const hours = (min: number) => `${(Math.round(min / 6) / 10).toLocaleString("fa-IR")} ساعت`;
const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("‌");

const AVATAR = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#84cc16"];
const avatarColor = (id: string) => AVATAR[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];

type SortKey = "done" | "onTime" | "success" | "closeMin" | "calls" | "activeMin" | "perHour" | "revenue" | "overdue" | "documented";

export default function TeamReportClient() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("done");
  const [drill, setDrill] = useState<DrillState | null>(null);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (preset === "custom" && from) {
      qs.set("from", from);
      if (to) qs.set("to", to);
    } else {
      qs.set("preset", preset === "custom" ? "30d" : preset);
    }
    return qs;
  }, [preset, from, to]);

  // «در حال بارگذاری» از روی کلید درخواست حساب می‌شود، نه setState داخل effect
  const key = `${query}|${ownerId ?? ""}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== key;

  useEffect(() => {
    let stale = false;
    const qs = new URLSearchParams(query);
    if (ownerId) qs.set("ownerId", ownerId);
    fetch(`/api/admin/worklist/summary?${qs}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        if (!stale) { setData(d); setError(null); }
      })
      .catch((e) => !stale && setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => !stale && setLoadedKey(key));
    return () => { stale = true; };
  }, [query, ownerId, key]);

  const focused = useMemo(() => data?.staff.find((s) => s.userId === ownerId) ?? null, [data, ownerId]);
  const pick = (id: string) => setOwnerId((cur) => (cur === id ? null : id));

  const perHour = (s: StaffRow) => (s.activeMin > 0 ? s.done / (s.activeMin / 60) : null);

  const sorted = useMemo(() => {
    if (!data) return [];
    const val = (s: StaffRow): number => {
      switch (sort) {
        case "onTime": return rate(s.onTime, s.withDue) ?? -1;
        case "success": return rate(s.success, s.rated) ?? -1;
        case "closeMin": return s.closeMin === null ? -Infinity : -s.closeMin;
        case "perHour": return perHour(s) ?? -1;
        default: return s[sort] as number;
      }
    };
    return [...data.staff].sort((a, b) => val(b) - val(a));
  }, [data, sort]);

  // ── رادار: هر محور نسبت به بهترینِ تیم ───────────────────────────────
  const radar = useMemo(() => {
    if (!data || data.staff.length === 0) return null;
    const axes: { label: string; get: (s: StaffRow) => number | null; inverse?: boolean }[] = [
      { label: "حجم کار", get: (s) => s.done },
      { label: "به‌موقع", get: (s) => rate(s.onTime, s.withDue) },
      { label: "موفقیت", get: (s) => rate(s.success, s.rated) },
      { label: "ثبت نتیجه", get: (s) => rate(s.withOutcome, s.created) },
      { label: "مستندسازی", get: (s) => s.documented },
      { label: "سرعت بستن", get: (s) => s.closeMin, inverse: true },
      { label: "بهره‌وری", get: (s) => perHour(s) },
    ];
    const staff = data.staff.filter((s) => s.done > 0);
    if (!staff.length) return null;
    const norm = (ax: (typeof axes)[number], s: StaffRow) => {
      const vals = staff.map(ax.get).filter((v): v is number => v !== null);
      const v = ax.get(s);
      if (v === null || !vals.length) return 0;
      if (ax.inverse) {
        const best = Math.min(...vals);
        return v <= 0 ? 100 : Math.round((Math.max(best, 1) / Math.max(v, 1)) * 100);
      }
      const best = Math.max(...vals);
      return best > 0 ? Math.round((v / best) * 100) : 0;
    };
    const avg = axes.map((ax) => Math.round(staff.reduce((t, s) => t + norm(ax, s), 0) / staff.length));
    const subjects = focused ? [focused] : [...staff].sort((a, b) => b.done - a.done).slice(0, 3);
    const palette = ["#6366f1", "#10b981", "#f59e0b"];
    return {
      axes: axes.map((a) => a.label),
      series: [
        ...subjects.map((s, i) => ({ key: s.userId, label: s.name, color: palette[i], values: axes.map((ax) => norm(ax, s)) })),
        { key: "avg", label: "میانگین تیم", color: "#94a3b8", values: avg, dashed: true },
      ],
    };
  }, [data, focused]);

  // ── قهرمان‌های بازه ──────────────────────────────────────────────────
  const champions = useMemo(() => {
    if (!data) return [];
    const st = data.staff;
    const best = (label: string, icon: string, score: (s: StaffRow) => number | null, show: (s: StaffRow) => string, min = 0) => {
      const c = st.filter((s) => s.done >= min).map((s) => ({ s, v: score(s) })).filter((x) => x.v !== null && x.v > 0);
      c.sort((a, b) => (b.v as number) - (a.v as number));
      return c[0] ? { label, icon, name: c[0].s.name, id: c[0].s.userId, value: show(c[0].s) } : null;
    };
    // نرخ‌ها با حداقل حجم — یک کارِ به‌موقع نباید «دقیق‌ترین» بسازد
    const minVol = Math.max(3, Math.round((data.kpi.done / Math.max(1, data.kpi.activeStaff)) * 0.3));
    return [
      best("پرکارترین", "🏆", (s) => s.done, (s) => `${fa(s.done)} کار`),
      best("دقیق‌ترین در مهلت", "⏱️", (s) => (s.withDue >= 3 ? rate(s.onTime, s.withDue) : null), (s) => `${fa(rate(s.onTime, s.withDue) ?? 0)}٪ به‌موقع`, minVol),
      best("بیشترین نتیجه‌ی موفق", "🎯", (s) => (s.rated >= 3 ? rate(s.success, s.rated) : null), (s) => `${fa(rate(s.success, s.rated) ?? 0)}٪ موفق`, minVol),
      best("سریع‌ترین", "⚡", (s) => (s.closeMin !== null && s.done >= minVol ? 1e7 / (s.closeMin + 1) : null), (s) => `میانه ${duration(s.closeMin)}`),
      best("بیشترین فروش", "💰", (s) => s.revenue, (s) => `${faShort(s.revenue)} تومان`),
      best("پرتماس‌ترین", "📞", (s) => s.calls, (s) => `${fa(s.calls)} تماس`),
    ].filter(Boolean) as { label: string; icon: string; name: string; id: string; value: string }[];
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const head = [
      "کارمند", "بسته‌شده", "ثبت‌شده", "نتیجه‌دار", "نرخ نتیجه", "به‌موقع", "مهلت‌دار", "نرخ به‌موقع",
      "موفق", "نرخ موفقیت", "میانه زمان بستن (دقیقه)", "تماس", "مستندسازی", "یادداشت", "ارجاع داده", "ارجاع گرفته",
      "عقب‌افتاده", "کار سیستمی", "روز حضور", "ساعت حضور", "کار در ساعت", "معامله", "فروش", "سود",
    ];
    const pc = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
    const lines = data.staff.map((s) => [
      `"${s.name}"`, s.done, s.created, s.withOutcome, pc(s.withOutcome, s.created), s.onTime, s.withDue, pc(s.onTime, s.withDue),
      s.success, pc(s.success, s.rated), s.closeMin === null ? "—" : Math.round(s.closeMin), s.calls, s.documented, s.notes,
      s.referralsOut, s.referralsIn, s.overdue, s.system, s.presentDays, (s.activeMin / 60).toFixed(1),
      perHour(s)?.toFixed(2) ?? "—", s.deals, s.revenue, s.profit,
    ].join(","));
    // BOM لازم است وگرنه اکسل فارسی را خراب باز می‌کند
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `worklist-report-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const who = focused ? ` — ${focused.name}` : "";
  const open = (metric: Drill, title: string, owner: string | null = ownerId, extra?: DrillExtra) =>
    setDrill({ metric, title: owner === ownerId ? title + who : title, ownerId: owner, extra });
  /** کلیک روی ردیف یک نمودار تفکیکی — ردیف بی‌کلید («سایر») کاری نمی‌کند */
  const openItem = (items: Item[], field: keyof DrillExtra, metric: Drill = "done", prefix = "") => (i: number) => {
    const it = items[i];
    if (it?.key) open(metric, `${prefix}${it.label}`, ownerId, { [field]: it.key });
  };

  const k = data?.kpi;
  const ownerPill = focused ? { name: focused.name, color: avatarColor(focused.userId) } : null;

  return (
    <div className="space-y-5">
      {/* ── نوار بازه و فیلتر ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-gray-50/85 dark:bg-[#0b0f17]/85 backdrop-blur-md rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  preset === p.key
                    ? "bg-gradient-to-l from-indigo-500 to-blue-500 text-white shadow"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <JalaliDatePicker value={from} onChange={setFrom} placeholder="از تاریخ" className="w-36" />
              <JalaliDatePicker value={to} onChange={setTo} placeholder="تا تاریخ" className="w-36" />
            </div>
          )}

          {data && (
            <select
              value={ownerId ?? ""}
              onChange={(e) => setOwnerId(e.target.value || null)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
            >
              <option value="">کل تیم</option>
              {data.staff.map((s) => (
                <option key={s.userId} value={s.userId}>{s.name}</option>
              ))}
            </select>
          )}

          {ownerPill && (
            <button
              onClick={() => setOwnerId(null)}
              className="flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
            >
              <span className="w-6 h-6 rounded-lg grid place-items-center text-[10px] text-white" style={{ background: ownerPill.color }}>
                {initials(ownerPill.name)}
              </span>
              فقط {ownerPill.name} ×
            </button>
          )}

          <div className="flex-1" />
          {loading && data && <span className="text-[11px] text-gray-400 animate-pulse">به‌روزرسانی…</span>}

          {data?.canExport && (
            <button
              onClick={exportCsv}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-indigo-300"
            >
              ⬇ خروجی اکسل
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-4 rounded-2xl bg-red-500/10 text-red-600 text-xs font-bold">{error}</div>}

      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-3xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {data && k && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* ── قهرمان صفحه ────────────────────────────────────────── */}
          <Hero data={data} focused={focused} rankOf={(id) => sorted.findIndex((s) => s.userId === id) + 1} sortLabel={SORT_LABELS[sort]} onOpen={open} />

          {/* ── کارت‌های KPI ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <Kpi icon="✅" label="کار بسته‌شده" value={fa(k.done)} delta={[k.done, data.prev.done]}
              spark={data.series.done} color="#10b981" onClick={() => open("done", "کارهای بسته‌شده")}
              hint={`${fa(k.activeStaff)} نفر فعال`} />
            <Kpi icon="📝" label="کار ثبت‌شده" value={fa(k.created)} delta={[k.created, data.prev.created]}
              spark={data.series.created} color="#6366f1" onClick={() => open("created", "کارهای ثبت‌شده")}
              hint={`${fa(k.openNow)} تای آن هنوز باز`} />
            <KpiRing label="بستن به‌موقع" value={k.onTimeRate} hint={`${fa(k.onTime)} از ${fa(k.withDue)} کارِ مهلت‌دار`}
              delta={k.onTimeRate !== null && data.prev.onTimeRate !== null ? k.onTimeRate - data.prev.onTimeRate : null}
              onClick={() => open("late", "بسته‌شده بعد از مهلت")} action="دیرکردها" />
            <KpiRing label="نتیجه‌ی موفق" value={k.successRate} hint={`${fa(k.success)} از ${fa(k.rated)} کارِ نتیجه‌دار`}
              onClick={() => open("success", "بسته‌شده با نتیجه‌ی موفق")} action="موفق‌ها" />
            <KpiRing label="ثبت نتیجه" value={k.outcomeRate} hint={`از ${fa(k.created)} کارِ ثبت‌شده`}
              onClick={() => open("noOutcome", "ثبت‌شده بدون نتیجه")} action="بی‌نتیجه‌ها" />
            <Kpi icon="⏳" label="میانه‌ی زمان بستن" value={duration(k.closeMin)} hint="از ثبت تا بستن" color="#06b6d4"
              onClick={() => open("done", "کارهای بسته‌شده با زمان بستن")} />
            <Kpi icon="🚨" label="عقب‌افتاده" value={fa(k.overdue)} tone={k.overdue ? "bad" : "good"}
              hint={k.overdueUrgent ? `${fa(k.overdueUrgent)} تا فوری یا مهم` : "همین حالا، نه در بازه"}
              onClick={() => open("overdue", "عقب‌افتاده‌ی همین حالا")} />
            <Kpi icon="📞" label="تماس انجام‌شده" value={fa(k.calls)} hint="ورودی و خروجی، بسته‌شده"
              color="#f59e0b" onClick={() => open("calls", "تماس‌های انجام‌شده")} />
            <Kpi icon="🕒" label="حضور در سیستم" value={hours(k.activeMin)} spark={data.series.hours} color="#8b5cf6"
              hint={`${fa(k.presentDays)} روز‌نفر حضور`} onClick={() => open("attendance", "روزهای حضور")} />
            <Kpi icon="⚙️" label="بهره‌وری" value={k.perHour === null ? "—" : `${k.perHour.toLocaleString("fa-IR")}`}
              hint="کار بسته‌شده در هر ساعت حضور" color="#ec4899" onClick={() => open("attendance", "روزهای حضور (مخرج بهره‌وری)")} />
            <Kpi icon="💰" label="فروش ثبت‌شده" value={`${faShort(k.revenue)}`} delta={[k.revenue, data.prev.revenue]}
              hint={`${fa(k.deals)} معامله · سود ${faShort(k.profit)} تومان`} color="#10b981" onClick={() => open("deals", "معامله‌ها و فروش")} />
            <Kpi icon="🗂️" label="مستندسازی و ارجاع" value={fa(k.documented)}
              hint={`${fa(k.referrals)} ارجاع · ${fa(k.system)} کار خودکار`} color="#64748b" onClick={() => open("documented", "کارهای مستندشده")} />
          </div>

          {/* ── روند روزانه ─────────────────────────────────────────── */}
          <Card title="روند روزانه" sub="ستون‌ها کار بسته‌شده‌ی هر روز است (قرمز یعنی بعد از مهلت). خط‌ها کار ثبت‌شده و ساعت حضور. روی هر روز بزنید تا کارهایش باز شود؛ روی راهنما بزنید تا هر سری خاموش شود.">
            <ComboChart
              labels={data.days}
              labelOf={dayLabel}
              onPick={(i) => open("done", `بسته‌شده‌ی ${dayLabel(data.days[i])}`, ownerId, { day: data.days[i] })}
              bars={[
                { key: "ontime", label: "بسته‌شده", color: "#10b981", data: data.series.done.map((v, i) => v - data.series.late[i]) },
                { key: "late", label: "با تأخیر", color: "#f43f5e", data: data.series.late },
              ]}
              lines={[
                { key: "created", label: "ثبت‌شده", color: "#6366f1", data: data.series.created },
                { key: "hours", label: "ساعت حضور", color: "#a855f7", data: data.series.hours, dashed: true },
              ]}
            />
          </Card>

          {/* ── قهرمان‌ها ───────────────────────────────────────────── */}
          {!focused && champions.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-xs font-black text-gray-900 dark:text-white">ستاره‌های این بازه</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {champions.map((c) => (
                  <button key={c.label} onClick={() => pick(c.id)}
                    className="group relative overflow-hidden text-right p-3.5 rounded-3xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all hover:-translate-y-0.5">
                    <span className="absolute -left-3 -top-3 text-5xl opacity-10 group-hover:opacity-20 transition-opacity">{c.icon}</span>
                    <span className="block text-[10.5px] font-bold text-gray-400">{c.icon} {c.label}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <span className="w-8 h-8 flex-shrink-0 rounded-xl grid place-items-center text-[11px] font-black text-white" style={{ background: avatarColor(c.id) }}>
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-gray-900 dark:text-white">{c.name}</span>
                        <span className="block text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400">{c.value}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── مقایسه‌ی کارکنان ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <Card className="xl:col-span-3" title="حجم در برابر دقت"
              sub="هر حباب یک کارمند: افقی تعداد کار بسته‌شده، عمودی درصد بستن به‌موقع، اندازه‌ی حباب ساعت حضور. خط‌چین‌ها میانه‌ی تیم‌اند. روی حباب بزنید.">
              <ScatterChart
                xLabel="کار بسته‌شده"
                yLabel="به‌موقع"
                activeId={ownerId}
                onPick={pick}
                points={data.staff.filter((s) => s.done > 0).map((s) => ({
                  id: s.userId, label: s.name, x: s.done,
                  y: rate(s.onTime, s.withDue) ?? rate(s.success, s.rated) ?? 0,
                  r: Math.max(1, s.activeMin), color: avatarColor(s.userId),
                }))}
              />
            </Card>
            <Card className="xl:col-span-2" title={focused ? `${focused.name} در برابر تیم` : "سه نفر اول در برابر میانگین"}
              sub="هر محور نسبت به بهترینِ تیم در همین بازه سنجیده می‌شود (۱۰۰ = بهترین). روی نام هر محور بزنید تا کارهایش باز شود.">
              {radar ? <RadarChart axes={radar.axes} series={radar.series} onAxis={(i) => {
                const [m, t] = RADAR_DRILL[i];
                open(m, t);
              }} /> : <p className="py-10 text-center text-xs text-gray-400">کاری بسته نشده</p>}
            </Card>
          </div>

          <Card title="سهم هر کارمند از حوزه‌ها" sub="طول میله تعداد کار بسته‌شده و رنگ‌ها حوزه‌ی کار است. روی هر تکه‌ی رنگی بزنید تا کارهای همان حوزه‌ی همان نفر باز شود؛ روی نام بزنید تا گزارش فقط برای او شود.">
            <StackedRows
              rows={[...data.staff].sort((a, b) => b.done - a.done).map((s) => ({ id: s.userId, label: s.name, values: s.byDomain }))}
              keys={data.domains}
              onPick={pick}
              onSegment={(id, key) => {
                const st = data.staff.find((x) => x.userId === id);
                const dom = data.domains.find((x) => x.key === key);
                open("done", `حوزه‌ی ${dom?.label ?? key} — ${st?.name ?? ""}`, id, { domain: key });
              }}
              activeId={ownerId}
            />
          </Card>

          {/* ── الگوی کار ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <Card className="xl:col-span-3" title="نقشه‌ی ساعت کاری" sub="هر خانه تعداد کارهایی است که در آن روز هفته و آن ساعت (به وقت تهران) بسته شده. روی خانه، نام روز یا عدد ساعت بزنید.">
              <Heatmap grid={data.heatmap} onPick={(wd, hour) => open(
                "done",
                wd !== undefined && hour !== undefined ? `بسته‌شده ${WEEKDAY_NAMES[wd]} ساعت ${fa(hour)}`
                  : wd !== undefined ? `بسته‌شده در ${WEEKDAY_NAMES[wd]}‌ها` : `بسته‌شده ساعت ${fa(hour ?? 0)} تا ${fa((hour ?? 0) + 1)}`,
                ownerId,
                { ...(wd !== undefined ? { wd: String(wd) } : {}), ...(hour !== undefined ? { hour: String(hour) } : {}) },
              )} />
            </Card>
            <Card className="xl:col-span-2" title="از ثبت تا بستن" sub="هر کار چقدر طول کشید تا بسته شود.">
              <ColumnChart items={data.closeTime} colors={["#10b981", "#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444"]}
                onPick={openItem(data.closeTime.map((c) => ({ ...c, color: "" })), "bucket", "done", "بسته‌شده در ")} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="تفکیک حوزه">
              <DonutChart items={data.byDomain} size={150} onPick={openItem(data.byDomain, "domain", "done", "حوزه‌ی ")} />
            </Card>
            <Card title="کانال ارتباط">
              {data.byChannel.length ? <DonutChart items={data.byChannel} size={150} onPick={openItem(data.byChannel, "channel")} /> : <p className="py-10 text-center text-xs text-gray-400">کار کانال‌دار بسته نشده</p>}
            </Card>
            <div className="space-y-4">
              <Card title="اولویت کارهای بسته‌شده"><ShareBar items={data.byPriority} onPick={openItem(data.byPriority, "priority", "done", "اولویت ")} /></Card>
              <Card title="منشأ کار"><ShareBar items={data.bySource} onPick={openItem(data.bySource, "source")} /></Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="پرکارترین نوع‌ها">
              <HBarChart items={data.byType} onPick={openItem(data.byType, "typeId")} />
            </Card>
            <Card title="نتیجه‌ی کارها" sub="سبز یعنی نتیجه‌ی موفقِ همان نوع کار. این همان چیزی است که نرخ تبدیل از رویش درمی‌آید.">
              <HBarChart items={data.byOutcome} onPick={openItem(data.byOutcome, "outcome")} />
            </Card>
          </div>

          {data.system.length > 0 && (
            <Card title="کار خودکار" sub="این‌ها از خودِ نوشتن در پنل استخراج می‌شوند و کسی ثبتشان نکرده. عمداً با کار دستی جمع نمی‌شوند.">
              <HBarChart
                items={data.system.map((s, i) => ({ label: s.label, value: s.value, color: ["#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981", "#6366f1", "#84cc16"][i % 7] }))}
                onPick={(i) => open("system", data.system[i].label, ownerId, { systemKey: data.system[i].key })}
              />
            </Card>
          )}

          {/* ── جدول کارکنان ─────────────────────────────────────────── */}
          <Card title="کارنامه‌ی کارکنان" sub="روی نام بزنید تا همه‌ی نمودارها فقط برای او شود. روی هر عدد بزنید تا کارهای پشتش را ببینید. سرستون‌ها مرتب می‌کنند.">
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs min-w-[1080px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100 dark:border-white/5">
                    <Th className="text-right">کارمند</Th>
                    <Th>روند</Th>
                    <SortTh k="done" sort={sort} setSort={setSort}>بسته‌شده</SortTh>
                    <SortTh k="onTime" sort={sort} setSort={setSort}>به‌موقع</SortTh>
                    <SortTh k="success" sort={sort} setSort={setSort}>موفقیت</SortTh>
                    <Th>ثبت نتیجه</Th>
                    <SortTh k="closeMin" sort={sort} setSort={setSort}>زمان بستن</SortTh>
                    <SortTh k="calls" sort={sort} setSort={setSort}>تماس</SortTh>
                    <SortTh k="documented" sort={sort} setSort={setSort}>مستندسازی</SortTh>
                    <SortTh k="overdue" sort={sort} setSort={setSort}>عقب‌افتاده</SortTh>
                    <SortTh k="activeMin" sort={sort} setSort={setSort}>حضور</SortTh>
                    <SortTh k="perHour" sort={sort} setSort={setSort}>کار/ساعت</SortTh>
                    <SortTh k="revenue" sort={sort} setSort={setSort}>فروش</SortTh>
                    <Th>خودکار</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={14} className="py-8 text-center text-gray-400">در این بازه کاری ثبت نشده است</td>
                    </tr>
                  )}
                  {sorted.map((s, idx) => {
                    const on = rate(s.onTime, s.withDue);
                    const sc = rate(s.success, s.rated);
                    const oc = rate(s.withOutcome, s.created);
                    const ph = perHour(s);
                    const d = (metric: Drill, title: string) => () => open(metric, `${title} — ${s.name}`, s.userId);
                    return (
                      <tr key={s.userId}
                        className={`border-b border-gray-50 dark:border-white/5 transition-colors ${
                          ownerId === s.userId ? "bg-indigo-500/[0.06]" : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                        }`}>
                        <td className="py-2 px-2">
                          <button onClick={() => pick(s.userId)} className="flex items-center gap-2 text-right group">
                            <span className="w-5 text-[10px] font-black tabular-nums text-gray-300">{fa(idx + 1)}</span>
                            <span className="w-8 h-8 flex-shrink-0 rounded-xl grid place-items-center text-[10.5px] font-black text-white shadow-sm" style={{ background: avatarColor(s.userId) }}>
                              {initials(s.name)}
                            </span>
                            <span>
                              <span className="block font-black text-gray-800 dark:text-gray-100 group-hover:text-indigo-600">{s.name}</span>
                              <span className="block text-[10px] text-gray-400">
                                {fa(s.presentDays)} روز حضور · {fa(s.notes)} یادداشت
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-2">
                          <button onClick={d("done", "بسته‌شده")} className="flex justify-center w-full rounded-lg hover:bg-indigo-500/10 py-1" title="کارهای بسته‌شده">
                            <Sparkline data={s.spark} color={avatarColor(s.userId)} width={72} height={24} />
                          </button>
                        </td>
                        <NumTd onClick={d("done", "بسته‌شده")} strong>
                          {fa(s.done)}
                          <span className="block text-[9.5px] font-normal text-gray-400" onClick={(e) => { e.stopPropagation(); d("created", "ثبت‌شده")(); }}>
                            {fa(s.created)} ثبت
                          </span>
                        </NumTd>
                        <RateTd value={on} num={s.onTime} den={s.withDue} onClick={d("late", "بعد از مهلت")} />
                        <RateTd value={sc} num={s.success} den={s.rated} onClick={d("success", "نتیجه‌ی موفق")} />
                        <RateTd value={oc} num={s.withOutcome} den={s.created} onClick={d("noOutcome", "بدون نتیجه")} />
                        <NumTd onClick={d("done", "زمان بستن")}>{duration(s.closeMin)}</NumTd>
                        <NumTd onClick={d("calls", "تماس‌ها")}>{fa(s.calls)}</NumTd>
                        <NumTd onClick={d("documented", "مستندشده")}>
                          {fa(s.documented)}
                          {s.referralsOut + s.referralsIn > 0 && (
                            <span className="block text-[9.5px] font-normal text-gray-400">↗{fa(s.referralsOut)} ↙{fa(s.referralsIn)}</span>
                          )}
                        </NumTd>
                        <NumTd onClick={d("overdue", "عقب‌افتاده")} tone={s.overdue ? "bad" : "muted"}>{fa(s.overdue)}</NumTd>
                        <NumTd onClick={d("attendance", "روزهای حضور")}>{s.activeMin ? hours(s.activeMin) : "—"}</NumTd>
                        <NumTd onClick={d("attendance", "روزهای حضور")}>{ph === null ? "—" : ph.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}</NumTd>
                        <NumTd onClick={d("deals", "معامله‌ها")}>
                          {s.revenue ? faShort(s.revenue) : "—"}
                          {s.deals > 0 && <span className="block text-[9.5px] font-normal text-gray-400">{fa(s.deals)} معامله</span>}
                        </NumTd>
                        <NumTd onClick={d("system", "کار خودکار")}>{fa(s.system)}</NumTd>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[11px] text-gray-400 leading-6">
            «بسته‌شده»، «به‌موقع»، «موفقیت» و «زمان بستن» بر اساس روزی است که کار بسته شده؛
            «ثبت‌شده» و «ثبت نتیجه» بر اساس روزی که ثبت شده. «عقب‌افتاده» وضعیت همین حالاست، نه در بازه.
            «مستندسازی» تعداد کارهای متمایزی است که روی آن‌ها یادداشت یا ارجاع ثبت شده — ده یادداشت روی
            یک کار، یک واحد است. «حضور» از ورود به پنل حساب می‌شود و «فروش» از معامله‌های باطل‌نشده.
            فلش‌ها مقایسه با دوره‌ی هم‌طولِ قبل است.
          </p>
        </div>
      )}

      {drill && (
        <DrillSheet
          query={query}
          metric={drill.metric}
          ownerId={drill.ownerId}
          extra={drill.extra}
          title={drill.title}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  done: "کار بسته‌شده", onTime: "بستن به‌موقع", success: "نتیجه‌ی موفق", closeMin: "سرعت بستن",
  calls: "تماس", activeMin: "حضور", perHour: "بهره‌وری", revenue: "فروش", overdue: "عقب‌افتاده", documented: "مستندسازی",
};

const WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** محورهای رادار به ترتیب `radar.axes` ← پنجره‌ی همان معیار */
const RADAR_DRILL: [Drill, string][] = [
  ["done", "کارهای بسته‌شده"],
  ["late", "بسته‌شده بعد از مهلت"],
  ["success", "بسته‌شده با نتیجه‌ی موفق"],
  ["noOutcome", "ثبت‌شده بدون نتیجه"],
  ["documented", "کارهای مستندشده"],
  ["done", "کارهای بسته‌شده با زمان بستن"],
  ["attendance", "روزهای حضور"],
];

// ── سربرگ: تیم یا کارمند انتخاب‌شده ───────────────────────────────────────────
function Hero({
  data, focused, rankOf, sortLabel, onOpen,
}: {
  data: Summary;
  focused: StaffRow | null;
  rankOf: (id: string) => number;
  sortLabel: string;
  onOpen: (metric: Drill, title: string) => void;
}) {
  const k = data.kpi;
  if (focused) {
    const c = avatarColor(focused.userId);
    return (
      <div className="relative overflow-hidden p-5 rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${c}, #1e1b4b)` }}>
        <div className="absolute -left-10 -bottom-16 w-56 h-56 rounded-full bg-white/10" />
        <div className="absolute left-24 -top-12 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur grid place-items-center text-xl font-black">{initials(focused.name)}</span>
          <div className="flex-1 min-w-[160px]">
            <h2 className="text-lg font-black">{focused.name}</h2>
            <p className="mt-1 text-xs text-white/75">
              رتبه‌ی {fa(rankOf(focused.userId))} از {fa(data.staff.length)} در «{sortLabel}» ·
              {" "}{fa(focused.presentDays)} روز حضور · {hours(focused.activeMin)}
            </p>
          </div>
          <div className="flex gap-4">
            {[
              { l: "به‌موقع", v: rate(focused.onTime, focused.withDue), m: "late" as Drill, t: "بسته‌شده بعد از مهلت" },
              { l: "موفق", v: rate(focused.success, focused.rated), m: "success" as Drill, t: "بسته‌شده با نتیجه‌ی موفق" },
              { l: "نتیجه", v: rate(focused.withOutcome, focused.created), m: "noOutcome" as Drill, t: "ثبت‌شده بدون نتیجه" },
            ].map((x) => (
              <button key={x.l} onClick={() => onOpen(x.m, x.t)} className="text-center rounded-2xl p-1 hover:bg-white/10 [&_span]:!text-white [&_circle:first-child]:!text-white/20">
                <RingGauge value={x.v} label={x.l} color="#ffffff" size={68} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const avg = k.activeStaff ? k.done / k.activeStaff : 0;
  return (
    <div className="relative overflow-hidden p-5 rounded-3xl text-white shadow-lg bg-gradient-to-l from-indigo-600 via-blue-600 to-cyan-500">
      <div className="absolute -left-10 -bottom-16 w-56 h-56 rounded-full bg-white/10" />
      <div className="absolute left-32 -top-14 w-36 h-36 rounded-full bg-white/5" />
      <div className="relative flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[180px]">
          <p className="text-xs font-bold text-white/70">عملکرد کل تیم</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{fa(k.done)} <span className="text-base font-bold text-white/70">کار بسته‌شده</span></p>
          <p className="mt-1.5 text-xs text-white/75">
            {fa(k.activeStaff)} نفر فعال · میانگین هر نفر {avg.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کار ·
            {" "}{hours(k.activeMin)} حضور
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <HeroStat label="به‌موقع" value={k.onTimeRate === null ? "—" : `${fa(k.onTimeRate)}٪`} onClick={() => onOpen("late", "بسته‌شده بعد از مهلت")} />
          <HeroStat label="موفق" value={k.successRate === null ? "—" : `${fa(k.successRate)}٪`} onClick={() => onOpen("success", "بسته‌شده با نتیجه‌ی موفق")} />
          <HeroStat label="فروش" value={faShort(k.revenue)} onClick={() => onOpen("deals", "معامله‌ها و فروش")} />
          <HeroStat label="عقب‌افتاده" value={fa(k.overdue)} warn={k.overdue > 0} onClick={() => onOpen("overdue", "عقب‌افتاده‌ی همین حالا")} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, warn, onClick }: { label: string; value: string; warn?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`text-right px-4 py-2.5 rounded-2xl backdrop-blur transition-colors ${warn ? "bg-red-500/30 hover:bg-red-500/40" : "bg-white/15 hover:bg-white/25"}`}>
      <span className="block text-[10.5px] font-bold text-white/70">{label}</span>
      <span className="block text-lg font-black tabular-nums">{value}</span>
    </button>
  );
}

// ── کارت‌ها ────────────────────────────────────────────────────────────────────
function Delta({ cur, prev, suffix = "٪", points }: { cur: number; prev: number; suffix?: string; points?: boolean }) {
  let diff: number;
  if (points) diff = cur;
  else {
    if (!prev) return null;
    diff = Math.round(((cur - prev) / prev) * 100);
  }
  if (!diff) return <span className="text-[10px] font-bold text-gray-400">بدون تغییر</span>;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${up ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
      {up ? "▲" : "▼"} {fa(Math.abs(diff))}{suffix}
    </span>
  );
}

function Kpi({
  icon, label, value, hint, tone, spark, color = "#6366f1", delta, onClick,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
  spark?: number[];
  color?: string;
  delta?: [number, number];
  onClick?: () => void;
}) {
  const valueColor = tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-rose-500" : "text-gray-900 dark:text-white";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick}
      className={`group relative overflow-hidden text-right p-4 rounded-3xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 transition-all ${
        onClick ? "hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
      }`}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(to left, ${color}, transparent)` }} />
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-xl grid place-items-center text-sm" style={{ background: `${color}1a` }}>{icon}</span>
        <span className="flex-1 text-[11px] font-bold text-gray-500">{label}</span>
        {delta && <Delta cur={delta[0]} prev={delta[1]} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={`text-2xl font-black tabular-nums ${valueColor}`}>{value}</span>
        {spark && <Sparkline data={spark} color={color} width={80} height={30} />}
      </div>
      {hint && <span className="block mt-1 text-[10px] text-gray-400">{hint}</span>}
      {onClick && <span className="absolute left-3 bottom-2 text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">جزئیات ←</span>}
    </Tag>
  );
}

function KpiRing({
  label, value, hint, delta, onClick, action,
}: {
  label: string;
  value: number | null;
  hint: string;
  delta?: number | null;
  onClick?: () => void;
  action?: string;
}) {
  return (
    <button onClick={onClick}
      className="group relative text-right p-4 rounded-3xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <RingGauge value={value} size={62} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-500">{label}</span>
            {delta !== undefined && delta !== null && <Delta cur={delta} prev={0} points suffix=" واحد" />}
          </div>
          <span className="block mt-1 text-[10px] leading-4 text-gray-400">{hint}</span>
        </div>
      </div>
      {action && <span className="absolute left-3 bottom-2 text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">{action} ←</span>}
    </button>
  );
}

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 ${className}`}>
      <h2 className="text-[13px] font-black text-gray-900 dark:text-white">{title}</h2>
      {sub && <p className="mt-0.5 mb-3 text-[10.5px] leading-5 text-gray-400">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`py-2 px-2 font-bold whitespace-nowrap ${className || "text-center"}`}>{children}</th>;
}

function SortTh({ k, sort, setSort, children }: { k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; children: React.ReactNode }) {
  return (
    <th className="py-2 px-2 font-bold text-center whitespace-nowrap">
      <button onClick={() => setSort(k)} className={`inline-flex items-center gap-0.5 ${sort === k ? "text-indigo-600 dark:text-indigo-400" : "hover:text-gray-600"}`}>
        {children}{sort === k && <span className="text-[9px]">▼</span>}
      </button>
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-2 px-2 text-center tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">{children}</td>;
}

function NumTd({ children, onClick, strong, tone }: { children: React.ReactNode; onClick: () => void; strong?: boolean; tone?: "bad" | "muted" }) {
  const color = tone === "bad" ? "text-rose-500" : tone === "muted" ? "text-gray-400" : strong ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300";
  return (
    <td className="py-2 px-1 text-center">
      <button onClick={onClick} className={`min-w-[2.5rem] px-2 py-1 rounded-lg tabular-nums hover:bg-indigo-500/10 hover:text-indigo-600 ${strong ? "font-black" : "font-bold"} ${color}`}>
        {children}
      </button>
    </td>
  );
}

function RateTd({ value, num, den, onClick }: { value: number | null; num: number; den: number; onClick: () => void }) {
  if (value === null) return <Td><span className="text-gray-300">—</span></Td>;
  const c = value >= 80 ? "#10b981" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <td className="py-2 px-1 text-center">
      <button onClick={onClick} className="w-full min-w-[4.5rem] px-1.5 py-1 rounded-lg hover:bg-indigo-500/10" title={`${fa(num)} از ${fa(den)}`}>
        <span className="block text-[11px] font-black tabular-nums" style={{ color: c }}>{fa(value)}٪</span>
        <span className="mt-0.5 block h-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${value}%`, background: c }} />
        </span>
        <span className="block mt-0.5 text-[9px] tabular-nums text-gray-400">{fa(num)}/{fa(den)}</span>
      </button>
    </td>
  );
}

// ── پنجره‌ی جزئیات ──────────────────────────────────────────────────────────────
interface TaskRow {
  id: string;
  title: string;
  type: string;
  domain: string;
  status: StaffTaskStatus;
  priority: StaffPriority;
  channel: StaffChannel;
  owner: string;
  contact: string | null;
  linkUrl: string | null;
  note: string | null;
  amount: number | null;
  outcome: string | null;
  isSuccess: boolean;
  createdAt: string;
  dueAt: string | null;
  doneAt: string | null;
  closeMin: number | null;
  late: boolean;
}
interface DealRow { id: string; title: string; owner: string; customer: string | null; revenue: number; profit: number | null; status: string; at: string; href: string | null }
interface DayRow { id: string; owner: string; day: string; firstIn: string; lastOut: string; activeMin: number; grossMin: number; edited: string | null }
interface ActRow { id: string; owner: string; label: string; title: string; at: string; href: string | null }

type DrillData =
  | { kind: "tasks"; total: number; byOwner: OwnerCount[]; stats: { late: number; success: number; closeMin: number | null }; rows: TaskRow[] }
  | { kind: "deals"; total: number; byOwner: OwnerCount[]; sum: { revenue: number; profit: number }; rows: DealRow[] }
  | { kind: "days"; total: number; byOwner: OwnerCount[]; sum: { activeMin: number }; rows: DayRow[] }
  | { kind: "activity"; total: number; byOwner: OwnerCount[]; rows: ActRow[] };
type OwnerCount = { name: string; count: number };

type TaskSort = "recent" | "slow" | "fast";

const jDate = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { weekday: "short", month: "long", day: "numeric" });
const jTime = (iso: string) => new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

function DrillSheet({
  query, metric, ownerId, extra, title, onClose,
}: {
  query: URLSearchParams;
  metric: Drill;
  ownerId: string | null;
  extra?: DrillExtra;
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrillData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [who, setWho] = useState<string | null>(null);
  const [taskSort, setTaskSort] = useState<TaskSort>(title.includes("زمان بستن") ? "slow" : "recent");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(query);
    qs.set("detail", metric);
    if (ownerId) qs.set("ownerId", ownerId);
    for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined) qs.set(k, v);
    fetch(`/api/admin/worklist/summary?${qs}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"));
  }, [query, metric, ownerId, extra]);

  const match = (fields: (string | null | undefined)[]) => {
    const t = q.trim();
    return !t || fields.some((x) => x?.includes(t));
  };

  const rows = useMemo(() => {
    if (!data) return [];
    switch (data.kind) {
      case "tasks": {
        const r = data.rows.filter((x) => (!who || x.owner === who) && match([x.title, x.type, x.owner, x.contact, x.outcome, x.note]));
        if (taskSort === "slow") r.sort((a, b) => (b.closeMin ?? -1) - (a.closeMin ?? -1));
        if (taskSort === "fast") r.sort((a, b) => (a.closeMin ?? Infinity) - (b.closeMin ?? Infinity));
        return r;
      }
      case "deals": return data.rows.filter((x) => (!who || x.owner === who) && match([x.title, x.owner, x.customer]));
      case "days": return data.rows.filter((x) => (!who || x.owner === who) && match([x.owner]));
      case "activity": return data.rows.filter((x) => (!who || x.owner === who) && match([x.title, x.owner, x.label]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, who, taskSort]);

  const box = "divide-y divide-gray-100 dark:divide-white/5 rounded-2xl border border-gray-200 dark:border-white/10";

  return (
    <Sheet open wide onClose={onClose} title={data ? `${title} (${fa(data.total)})` : title}>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {!data && !error && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      )}
      {data && (
        <div className="space-y-3">
          {/* ── خلاصه ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniStat label="تعداد" value={fa(data.total)} />
            {data.kind === "tasks" && (
              <>
                <MiniStat label="بعد از مهلت" value={fa(data.stats.late)} tone={data.stats.late ? "bad" : undefined} />
                <MiniStat label="نتیجه‌ی موفق" value={fa(data.stats.success)} tone="good" />
                <MiniStat label="میانه‌ی زمان بستن" value={duration(data.stats.closeMin)} />
              </>
            )}
            {data.kind === "deals" && (
              <>
                <MiniStat label="فروش (تومان)" value={fa(data.sum.revenue)} tone="good" />
                <MiniStat label="سود (تومان)" value={fa(data.sum.profit)} />
              </>
            )}
            {data.kind === "days" && <MiniStat label="جمع حضور" value={hours(data.sum.activeMin)} />}
          </div>

          {/* ── تفکیک کارمند ──────────────────────────────── */}
          {data.byOwner.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip on={!who} onClick={() => setWho(null)}>همه ({fa(data.total)})</Chip>
              {data.byOwner.map((o) => (
                <Chip key={o.name} on={who === o.name} onClick={() => setWho(who === o.name ? null : o.name)}>
                  {o.name} ({fa(o.count)})
                </Chip>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {data.rows.length > 6 && (
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs focus:outline-none focus:border-indigo-400" />
            )}
            {data.kind === "tasks" && data.rows.some((r) => r.closeMin !== null) && (
              <select value={taskSort} onChange={(e) => setTaskSort(e.target.value as TaskSort)}
                className="px-2 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-bold">
                <option value="recent">تازه‌ترین</option>
                <option value="slow">دیرترین بستن</option>
                <option value="fast">سریع‌ترین بستن</option>
              </select>
            )}
          </div>

          {rows.length === 0 && <p className="py-6 text-center text-xs text-gray-400">موردی نیست.</p>}

          {data.kind === "tasks" && rows.length > 0 && (
            <div className={box}>
              {(rows as TaskRow[]).map((r) => (
                <div key={r.id} className="px-3 py-2.5">
                  <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="w-full text-right">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-800 dark:text-gray-100">{r.title}</span>
                        <span className="block mt-0.5 text-[11px] text-gray-400">
                          {r.type} · {r.domain} · <b className="text-gray-500">{r.owner}</b>
                          {r.contact && <> · {r.contact}</>}
                          {r.channel !== "NONE" && <> · {CHANNEL_LABELS[r.channel]}</>}
                        </span>
                      </span>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {r.outcome && (
                        <span className={`px-2 py-0.5 rounded-lg font-bold ${r.isSuccess ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-100 dark:bg-white/5 text-gray-500"}`}>{r.outcome}</span>
                      )}
                      {(r.priority === "HIGH" || r.priority === "URGENT") && (
                        <span className="px-2 py-0.5 rounded-lg font-bold bg-orange-500/10 text-orange-600">{PRIORITY_LABELS[r.priority]}</span>
                      )}
                      {r.late && <span className="px-2 py-0.5 rounded-lg font-bold bg-rose-500/10 text-rose-600">بعد از مهلت</span>}
                      {r.closeMin !== null && <span className="px-2 py-0.5 rounded-lg font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">⏳ {duration(r.closeMin)}</span>}
                      <span className="text-gray-400">ثبت {formatDateTime(r.createdAt)}</span>
                      {r.doneAt && <span className="text-gray-400">· بسته {formatDateTime(r.doneAt)}</span>}
                    </div>
                  </button>
                  {openId === r.id && (
                    <div className="mt-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] p-3 text-[11px] leading-6 text-gray-600 dark:text-gray-300 space-y-0.5">
                      <div>اولویت: {PRIORITY_LABELS[r.priority]} · وضعیت: {STATUS_LABELS[r.status]}</div>
                      <div>ثبت: {formatDateTime(r.createdAt)}{r.dueAt && <> · مهلت: {formatDateTime(r.dueAt)}</>}{r.doneAt && <> · بسته: {formatDateTime(r.doneAt)}</>}</div>
                      {r.amount !== null && <div>مبلغ: {fa(r.amount)} تومان</div>}
                      {r.note && <div className="whitespace-pre-line">یادداشت: {r.note}</div>}
                      {r.linkUrl && <a href={r.linkUrl} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 hover:underline">باز کردن لینک کار ←</a>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.kind === "deals" && rows.length > 0 && (
            <div className={box}>
              {(rows as DealRow[]).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    {r.href ? (
                      <a href={r.href} className="block truncate text-sm font-bold text-blue-700 dark:text-blue-300 hover:underline">{r.title}</a>
                    ) : <span className="block truncate text-sm font-bold">{r.title}</span>}
                    <span className="block text-[11px] text-gray-400">
                      <b className="text-gray-500">{r.owner}</b>{r.customer && <> · {r.customer}</>} · {jDate(r.at)}
                      {r.status === "PENDING" && <> · <span className="text-amber-600">در انتظار قیمت خرید</span></>}
                    </span>
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-black tabular-nums">{fa(r.revenue)}</span>
                    {r.profit !== null && <span className="block text-[10.5px] tabular-nums text-emerald-600">سود {fa(r.profit)}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.kind === "days" && rows.length > 0 && (
            <div className={box}>
              {(rows as DayRow[]).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold">{jDate(r.day)}</span>
                    <span className="block text-[11px] text-gray-400">
                      <b className="text-gray-500">{r.owner}</b> · ورود {jTime(r.firstIn)} · آخرین حضور {jTime(r.lastOut)}
                      {r.edited && <> · اصلاح‌شده توسط {r.edited}</>}
                    </span>
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-black tabular-nums">{hours(r.activeMin)}</span>
                    <span className="block h-1.5 w-20 mt-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                      <span className="block h-full bg-violet-500" style={{ width: `${Math.min(100, (r.activeMin / 480) * 100)}%` }} />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.kind === "activity" && rows.length > 0 && (
            <div className={box}>
              {(rows as ActRow[]).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    {r.href ? (
                      <a href={r.href} className="block truncate text-sm font-bold text-blue-700 dark:text-blue-300 hover:underline">{r.title}</a>
                    ) : <span className="block truncate text-sm font-bold">{r.title}</span>}
                    <span className="block text-[11px] text-gray-400"><b className="text-gray-500">{r.owner}</b> · {r.label} · {formatDateTime(r.at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.total > data.rows.length && (
            <p className="text-center text-[11px] text-gray-400">{fa(data.rows.length)} مورد از {fa(data.total)} نشان داده شد.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const c = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-500" : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-white/[0.04] px-3 py-2">
      <span className="block text-[10px] font-bold text-gray-400">{label}</span>
      <span className={`block text-sm font-black tabular-nums ${c}`}>{value}</span>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${on ? "bg-indigo-500 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"}`}>
      {children}
    </button>
  );
}
