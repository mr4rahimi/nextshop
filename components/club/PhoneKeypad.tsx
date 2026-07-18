"use client";

import { useEffect, useCallback } from "react";

/**
 * شماره‌گیر لمسی برای ورود شماره موبایل
 *
 * طراحی حول یک ایده: نمایش ۱۱ خانه‌ای که با یک نگاه معلوم می‌کند چند رقم
 * باقی مانده — بدون اینکه لازم باشد کسی شماره را بخواند.
 *
 * - گروه‌بندی ۴-۳-۴ مطابق عادت خواندن شماره در ایران
 * - کیبورد فیزیکی هم کار می‌کند (دسکتاپ)
 * - لمس طولانی روی ⌫ کل شماره را پاک می‌کند
 * - بازخورد لرزشی روی موبایل
 */

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

const GROUPS = [4, 3, 4]; // 0912 345 6789
const MAX = 11;

export default function PhoneKeypad({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: Props) {
  const buzz = useCallback((ms = 8) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(ms);
    }
  }, []);

  const press = useCallback(
    (digit: string) => {
      if (disabled || value.length >= MAX) return;
      buzz();
      onChange(value + digit);
    },
    [disabled, value, onChange, buzz]
  );

  const backspace = useCallback(() => {
    if (disabled || value.length === 0) return;
    buzz();
    onChange(value.slice(0, -1));
  }, [disabled, value, onChange, buzz]);

  const clearAll = useCallback(() => {
    if (disabled || value.length === 0) return;
    buzz(18);
    onChange("");
  }, [disabled, value, onChange, buzz]);

  // ── پشتیبانی از کیبورد فیزیکی ──────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled) return;

      // ارقام فارسی و عربی هم پذیرفته می‌شوند
      const fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(e.key);
      const ar = "٠١٢٣٤٥٦٧٨٩".indexOf(e.key);
      const digit =
        /^[0-9]$/.test(e.key) ? e.key
        : fa > -1 ? String(fa)
        : ar > -1 ? String(ar)
        : null;

      if (digit !== null) {
        e.preventDefault();
        press(digit);
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        e.metaKey || e.ctrlKey ? clearAll() : backspace();
        return;
      }

      if (e.key === "Enter" && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, press, backspace, clearAll, onSubmit]);

  // ── نمایش ۱۱ خانه‌ای ───────────────────────────────────────────
  let index = 0;
  const groups = GROUPS.map((len) => {
    const slots = Array.from({ length: len }, () => value[index++] ?? null);
    return slots;
  });

  const complete = value.length === MAX;
  const startsRight = value.length < 2 || value.startsWith("09");

  return (
    <div className="space-y-6">
      {/* صفحه نمایش */}
      <div
        dir="ltr"
        className="flex items-center justify-center gap-2.5 select-none"
        aria-label="شماره وارد شده"
      >
        {groups.map((slots, gi) => (
          <div key={gi} className="flex gap-1">
            {slots.map((digit, si) => {
              const isCursor =
                digit === null &&
                GROUPS.slice(0, gi).reduce((a, b) => a + b, 0) + si === value.length;

              return (
                <span
                  key={si}
                  className={`w-[26px] sm:w-8 h-11 sm:h-12 rounded-lg flex items-center justify-center text-xl sm:text-2xl font-black tabular-nums transition-all duration-150 ${
                    digit !== null
                      ? complete
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : !startsRight
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-white"
                      : isCursor
                        ? "bg-primary-500/10 ring-2 ring-primary-500/40"
                        : "bg-gray-50 dark:bg-white/[0.02]"
                  }`}
                >
                  {digit ?? (
                    <span
                      className={`w-2 h-0.5 rounded-full ${
                        isCursor ? "bg-primary-500 animate-pulse" : "bg-gray-200 dark:bg-white/10"
                      }`}
                    />
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* راهنما — فقط وقتی لازم است */}
      <p
        className={`text-center text-[11px] font-bold h-4 transition-all ${
          !startsRight
            ? "text-amber-600 dark:text-amber-400"
            : "text-transparent"
        }`}
      >
        {!startsRight ? "شماره موبایل باید با ۰۹ شروع شود" : "‌"}
      </p>

      {/* شماره‌گیر */}
      <div dir="ltr" className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled || complete}>
            {toFa(d)}
          </Key>
        ))}

        <Key
          onClick={clearAll}
          disabled={disabled || value.length === 0}
          variant="muted"
          label="پاک کردن همه"
        >
          <span className="text-[13px] font-black">پاک</span>
        </Key>

        <Key onClick={() => press("0")} disabled={disabled || complete}>
          {toFa("0")}
        </Key>

        <Key
          onClick={backspace}
          disabled={disabled || value.length === 0}
          variant="muted"
          label="حذف آخرین رقم"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414A2 2 0 0110.828 5H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z"
            />
          </svg>
        </Key>
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  disabled,
  variant = "default",
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "muted";
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`h-[58px] sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all duration-100 active:scale-95 disabled:opacity-25 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        variant === "muted"
          ? "bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.08] active:bg-gray-300 dark:active:bg-white/[0.12]"
          : "bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white border border-gray-200 dark:border-white/[0.06] shadow-sm hover:border-primary-500/40 active:bg-primary-50 dark:active:bg-primary-500/10"
      }`}
    >
      {children}
    </button>
  );
}

function toFa(d: string): string {
  return "۰۱۲۳۴۵۶۷۸۹"[Number(d)];
}