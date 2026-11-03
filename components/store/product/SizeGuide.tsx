"use client";

/**
 * دکمه و پنجره‌ی «راهنمای سایز» صفحه‌ی محصول — docs/features/size-guide.md.
 * طرح لباس + جدول + «چطور اندازه بگیرم». سایزِ انتخاب‌شده در تنوع پررنگ است.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SizeGuideDiagram from "./SizeGuideDiagram";
import { FIT_LABEL, SIZING_LABEL, faNum, kindColumn, type SizeChart } from "@/lib/size-guide";

const norm = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\s|‌/g, "").toLowerCase();

export default function SizeGuide({ chart, selected = [] }: { chart: SizeChart; selected?: string[] }) {
  const [open, setOpen] = useState(false);
  const [col, setCol] = useState<string | null>(null);
  const [row, setRow] = useState<string | null>(null);
  const picked = row ?? chart.rows.find((r) => selected.some((s) => norm(s) === norm(r.size)))?.size ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const letter = (key: string) => kindColumn(chart.kind, key)?.letter;
  const hows = chart.columns.map((c) => ({ ...c, letter: letter(c.key), how: kindColumn(chart.kind, c.key)?.how })).filter((c) => c.how);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-black text-primary-600 dark:text-primary-400 hover:underline underline-offset-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 8.5h18v7H3zM7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4" />
        </svg>
        راهنمای سایز
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} dir="rtl">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="راهنمای سایز"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0f1117] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-black text-gray-900 dark:text-white">راهنمای سایز</p>
                <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 text-lg" aria-label="بستن">
                  ×
                </button>
              </div>

              {(chart.fit || chart.sizing) && (
                <div className="flex flex-wrap gap-2">
                  {chart.fit && <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[11px] font-bold text-gray-700 dark:text-gray-300">فرم: {FIT_LABEL[chart.fit]}</span>}
                  {chart.sizing && (
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${chart.sizing === "true" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}>
                      {SIZING_LABEL[chart.sizing]}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                {chart.kind !== "custom" && (
                  <SizeGuideDiagram kind={chart.kind} keys={chart.columns.map((c) => c.key)} active={col} className="w-44 sm:w-52 shrink-0" />
                )}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-center text-[12px] border-separate border-spacing-0">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-400">
                        <th className="py-2 px-2 font-black sticky right-0 bg-white dark:bg-[#0f1117]">سایز</th>
                        {chart.columns.map((c) => (
                          <th
                            key={c.key}
                            onMouseEnter={() => setCol(c.key)}
                            onMouseLeave={() => setCol(null)}
                            onClick={() => setCol((x) => (x === c.key ? null : c.key))}
                            className={`py-2 px-2 font-bold whitespace-nowrap cursor-default ${col === c.key ? "text-primary-600 dark:text-primary-400" : ""}`}
                          >
                            {letter(c.key) && (
                              <span className="inline-flex w-4 h-4 me-1 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black align-middle" dir="ltr">
                                {letter(c.key)}
                              </span>
                            )}
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chart.rows.map((r) => {
                        const on = r.size === picked;
                        return (
                          <tr key={r.size} onClick={() => setRow(r.size)} className={`cursor-pointer ${on ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}>
                            <td className={`py-2.5 px-2 font-black border-t border-gray-100 dark:border-white/5 sticky right-0 ${on ? "bg-primary-50 dark:bg-[#141a2a] text-primary-700 dark:text-primary-300" : "bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white"}`} dir="ltr">
                              {r.size}
                            </td>
                            {chart.columns.map((c) => (
                              <td key={c.key} className={`py-2.5 px-2 tabular-nums border-t border-gray-100 dark:border-white/5 ${col === c.key ? "text-primary-600 dark:text-primary-400 font-black" : "text-gray-700 dark:text-gray-300"}`}>
                                {r.values[c.key] != null ? faNum(r.values[c.key]!) : "—"}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-gray-400 mt-2 leading-5">اندازه‌ها به سانتی‌متر و روی لباس پهن‌شده است؛ ۱ تا ۲ سانت اختلاف طبیعی است.</p>
                </div>
              </div>

              {chart.note && <p className="text-[12px] leading-6 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2">{chart.note}</p>}

              <div className="rounded-2xl border border-gray-100 dark:border-white/10 p-4 space-y-2">
                <p className="text-[13px] font-black text-gray-900 dark:text-white">سایز مناسب را چطور پیدا کنم؟</p>
                <p className="text-[12px] leading-6 text-gray-600 dark:text-gray-400">
                  یکی از لباس‌های خودتان را که اندازه‌تان است روی زمین صاف پهن کنید، با متر اندازه بگیرید و با جدول مقایسه کنید. نزدیک‌ترین ردیف سایز شماست.
                </p>
                {hows.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {hows.map((h) => (
                      <li key={h.key} className="flex gap-2 text-[12px] leading-6 text-gray-600 dark:text-gray-400">
                        {h.letter ? (
                          <span className="mt-1 inline-flex w-4 h-4 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black" dir="ltr">
                            {h.letter}
                          </span>
                        ) : (
                          <span className="mt-2.5 w-1.5 h-1.5 shrink-0 rounded-full bg-gray-300" />
                        )}
                        <span>
                          <b className="text-gray-800 dark:text-gray-200">{h.label}:</b> {h.how}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
