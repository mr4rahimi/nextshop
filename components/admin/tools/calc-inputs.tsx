"use client";

/**
 * ورودی‌ها و کاشی عدد مشترک ماشین‌حساب‌های ابزارها (قیمت و سود، سربه‌سر، ROI، قیف، تخفیف) —
 * ورودی‌ها ارقام فارسی و جداکننده‌ی هزارگان را می‌پذیرند. docs/features/tools.md بخش ۸ و ۱۰ تا ۱۳
 */

import { useEffect, useState } from "react";
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

/** عدد اعشاری با پسوند (٪، روز، …) */
export function DecimalInput({ value, onChange, max = Infinity, suffix }: { value: number; onChange: (n: number) => void; max?: number; suffix?: string }) {
  // متن جدا از عدد نگه داشته می‌شود تا «۱۲.» وسط تایپ پاک نشود؛ تغییر بیرونی با `key` تازه می‌آید
  const [text, setText] = useState(String(value));
  return (
    <div className="relative">
      <input
        className={`${inputCls} ${suffix ? (suffix.length > 1 ? "pl-10" : "pl-7") : ""} tabular-nums`}
        dir="ltr"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(Math.min(max, parseNum(e.target.value)));
        }}
      />
      {suffix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
    </div>
  );
}

export function PctInput({ value, onChange, max = 100 }: { value: number; onChange: (n: number) => void; max?: number }) {
  return <DecimalInput value={value} onChange={onChange} max={max} suffix="٪" />;
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

/** تنظیمات هر ابزار در مرورگر؛ تا خواندن نشده `loaded` خاموش است */
export function useStored<T extends object>(storeKey: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage فقط بعد از mount در دسترس است
      if (raw) setValue((v) => ({ ...v, ...(JSON.parse(raw) as Partial<T>) }));
    } catch {}
    setLoaded(true);
  }, [storeKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(value));
    } catch {}
  }, [storeKey, value, loaded]);

  return [value, setValue, loaded] as const;
}
