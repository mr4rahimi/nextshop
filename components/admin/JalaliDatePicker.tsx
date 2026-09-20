"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  JALALI_MONTH_OPTIONS,
  JALALI_WEEKDAYS,
  formatDateValue,
  fromJalali,
  jalaliMonthLength,
  jalaliMonthName,
  jalaliToday,
  jalaliWeekday,
  parseDateValue,
  toDateValue,
} from "@/lib/club/jalali";

/**
 * انتخابگر تاریخ شمسی — جایگزین <input type="date"> و <input type="datetime-local">
 *
 * مقدار ورودی/خروجی دقیقاً همان قالب اینپوت بومی است، پس هیچ تغییری در
 * API یا دیتابیس لازم نیست و فقط تقویمِ نمایش شمسی می‌شود:
 *   - mode="date"     →  "YYYY-MM-DD"
 *   - mode="datetime" →  "YYYY-MM-DDTHH:mm"  (ساعت به وقت تهران)
 *
 * عمداً بدون کتابخانه‌ی خارجی نوشته شده تا حجم باندل ادمین بالا نرود.
 */

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50";

export default function JalaliDatePicker({
  value,
  onChange,
  mode = "date",
  className,
  disabled,
  placeholder = "انتخاب تاریخ",
  title,
  clearable = true,
}: {
  value: string;
  onChange: (v: string) => void;
  mode?: "date" | "datetime";
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  clearable?: boolean;
}) {
  const withTime = mode === "datetime";
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseDateValue(value), [value]);
  const time = useMemo(() => {
    const m = /T(\d{2}):(\d{2})/.exec(value ?? "");
    return { hour: m ? Number(m[1]) : 0, minute: m ? Number(m[2]) : 0 };
  }, [value]);

  // ماهی که روی تقویم باز است — پیش‌فرض ماه مقدار فعلی، وگرنه ماه جاری
  const [view, setView] = useState(() => selected ?? jalaliToday());
  useEffect(() => {
    if (selected) setView({ ...selected });
  }, [selected?.year, selected?.month]); // eslint-disable-line react-hooks/exhaustive-deps

  // بستن با کلیک بیرون یا Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function emit(year: number, month: number, day: number, hour = time.hour, minute = time.minute) {
    const date = toDateValue(year, month, day);
    if (!date) return;
    onChange(
      withTime
        ? `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
        : date,
    );
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const total = v.year * 12 + (v.month - 1) + delta;
      return { year: Math.floor(total / 12), month: (total % 12) + 1, day: 1 };
    });
  }

  const today = jalaliToday();
  const monthLength = jalaliMonthLength(view.year, view.month);
  const firstDate = fromJalali(view.year, view.month, 1);
  const leading = firstDate ? jalaliWeekday(firstDate) : 0;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${className ?? inputClass} text-right flex items-center justify-between gap-2`}
      >
        <span className={value ? "" : "text-gray-400"} dir="ltr">
          {value ? formatDateValue(value, withTime) : placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="پاک کردن"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              className="text-gray-400 hover:text-red-500 text-base leading-none px-1"
            >
              ×
            </span>
          )}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-400 flex-shrink-0">
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[19rem] rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-2xl p-3 right-0">
          {/* سر تقویم: ماه و سال */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 font-black transition-all"
            >
              ›
            </button>

            <select
              value={view.month}
              onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-black text-gray-900 dark:text-white focus:outline-none"
            >
              {JALALI_MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.title}</option>
              ))}
            </select>

            <input
              type="number"
              dir="ltr"
              value={view.year}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (y >= 1200 && y <= 1600) setView((v) => ({ ...v, year: y }));
              }}
              className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-black text-center text-gray-900 dark:text-white focus:outline-none"
            />

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 font-black transition-all"
            >
              ‹
            </button>
          </div>

          {/* روزهای هفته */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {JALALI_WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[10px] font-black py-1 ${i === 6 ? "text-red-400" : "text-gray-400"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* روزهای ماه */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leading }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: monthLength }, (_, i) => i + 1).map((day) => {
              const isSelected =
                selected?.year === view.year && selected.month === view.month && selected.day === day;
              const isToday =
                today.year === view.year && today.month === view.month && today.day === day;
              const isFriday = (leading + day - 1) % 7 === 6;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    emit(view.year, view.month, day);
                    if (!withTime) setOpen(false);
                  }}
                  className={[
                    "h-8 rounded-lg text-xs font-bold transition-all",
                    isSelected
                      ? "bg-blue-600 text-white font-black"
                      : isToday
                        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 font-black"
                        : isFriday
                          ? "text-red-400 hover:bg-gray-100 dark:hover:bg-white/10"
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* ساعت — فقط حالت datetime */}
          {withTime && (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
              <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">ساعت</span>
              <select
                value={time.hour}
                onChange={(e) => {
                  const base = selected ?? today;
                  emit(base.year, base.month, base.day, Number(e.target.value), time.minute);
                }}
                className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-black text-gray-900 dark:text-white focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>
              <span className="text-gray-400 font-black">:</span>
              <select
                value={time.minute}
                onChange={(e) => {
                  const base = selected ?? today;
                  emit(base.year, base.month, base.day, time.hour, Number(e.target.value));
                }}
                className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-black text-gray-900 dark:text-white focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          )}

          {/* اقدام‌های سریع */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setView({ ...today });
                emit(today.year, today.month, today.day);
                if (!withTime) setOpen(false);
              }}
              className="text-[11px] font-black text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
            >
              امروز
            </button>
            <span className="text-[10px] font-bold text-gray-400">
              {jalaliMonthName(view.month)} {view.year}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-black text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
