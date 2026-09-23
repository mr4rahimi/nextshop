"use client";

/**
 * ویرایشگر موعدهای پرداخت اعتباری — در فرم سفارش تلفنی و پرونده‌ی سفارش.
 *
 * دو ساخت سریع: «یک‌جا در تاریخ …» و «قسطی: هر هفته / هر ماه، n قسط، از
 * تاریخ …» که ردیف‌ها را با مبلغ برابر می‌سازد (باقی‌مانده روی قسط آخر). بعد
 * هر ردیف قابل ویرایش است.
 *
 * ⚠️ **جمع موعدها باید دقیقاً مبلغ سفارش باشد** — همین‌جا با رنگ نشان داده
 * می‌شود و سرور (`validateInstallments`) هم تا نخواند ذخیره نمی‌کند.
 *
 * مقدار تاریخ‌ها قرارداد `JalaliDatePicker` است: «YYYY-MM-DD» میلادی.
 * مستندات: docs/features/staff-worklist.md بخش ۲۴
 */

import { useState } from "react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { jalaliMonthLength, parseDateValue, toDateValue } from "@/lib/club/jalali";

export interface InstallmentRow {
  dueDate: string;
  amount: string;
}

const fa = (n: number) => n.toLocaleString("fa-IR");
const digits = (v: string) => v.replace(/[^\d]/g, "");

/** «YYYY-MM-DD» + n روز */
function addDays(value: string, n: number): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** «YYYY-MM-DD» + n ماه **شمسی** — ۳۱ شهریور + ۱ ماه = ۳۰ مهر، نه ۱ آبان */
function addJalaliMonths(value: string, n: number): string {
  const p = parseDateValue(value);
  if (!p) return value;
  const total = p.year * 12 + (p.month - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return toDateValue(year, month, Math.min(p.day, jalaliMonthLength(year, month)));
}

function todayValue(offsetDays = 0): string {
  // روز تهران، نه UTC — ساعت ۲ بامداد تهران هنوز «دیروزِ» UTC است
  const now = new Date(Date.now() + 3.5 * 3_600_000);
  return addDays(now.toISOString().slice(0, 10), offsetDays);
}

export function installmentsSum(rows: InstallmentRow[]): number {
  return rows.reduce((s, r) => s + Number(digits(r.amount) || 0), 0);
}

export default function InstallmentsEditor({
  total,
  rows,
  onChange,
}: {
  /** مبلغ نهایی سفارش — تومان */
  total: number;
  rows: InstallmentRow[];
  onChange: (rows: InstallmentRow[]) => void;
}) {
  const [mode, setMode] = useState<"once" | "split">("once");
  const [start, setStart] = useState(todayValue(7));
  const [count, setCount] = useState(4);
  const [every, setEvery] = useState<"week" | "month">("month");

  function build() {
    if (total <= 0 || !start) return;
    if (mode === "once") {
      onChange([{ dueDate: start, amount: String(total) }]);
      return;
    }
    const n = Math.max(2, Math.min(60, count));
    const base = Math.floor(total / n);
    const out: InstallmentRow[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        dueDate: every === "week" ? addDays(start, i * 7) : addJalaliMonths(start, i),
        // باقی‌مانده‌ی تقسیم روی قسط آخر، تا جمع دقیقاً بخواند
        amount: String(i === n - 1 ? total - base * (n - 1) : base),
      });
    }
    onChange(out);
  }

  const sum = installmentsSum(rows);
  const diff = sum - total;
  const inputCls =
    "px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
          {([["once", "یک‌جا"], ["split", "قسطی"]] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`px-3 py-2 text-xs font-bold ${
                mode === k ? "bg-blue-500 text-white" : "bg-white dark:bg-transparent text-gray-600 dark:text-gray-400"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {mode === "split" && (
          <>
            <label className="text-[10px] text-gray-500">
              تعداد قسط
              <input
                type="number"
                min={2}
                max={60}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 2)}
                className={`${inputCls} block w-20 mt-1`}
              />
            </label>
            <label className="text-[10px] text-gray-500">
              فاصله
              <select value={every} onChange={(e) => setEvery(e.target.value as "week" | "month")} className={`${inputCls} block mt-1`}>
                <option value="week">هر هفته</option>
                <option value="month">هر ماه</option>
              </select>
            </label>
          </>
        )}
        <label className="text-[10px] text-gray-500 min-w-[150px]">
          {mode === "once" ? "تاریخ پرداخت" : "اولین قسط"}
          <div className="mt-1">
            <JalaliDatePicker value={start} onChange={setStart} clearable={false} className={inputCls} />
          </div>
        </label>
        <button
          type="button"
          onClick={build}
          disabled={total <= 0}
          className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold disabled:opacity-40"
        >
          ساخت موعدها
        </button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-gray-500 shrink-0">قسط {fa(i + 1)}</span>
              <div className="flex-1 min-w-0">
                <JalaliDatePicker
                  value={r.dueDate}
                  onChange={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, dueDate: v } : x)))}
                  clearable={false}
                  className={inputCls}
                />
              </div>
              <input
                value={r.amount ? Number(digits(r.amount)).toLocaleString("fa-IR") : ""}
                onChange={(e) =>
                  onChange(rows.map((x, j) => (j === i ? { ...x, amount: digits(toLatin(e.target.value)) } : x)))
                }
                inputMode="numeric"
                placeholder="مبلغ"
                className={`${inputCls} w-32`}
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 text-xs"
                aria-label="حذف موعد"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange([
                ...rows,
                { dueDate: rows.length ? addDays(rows[rows.length - 1].dueDate, 7) : start, amount: diff < 0 ? String(-diff) : "" },
              ])
            }
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400"
          >
            + موعد دیگر
          </button>
        </div>
      )}

      <p
        className={`text-[11px] font-bold ${
          rows.length === 0 ? "text-gray-400" : diff === 0 ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {rows.length === 0
          ? "هنوز موعدی ساخته نشده."
          : diff === 0
            ? `جمع موعدها با مبلغ سفارش (${fa(total)} تومان) می‌خواند.`
            : `جمع موعدها ${fa(sum)} تومان است؛ ${fa(Math.abs(diff))} تومان ${diff > 0 ? "بیشتر" : "کمتر"} از مبلغ سفارش.`}
      </p>
    </div>
  );
}

/** ارقام فارسی و عربی ← لاتین، تا ورودیِ کیبورد فارسی گم نشود */
function toLatin(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
