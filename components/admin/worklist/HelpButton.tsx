"use client";

/**
 * راهنمای هر بخش — آیکن علامت سؤال که با کلیک باز می‌شود.
 *
 * چرا لازم است: کارتابل مفهوم‌های تازه‌ای می‌آورد (نتیجه در برابر وضعیت،
 * ارجاع، مهلت خودکار) که تا وقتی کارکنان عادت نکرده‌اند باید کنار دستشان
 * توضیح داده شود، نه در یک صفحه‌ی راهنمای جدا که کسی بازش نمی‌کند.
 *
 * متن‌ها در `help-content.ts` جمع‌اند تا ویرایششان یک‌جا باشد.
 */

import { useEffect, useState } from "react";
import { HELP, type HelpKey } from "./help-content";

interface Props {
  topic: HelpKey;
  /** کنار عنوان صفحه بزرگ‌تر، داخل فرم کوچک‌تر */
  size?: "sm" | "md";
  className?: string;
}

export default function HelpButton({ topic, size = "md", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const help = HELP[topic];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!help) return null;

  const box = size === "sm" ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-[11px]";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`راهنمای ${help.title}`}
        title={`راهنمای ${help.title}`}
        className={`${box} shrink-0 rounded-full border border-gray-300 dark:border-white/20 text-gray-500 dark:text-gray-400 font-bold flex items-center justify-center hover:bg-blue-500 hover:text-white hover:border-blue-500 transition ${className}`}
      >
        ؟
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                راهنما — {help.title}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                aria-label="بستن"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {help.intro && (
                <p className="text-xs leading-6 text-gray-700 dark:text-gray-300">
                  {help.intro}
                </p>
              )}

              {help.sections.map((s, i) => (
                <div key={i}>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-1.5">
                    {s.heading}
                  </h3>
                  <ul className="space-y-1.5">
                    {s.items.map((item, j) => (
                      <li
                        key={j}
                        className="text-xs leading-6 text-gray-600 dark:text-gray-400 flex gap-2"
                      >
                        <span className="text-blue-500 shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {help.tip && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2.5">
                  <p className="text-xs leading-6 text-amber-800 dark:text-amber-300">
                    <span className="font-bold">نکته: </span>
                    {help.tip}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-white/10">
              <button
                onClick={() => setOpen(false)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-bold transition"
              >
                فهمیدم
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
