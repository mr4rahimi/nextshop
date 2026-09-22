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
 * صفحه‌ی تازه. «چرا او» فقط با ریزشدن جواب می‌گیرد.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { MultiLineChart, DonutChart, HBarChart, fa, dayLabel } from "@/components/admin/reports/charts";

type Preset = "7d" | "30d" | "90d" | "month";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "۷ روز" },
  { key: "30d", label: "۳۰ روز" },
  { key: "90d", label: "۹۰ روز" },
  { key: "month", label: "این ماه" },
];

interface StaffRow {
  userId: string;
  name: string;
  done: number;
  created: number;
  withOutcome: number;
  documented: number;
  overdue: number;
  system: number;
}

interface Summary {
  days: string[];
  kpi: {
    done: number;
    created: number;
    outcomeRate: number;
    overdue: number;
    documented: number;
    system: number;
    openNow: number;
  };
  series: { done: number[]; created: number[] };
  byDomain: { label: string; value: number; color: string }[];
  byType: { label: string; value: number; color: string }[];
  byOutcome: { label: string; value: number; color: string }[];
  system: { key: string; label: string; value: number }[];
  staff: StaffRow[];
  canExport: boolean;
}

export default function TeamReportClient() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ preset });
    if (ownerId) qs.set("ownerId", ownerId);
    fetch(`/api/admin/worklist/summary?${qs}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        return d;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => setLoading(false));
  }, [preset, ownerId]);

  useEffect(load, [load]);

  // نام کارمندِ فیلترشده — وقتی فیلتر روشن است، خودِ او در فهرست هست
  const focused = useMemo(
    () => data?.staff.find((s) => s.userId === ownerId)?.name ?? null,
    [data, ownerId],
  );

  function exportCsv() {
    if (!data) return;
    const head = ["کارمند", "بسته‌شده", "ثبت‌شده", "نتیجه‌دار", "نرخ نتیجه", "مستندسازی", "عقب‌افتاده", "کار سیستمی"];
    const lines = data.staff.map((s) => [
      s.name, s.done, s.created, s.withOutcome,
      s.created > 0 ? `${Math.round((s.withOutcome / s.created) * 100)}%` : "—",
      s.documented, s.overdue, s.system,
    ].join(","));
    // BOM لازم است وگرنه اکسل فارسی را خراب باز می‌کند
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `worklist-report-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      {/* ── نوار بازه ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              preset === p.key
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}

        {focused && (
          <button
            onClick={() => setOwnerId(null)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
          >
            فقط {focused} × بازگشت به کل تیم
          </button>
        )}

        <div className="flex-1" />

        {data?.canExport && (
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
          >
            خروجی CSV
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 text-red-600 text-xs font-bold">{error}</div>
      )}

      {loading && !data && (
        <div className="p-10 text-center text-xs text-gray-400">در حال بارگذاری…</div>
      )}

      {data && (
        <>
          {/* ── کارت‌های KPI ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="کار بسته‌شده" value={data.kpi.done} hint="در این بازه" />
            <Kpi
              label="نرخ ثبت نتیجه"
              value={`${fa(data.kpi.outcomeRate)}٪`}
              hint={`از ${fa(data.kpi.created)} کارِ ثبت‌شده`}
              tone={data.kpi.outcomeRate >= 80 ? "good" : data.kpi.outcomeRate >= 50 ? "warn" : "bad"}
            />
            <Kpi
              label="عقب‌افتاده"
              value={data.kpi.overdue}
              hint="همین حالا، نه در بازه"
              tone={data.kpi.overdue === 0 ? "good" : "bad"}
            />
            <Kpi label="کار سیستمی" value={data.kpi.system} hint="از دفتر فعالیت — جدا شمرده می‌شود" />
          </div>

          {/* ── سری زمانی ────────────────────────────────────────── */}
          <Card title="روند روزانه">
            <MultiLineChart
              id="worklist-trend"
              days={data.days.map(dayLabel)}
              series={[
                { key: "done", label: "بسته‌شده", color: "#10b981", data: data.series.done },
                { key: "created", label: "ثبت‌شده", color: "#6366f1", data: data.series.created },
              ]}
            />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="تفکیک دامنه">
              <DonutChart items={data.byDomain} />
            </Card>
            <Card title="پرکارترین نوع‌ها">
              <HBarChart items={data.byType} />
            </Card>
          </div>

          <Card
            title="نتیجه‌ی کارها"
            sub="سبز یعنی نتیجه‌ی موفقِ همان نوع کار. این همان چیزی است که نرخ تبدیل از رویش درمی‌آید."
          >
            <HBarChart items={data.byOutcome} />
          </Card>

          {data.system.length > 0 && (
            <Card
              title="کار خودکار"
              sub="این‌ها از خودِ نوشتن در پنل استخراج می‌شوند و کسی ثبتشان نکرده. عمداً با کار دستی جمع نمی‌شوند."
            >
              <HBarChart items={data.system.map((s) => ({ label: s.label, value: s.value }))} />
            </Card>
          )}

          {/* ── جدول کارکنان ─────────────────────────────────────── */}
          <Card title="کارکنان" sub="روی هر ردیف بزنید تا همین گزارش فقط برای او باز شود.">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100 dark:border-white/5">
                    <Th className="text-right">کارمند</Th>
                    <Th>بسته‌شده</Th>
                    <Th>ثبت‌شده</Th>
                    <Th>نرخ نتیجه</Th>
                    <Th>مستندسازی</Th>
                    <Th>عقب‌افتاده</Th>
                    <Th>کار سیستمی</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        در این بازه کاری ثبت نشده است
                      </td>
                    </tr>
                  )}
                  {data.staff.map((s) => {
                    const rate = s.created > 0 ? Math.round((s.withOutcome / s.created) * 100) : null;
                    return (
                      <tr
                        key={s.userId}
                        onClick={() => setOwnerId(ownerId === s.userId ? null : s.userId)}
                        className={`border-b border-gray-50 dark:border-white/5 cursor-pointer transition-colors ${
                          ownerId === s.userId
                            ? "bg-blue-500/5"
                            : "hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <td className="py-2.5 px-2 font-bold text-gray-800 dark:text-gray-100">{s.name}</td>
                        <Td>{fa(s.done)}</Td>
                        <Td>{fa(s.created)}</Td>
                        <Td>
                          {rate === null ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className={rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-500"}>
                              {fa(rate)}٪
                              <span className="text-gray-400 text-[10px] mr-1">
                                ({fa(s.withOutcome)}/{fa(s.created)})
                              </span>
                            </span>
                          )}
                        </Td>
                        <Td>{fa(s.documented)}</Td>
                        <Td>
                          <span className={s.overdue > 0 ? "text-red-500 font-bold" : "text-gray-400"}>
                            {fa(s.overdue)}
                          </span>
                        </Td>
                        <Td>{fa(s.system)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[11px] text-gray-400 leading-6">
            «بسته‌شده» بر اساس روزی است که کار بسته شده؛ «ثبت‌شده» بر اساس روزی که
            ثبت شده. «عقب‌افتاده» وضعیت همین حالاست، نه در بازه. «مستندسازی»
            تعداد کارهای متمایزی است که روی آن‌ها یادداشت یا ارجاع ثبت شده —
            ده یادداشت روی یک کار، یک واحد است.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({
  label, value, hint, tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "good" ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn" ? "text-amber-600 dark:text-amber-400"
        : tone === "bad" ? "text-red-500"
          : "text-gray-900 dark:text-white";
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
      <span className="block text-[11px] font-bold text-gray-500">{label}</span>
      <span className={`block mt-1 text-2xl font-black tabular-nums ${color}`}>
        {typeof value === "number" ? fa(value) : value}
      </span>
      {hint && <span className="block mt-0.5 text-[10px] text-gray-400">{hint}</span>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
      <h2 className="text-xs font-black text-gray-900 dark:text-white">{title}</h2>
      {sub && <p className="mt-0.5 mb-3 text-[10.5px] leading-5 text-gray-400">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2 px-2 font-bold ${className || "text-center"}`}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-2.5 px-2 text-center tabular-nums text-gray-600 dark:text-gray-300">{children}</td>;
}
