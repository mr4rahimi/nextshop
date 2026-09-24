"use client";

/**
 * فیلد مبلغ — docs/plans/accounting.md بخش ۱۳.۲ اصل ۲.
 *
 * - هنگام تایپ جداکننده‌ی هزارگان و ارقام فارسی
 * - زیر فیلد «به حروف» — رایج‌ترین جلوگیری از صفر اضافه
 * - میانبر: «۲۵۰k» یا «۲۵۰ه» = ۲۵۰ هزار، «۲.۵m» یا «۲.۵م» = ۲٫۵ میلیون
 * - کیبورد عددی در موبایل
 *
 * مقدار: رشته‌ی رقمی لاتین (مثل API)؛ خالی = «".
 */

import { useState } from "react";
import { amountToWords, formatAmount, parseAmountInput, toLatinDigits } from "@/lib/accounting/money";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** بدون «به حروف» — برای ستون‌های جدول */
  compact?: boolean;
  disabled?: boolean;
  id?: string;
}

const fmt = (v: string) => (v ? formatAmount(v) : "");

export default function AmountInput({ value, onChange, placeholder = "۰", className = "", autoFocus, compact, disabled, id }: Props) {
  // هنگام تایپ متن خام نگه داشته می‌شود؛ بیرون از فوکوس همیشه از مقدار ساخته می‌شود
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const display = focused ? text : fmt(value);

  function handle(raw: string) {
    const lat = toLatinDigits(raw).replace(/[,٬\s]/g, "");
    // اعشارِ منتظر میانبر («۲.۵» تا m یا k بیاید) خام می‌ماند
    const pending = /[.٫]\d*$/.test(lat);
    const v = parseAmountInput(lat);
    onChange(v);
    setText(pending ? raw : fmt(v));
  }

  const words = value && value !== "0" && !compact ? amountToWords(value) : "";

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          value={display}
          onChange={(e) => handle(e.target.value)}
          onFocus={(e) => {
            setText(fmt(value));
            setFocused(true);
            const el = e.target;
            requestAnimationFrame(() => el.select());
          }}
          onBlur={() => setFocused(false)}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          dir="ltr"
          className={`w-full ${compact ? "px-2 py-2 text-sm" : "px-3 py-2.5 text-base"} pl-12 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-bold tabular-nums text-left text-gray-900 dark:text-white outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-white/10 transition placeholder:text-gray-300 disabled:opacity-60`}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">تومان</span>
      </div>
      {!compact && (
        <p className="text-[11px] text-gray-500 mt-1 min-h-[1rem] leading-5">
          {words ? `${words} تومان` : <span className="text-gray-300">میانبر: ۲۵۰k = ۲۵۰ هزار، ۲.۵m = ۲٫۵ میلیون</span>}
        </p>
      )}
    </div>
  );
}
