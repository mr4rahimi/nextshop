"use client";

/**
 * اجزای مشترک گزارش‌های مالی — docs/plans/accounting.md بخش ۱۱ و ۱۳.
 *
 * - `ReportFrame`: عنوان + راهنما + فیلترها + «خروجی اکسل» و «چاپ / PDF».
 *   چاپ فقط `.acc-report` را نشان می‌دهد (قاب پنل پنهان می‌شود)؛ PDF همان
 *   «ذخیره به PDF» مرورگر است.
 * - خروجی اکسل CSV با BOM است (اکسل فارسی را بدون BOM به‌هم‌ریخته باز می‌کند)
 *   و مبلغ‌ها عدد خام‌اند تا در اکسل جمع زده شوند.
 * - رنگ سری‌های نمودار از پالت اعتبارسنجی‌شده (آبی، فیروزه‌ای، نارنجی — بدون
 *   جفت سبز/قرمز که برای کوررنگی قرمز-سبز یکی دیده می‌شود)؛ حالت تاریک پله‌ی خودش را دارد.
 */

import { useEffect, useState, type ReactNode } from "react";
import { formatAmount } from "@/lib/accounting/money";
import type { HelpKey } from "@/components/admin/worklist/help-content";
import { api, btn, ErrorText, PageHeader } from "../ui";

export type Cell = string | number | bigint | null | undefined;

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** دریافت یک گزارش؛ هر تغییر پارامتر دوباره می‌خواند. «در حال بارگذاری» = پاسخ آخرین پارامترها هنوز نرسیده */
export function useReport<T>(kind: string, params: Record<string, string | null | undefined>) {
  const [state, setState] = useState<{ qs: string | null; data: T | null; error: string | null }>({ qs: null, data: null, error: null });
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  useEffect(() => {
    let alive = true;
    api<{ data: T }>(`/api/admin/accounting/reports/${kind}?${qs}`)
      .then((d) => alive && setState({ qs, data: d.data, error: null }))
      .catch((e: Error) => alive && setState((x) => ({ ...x, qs, error: e.message })));
    return () => {
      alive = false;
    };
  }, [kind, qs]);
  return { data: state.data, error: state.error, loading: state.qs !== qs };
}

export function ReportFrame({
  title,
  help,
  desc,
  printSub,
  filters,
  onExport,
  error,
  loading,
  children,
}: {
  title: string;
  help: HelpKey;
  desc?: ReactNode;
  /** زیرعنوان نسخه‌ی چاپی — بازه یا تاریخ */
  printSub?: string;
  filters?: ReactNode;
  onExport?: () => void;
  error?: string | null;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .acc-report, .acc-report * { visibility: visible !important; }
        .acc-report { position: absolute; inset: 0; padding: 12mm; color: #000 !important; background: #fff !important; }
        .acc-report * { color: #000 !important; background: transparent !important; border-color: #ccc !important; box-shadow: none !important; }
        .acc-noprint { display: none !important; }
      }`}</style>
      <div className="acc-noprint">
        <PageHeader
          title={title}
          help={help}
          desc={desc}
          back={{ href: "/admin/accounting/reports", label: "گزارش‌ها" }}
          actions={
            <>
              {onExport && (
                <button onClick={onExport} className={btn.soft} disabled={loading}>
                  ⬇ خروجی اکسل
                </button>
              )}
              <button onClick={() => window.print()} className={btn.soft}>
                🖨 چاپ / PDF
              </button>
            </>
          }
        />
        {filters && <div className="space-y-2">{filters}</div>}
      </div>
      <ErrorText>{error}</ErrorText>
      <div className={`acc-report space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="hidden print:block mb-4">
          <h1 className="text-lg font-black">{title}</h1>
          {printSub && <p className="text-xs">{printSub}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** مبلغ جدول — منفی داخل پرانتز و قرمز، صفر کم‌رنگ */
export function Amt({ v, strong, muted }: { v: string | bigint | null | undefined; strong?: boolean; muted?: boolean }) {
  if (v === null || v === undefined) return <span className="text-gray-300">—</span>;
  const b = BigInt(v);
  if (b === 0n) return <span className="text-gray-300 dark:text-gray-600">۰</span>;
  const cls = `tabular-nums whitespace-nowrap ${strong ? "font-black" : ""} ${b < 0n ? "text-red-600 dark:text-red-400" : muted ? "text-gray-500" : ""}`;
  return <span className={cls}>{b < 0n ? `(${formatAmount(-b)})` : formatAmount(b)}</span>;
}

/** تغییر نسبت به دوره‌ی قبل */
export function Change({ cur, prev, goodWhenUp = true }: { cur: string | bigint; prev: string | bigint | null; goodWhenUp?: boolean }) {
  if (prev === null) return null;
  const c = BigInt(cur);
  const p = BigInt(prev);
  if (p === 0n) return <span className="text-[11px] text-gray-400">—</span>;
  const pct = Number(((c - p) * 1000n) / (p < 0n ? -p : p)) / 10;
  const good = pct === 0 ? null : (pct > 0) === goodWhenUp;
  return (
    <span className={`text-[11px] font-bold tabular-nums ${good === null ? "text-gray-400" : good ? "text-emerald-600" : "text-red-600"}`}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct).toLocaleString("fa-IR")}٪
    </span>
  );
}

/** جدول گزارش — دسکتاپ جدول کامل؛ موبایل اسکرول افقی */
export function Table({ head, children, foot }: { head: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">{head}</thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">{children}</tbody>
        {foot && <tfoot className="border-t-2 border-gray-200 dark:border-white/10 font-black">{foot}</tfoot>}
      </table>
    </div>
  );
}

export const th = "px-3 py-2.5 text-right font-bold whitespace-nowrap";
export const thNum = "px-3 py-2.5 text-left font-bold whitespace-nowrap";
export const td = "px-3 py-2";
export const tdNum = "px-3 py-2 text-left";

/** تم فعلی پنل (کلاس `dark` روی `<html>`) — رنگ سری‌های نمودار پله‌ی خودش را دارد */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** پالت سری‌ها — اعتبارسنجی‌شده برای هر دو حالت (dataviz: `validate_palette.js --pairs all`) */
export const SERIES = {
  light: { sales: "#2a78d6", gross: "#1baf7a", expenses: "#eb6834" },
  dark: { sales: "#3987e5", gross: "#199e70", expenses: "#d95926" },
};
