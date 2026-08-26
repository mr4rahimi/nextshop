"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MultiLineChart, DonutChart, HBarChart, fa } from "./charts";
import ChangeDetails, { type FieldChange } from "./ChangeDetails";

// ── ثابت‌ها ──────────────────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  CREATE: "ایجاد", UPDATE: "ویرایش", DELETE: "حذف",
  BULK_UPDATE: "ویرایش گروهی", UPLOAD: "آپلود", LOGIN: "ورود",
};
const ACTION_COLORS: Record<string, string> = {
  CREATE: "#16a34a", UPDATE: "#6366f1", DELETE: "#e11d48",
  BULK_UPDATE: "#d97706", UPLOAD: "#0891b2", LOGIN: "#6b7280",
};
const ENTITY_LABELS: Record<string, string> = {
  PRODUCT: "محصول", CATEGORY: "دسته‌بندی", BRAND: "برند", MEDIA: "رسانه",
  WIDGET: "ویجت", PAGE: "برگه", ORDER: "سفارش", STORY: "استوری",
  HERO_SLIDE: "اسلاید", BLOG: "بلاگ", USER: "کاربر", SETTINGS: "تنظیمات", OTHER: "سایر",
};
const ENTITY_COLORS = ["#6366f1", "#0891b2", "#16a34a", "#d97706", "#e11d48", "#8b5cf6", "#0d9488", "#6b7280"];

const PRESETS = [
  { key: "7d", label: "۷ روز" },
  { key: "30d", label: "۳۰ روز" },
  { key: "90d", label: "۹۰ روز" },
  { key: "month", label: "ماه جاری" },
];

// ── Types ────────────────────────────────────────────────────────────────────
interface Summary {
  kpi: {
    productsCreated: number; productsUpdated: number; productsTotal: number;
    productsActive: number; productsInactive: number; productsNoImage: number;
    imagesUploaded: number; deletions: number; activityTotal: number; activeAdmins: number;
  };
  days: string[];
  series: Record<string, number[]>;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
  byActor: { id: string; name: string; count: number; actions: Record<string, number> }[];
  hasActivityData: boolean;
}

interface LogRow {
  id: string; actorName: string; actorPhone: string | null;
  action: string; entity: string; entityId: string | null; entityTitle: string | null;
  summary: string | null; changes: FieldChange[] | null; ip: string | null; createdAt: string;
}

function faDateTime(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── کارت آمار ────────────────────────────────────────────────────────────────
function Kpi({ label, value, hint, tone = "indigo", icon }: {
  label: string; value: number; hint?: string; tone?: string; icon: string;
}) {
  const tones: Record<string, string> = {
    indigo:  "from-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    emerald: "from-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    cyan:    "from-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    amber:   "from-amber-500/10 text-amber-600 dark:text-amber-400",
    rose:    "from-rose-500/10 text-rose-600 dark:text-rose-400",
    gray:    "from-gray-500/10 text-gray-600 dark:text-gray-400",
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 bg-gradient-to-bl ${tones[tone]} to-transparent`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">{fa(value)}</p>
          {hint && <p className="mt-0.5 text-[11px] text-gray-400 truncate">{hint}</p>}
        </div>
        <span className="text-xl flex-shrink-0 opacity-70">{icon}</span>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── صفحه ─────────────────────────────────────────────────────────────────────
export default function ReportsClient() {
  const [preset, setPreset] = useState("30d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [fActor, setFActor] = useState("");
  const [fAction, setFAction] = useState("");
  const [fEntity, setFEntity] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // ── خلاصه ──
  useEffect(() => {
    setLoadingSummary(true);
    fetch(`/api/admin/reports/summary?preset=${preset}`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [preset]);

  // ── فهرست فعالیت ──
  const buildQuery = useCallback((cur?: string | null) => {
    const p = new URLSearchParams({ preset });
    if (fActor) p.set("actorId", fActor);
    if (fAction) p.set("action", fAction);
    if (fEntity) p.set("entity", fEntity);
    if (qDebounced) p.set("q", qDebounced);
    if (cur) p.set("cursor", cur);
    return p.toString();
  }, [preset, fActor, fAction, fEntity, qDebounced]);

  useEffect(() => {
    setLoadingLogs(true);
    fetch(`/api/admin/reports/activity?${buildQuery()}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.items ?? []); setCursor(d.nextCursor ?? null); })
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }, [buildQuery]);

  async function loadMore() {
    if (!cursor) return;
    const d = await fetch(`/api/admin/reports/activity?${buildQuery(cursor)}`).then((r) => r.json());
    setLogs((prev) => [...prev, ...(d.items ?? [])]);
    setCursor(d.nextCursor ?? null);
  }

  const chartSeries = useMemo(() => {
    if (!summary) return [];
    return [
      { key: "created", label: "محصول جدید", color: "#16a34a", data: summary.series.productsCreated },
      { key: "updated", label: "محصول بروزشده", color: "#6366f1", data: summary.series.productsUpdated },
      { key: "uploads", label: "آپلود تصویر", color: "#0891b2", data: summary.series.uploads },
      { key: "deletions", label: "حذف", color: "#e11d48", data: summary.series.deletions },
    ];
  }, [summary]);

  const actionDonut = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byAction)
      .map(([k, v]) => ({ label: ACTION_LABELS[k] ?? k, value: v, color: ACTION_COLORS[k] ?? "#6b7280" }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  const entityBars = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byEntity)
      .map(([k, v], i) => ({ label: ENTITY_LABELS[k] ?? k, value: v, color: ENTITY_COLORS[i % ENTITY_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  const k = summary?.kpi;

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      {}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">گزارش عملکرد</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            چه کسی چه چیزی را ساخت، عوض کرد یا حذف کرد — با جزئیات «قبل ← بعد»
          </p>
        </div>
        <div className="inline-flex gap-0.5 p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/[0.08] rounded-lg">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                preset === p.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[92px] rounded-2xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : k ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="محصول جدید" value={k.productsCreated} icon="🆕" tone="emerald" hint="در این بازه ساخته شده" />
          <Kpi label="محصول بروزشده" value={k.productsUpdated} icon="✏️" tone="indigo" hint="ویرایش‌شده در این بازه" />
          <Kpi label="آپلود تصویر و فایل" value={k.imagesUploaded} icon="🖼️" tone="cyan" hint="در این بازه" />
          <Kpi label="حذف" value={k.deletions} icon="🗑️" tone="rose" hint="در همه‌ی بخش‌ها" />
          <Kpi label="محصول بدون تصویر" value={k.productsNoImage} icon="⚠️" tone="amber" hint="کل سایت" />
          <Kpi label="ادمین فعال" value={k.activeAdmins} icon="👥" tone="gray" hint={`${fa(k.activityTotal)} فعالیت ثبت‌شده`} />
        </div>
      ) : null}

      {}
      {summary && !summary.hasActivityData && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/15 text-xs text-amber-800 dark:text-amber-300">
          <span className="text-base">ℹ️</span>
          <p className="leading-6">
            هنوز فعالیتی ثبت نشده است. شمارش «محصول جدید» و «محصول بروزشده» از خود جدول محصولات
            خوانده می‌شود و از همین حالا درست است، اما جزئیات «چه کسی و چه چیزی را تغییر داد»
            فقط برای تغییرهای <b>پس از فعال‌شدن این قابلیت</b> ثبت می‌شود.
          </p>
        </div>
      )}

      {}
      {summary && (
        <Card title="روند فعالیت روزانه"
          subtitle="روی راهنما کلیک کنید تا سری‌ها خاموش/روشن شوند">
          <MultiLineChart id="activity" days={summary.days} series={chartSeries} />
        </Card>
      )}

      {}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="نوع فعالیت‌ها">
            <DonutChart items={actionDonut} />
          </Card>

          <Card title="عملکرد ادمین‌ها" subtitle="تعداد فعالیت ثبت‌شده در بازه">
            <HBarChart items={summary.byActor.slice(0, 8).map((a) => ({
              label: a.name,
              value: a.count,
              sub: Object.entries(a.actions)
                .sort((x, y) => y[1] - x[1])
                .map(([act, c]) => `${ACTION_LABELS[act] ?? act} ${fa(c)}`)
                .join("  ·  "),
            }))} />
          </Card>

          <Card title="بخش‌های تغییریافته">
            <HBarChart items={entityBars} />
          </Card>
        </div>
      )}

      {}
      <Card title="دفتر فعالیت"
        subtitle="اگر ادمینی گفت «فلان محصول را گذاشتم و نیست»، اسمش را اینجا جستجو کنید">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در نام محصول، شرح یا ادمین..."
            className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:border-indigo-400 transition-colors" />
          <select value={fAction} onChange={(e) => setFAction(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-indigo-400">
            <option value="">همه‌ی فعالیت‌ها</option>
            {Object.entries(ACTION_LABELS).map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}
          </select>
          <select value={fEntity} onChange={(e) => setFEntity(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-indigo-400">
            <option value="">همه‌ی بخش‌ها</option>
            {Object.entries(ENTITY_LABELS).map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}
          </select>
        </div>

        {summary && summary.byActor.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button onClick={() => setFActor("")}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                fActor === "" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-500"
              }`}>همه‌ی ادمین‌ها</button>
            {summary.byActor.map((a) => (
              <button key={a.id} onClick={() => setFActor(a.id.startsWith("name:") ? "" : a.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  fActor === a.id ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-500"
                }`}>{a.name} ({fa(a.count)})</button>
            ))}
          </div>
        )}

        {loadingLogs ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-400">
            فعالیتی با این فیلترها پیدا نشد.
          </p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const isOpen = expanded === log.id;
              const color = ACTION_COLORS[log.action] ?? "#6b7280";
              return (
                <div key={log.id}
                  className="rounded-xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="w-full flex items-center gap-3 p-3 text-right hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <span className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black flex-shrink-0"
                      style={{ background: `${color}1a`, color }}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 flex-shrink-0 hidden sm:inline">
                      {ENTITY_LABELS[log.entity] ?? log.entity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                        {log.entityTitle ?? "—"}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{log.summary}</p>
                    </div>
                    <div className="text-left flex-shrink-0 hidden md:block">
                      <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{log.actorName}</p>
                      <p className="text-[10px] text-gray-400 tabular-nums">{faDateTime(log.createdAt)}</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.01] space-y-3">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 pt-3">
                        <span>ادمین: <b className="text-gray-700 dark:text-gray-200">{log.actorName}</b></span>
                        {log.actorPhone && <span>شماره: <span className="tabular-nums">{log.actorPhone}</span></span>}
                        <span>زمان: <span className="tabular-nums">{faDateTime(log.createdAt)}</span></span>
                        {log.ip && <span dir="ltr">IP: {log.ip}</span>}
                        {log.entity === "PRODUCT" && log.entityId && (
                          <a href={`/admin/products/${log.entityId}`}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                            باز کردن محصول ↗
                          </a>
                        )}
                      </div>
                      <ChangeDetails changes={log.changes ?? []} />
                    </div>
                  )}
                </div>
              );
            })}

            {cursor && (
              <button onClick={loadMore}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs font-bold text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-all">
                نمایش موارد بیشتر
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
