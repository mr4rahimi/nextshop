"use client";

/**
 * ورودی‌ها و کاشی عدد مشترک ماشین‌حساب‌های ابزارها (قیمت و سود، سربه‌سر، ROI، قیف، تخفیف) —
 * ورودی‌ها ارقام فارسی و جداکننده‌ی هزارگان را می‌پذیرند. docs/features/tools.md بخش ۸ و ۱۰ تا ۱۳
 */

import { useState } from "react";
import { inputCls } from "../accounting/ui";

export const fa = (n: number, digits = 0) => n.toLocaleString("fa-IR", { maximumFractionDigits: digits });
export const toman = (n: number) => `${fa(Math.round(n))} تومان`;

export function parseNum(v: string): number {
  const en = v.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٫.]/g, ".").replace(/[^\d.]/g, "");
  const n = Number(en);
  return Number.isFinite(n) ? n : 0;
}

/** ورودی مبلغ با جداکننده‌ی هزارگان؛ ارقام فارسی هم پذیرفته می‌شود */
export function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  return (
    <input
      className={`${inputCls} tabular-nums`}
      dir="ltr"
      inputMode="numeric"
      placeholder={placeholder ?? "0"}
      value={value ? Math.round(value).toLocaleString("en-US") : ""}
      onChange={(e) => onChange(Math.round(parseNum(e.target.value)))}
    />
  );
}

export function PctInput({ value, onChange, max = 100 }: { value: number; onChange: (n: number) => void; max?: number }) {
  // متن جدا از عدد نگه داشته می‌شود تا «۱۲.» وسط تایپ پاک نشود؛ تغییر بیرونی با `key` تازه می‌آید
  const [text, setText] = useState(String(value));
  return (
    <div className="relative">
      <input
        className={`${inputCls} pl-7 tabular-nums`}
        dir="ltr"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(Math.min(max, parseNum(e.target.value)));
        }}
      />
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">٪</span>
    </div>
  );
}

/** کاشی کوچک عدد زیر نتیجه‌ی ماشین‌حساب‌ها؛ `hint` با نگه داشتن نشانگر دیده می‌شود */
export function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-2.5 dark:bg-white/5" title={hint}>
      <dt className="text-[10px] font-bold text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-black tabular-nums">{value}</dd>
    </div>
  );
}
