"use client";

/**
 * برچسب بارکد — چهره‌ی هر برچسب، چیدمان صفحه‌های چاپ و فرم تنظیم.
 * مشترک صفحه‌ی چاپ (`LabelsPrint`) و «کدگذاری و برچسب» (`CodingClient`).
 * تنظیم: `lib/accounting/inventory/label-config.ts`.
 */

import { useState } from "react";
import { canEncode, code128Bars } from "@/lib/barcode/code128";
import { faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";
import { LABEL_PRESETS, normalizeLabelConfig, pageHeightOf, pageWidthOf, perPageOf, slotOf, type LabelConfig } from "@/lib/accounting/inventory/label-config";

export interface LabelData {
  key: string;
  title: string;
  barcode: string;
  price: string | null;
}

/** نمونه‌ی پیش‌نمایش و چاپ آزمایشی */
export const SAMPLE_LABELS: LabelData[] = [
  { key: "a", title: "پیراهن اسپرت کرال مشکی L", barcode: "11002304", price: "1570000" },
  { key: "b", title: "پیراهن اسپرت کرال سفید XL", barcode: "11002305", price: "1570000" },
];

/** نشانی چاپ آزمایشی با تنظیم فعلی (ذخیره‌نشده هم) — دو ردیف کامل */
export const testPrintUrl = (c: LabelConfig) => `/admin/accounting/inventory/labels/print?test=1&cfg=${encodeURIComponent(JSON.stringify(c))}`;

function Barcode({ value, height }: { value: string; height: number }) {
  if (!canEncode(value)) return <p className="text-[8px] text-red-600">کد «{value}» حرف غیرلاتین دارد — یک بارکد لاتین برای کالا بنویسید</p>;
  const { bars, width } = code128Bars(value);
  return (
    <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ width: "100%", height: `${height}mm`, display: "block" }} aria-label={value}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="#000" />
      ))}
    </svg>
  );
}

function priceText(price: string | null, c: LabelConfig) {
  if (!price) return null;
  let v: bigint;
  try {
    v = BigInt(price);
  } catch {
    return null;
  }
  if (v <= 0n) return null;
  return c.priceUnit === "rial" ? `${formatAmount(v * 10n)} ریال` : `${formatAmount(v)} تومان`;
}

export function LabelFace({ l, c }: { l: LabelData; c: LabelConfig }) {
  const price = c.showPrice ? priceText(l.price, c) : null;
  return (
    <div
      className="lbl overflow-hidden flex flex-col justify-between text-black bg-white"
      style={{ width: `${c.w}mm`, height: `${c.h}mm`, padding: "1.2mm 2mm", boxSizing: "border-box" }}
    >
      {(c.showTitle || c.header) && (
        <div className="flex items-start justify-between gap-1" style={{ fontSize: `${c.titleSize}pt`, lineHeight: 1.2 }}>
          {c.showTitle && <b className="line-clamp-2 min-w-0">{l.title}</b>}
          {c.header && <b className="shrink-0 whitespace-nowrap">{c.header}</b>}
        </div>
      )}
      {price && (
        <b className="text-center" style={{ fontSize: `${Math.max(6, c.titleSize)}pt`, lineHeight: 1.1 }} dir="rtl">
          {price}
        </b>
      )}
      <Barcode value={l.barcode} height={(c.h * c.barcodePct) / 100} />
      {c.showCode && (
        <span dir="ltr" className="block text-center font-mono" style={{ fontSize: "7pt", letterSpacing: "0.12em", lineHeight: 1 }}>
          {l.barcode}
        </span>
      )}
    </div>
  );
}

/** صفحه‌های چاپ + `@page` همان اندازه — در صفحه‌ی چاپ؛ پیش‌نمایش با `preview` */
export function LabelPages({ labels, c, preview = false }: { labels: LabelData[]; c: LabelConfig; preview?: boolean }) {
  const per = perPageOf(c);
  const pages: LabelData[][] = [];
  for (let i = 0; i < labels.length; i += per) pages.push(labels.slice(i, i + per));
  const pw = pageWidthOf(c);
  const ph = pageHeightOf(c);
  const slot = slotOf(c);
  const pageCss = preview
    ? ""
    : `@page { size: ${c.media === "a4" ? "A4" : `${pw}mm ${ph}mm`}; margin: 0; }
       @media print { .lbl-page { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; } .lbl-pages { gap: 0 !important; padding: 0 !important; } }`;
  return (
    <>
      {pageCss && <style>{pageCss}</style>}
      <div className="lbl-pages flex flex-col items-center gap-3 p-4 print:p-0">
        {pages.map((p, i) => (
          <div
            key={i}
            className="lbl-page bg-white shadow print:shadow-none"
            style={{
              width: `${pw}mm`,
              height: `${ph}mm`,
              boxSizing: "border-box",
              padding: `${c.marginTop}mm ${c.marginX}mm 0`,
              display: "grid",
              gridTemplateColumns: `repeat(${c.cols}, ${slot.w}mm)`,
              gridAutoRows: `${slot.h}mm`,
              columnGap: `${c.gapX}mm`,
              rowGap: `${c.gapY}mm`,
              alignContent: "start",
              overflow: "hidden",
            }}
          >
            {p.map((l) => (
              c.rotate ? (
                // برچسب ایستاده: چهره‌ی افقی ۹۰ درجه چرخیده در جای h×w
                <div key={l.key} style={{ position: "relative", width: `${slot.w}mm`, height: `${slot.h}mm`, overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `translateX(${c.h}mm) rotate(90deg)` }}>
                    <LabelFace l={l} c={c} />
                  </div>
                </div>
              ) : (
                <LabelFace key={l.key} l={l} c={c} />
              )
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

const fieldCls = "w-full px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm outline-none focus:border-blue-400";

/** عدد آزاد: تا وقتی تایپ می‌کنید دست نمی‌خورد؛ با خروج از کادر یا Enter اعمال می‌شود */
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  // null = در حال تایپ نیست، مقدار تنظیم نشان داده می‌شود
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = Number(toLatinDigits(text).replace(/[٫,]/g, ".").trim());
    if (text.trim() !== "" && Number.isFinite(n)) onChange(n);
    setText(null);
  };
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-gray-500 mb-1">{label}</span>
      <input
        inputMode="decimal"
        value={text ?? String(value)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        onFocus={(e) => e.target.select()}
        className={`${fieldCls} text-center`}
        dir="ltr"
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** فرم تنظیم برچسب — هر تغییر از `normalizeLabelConfig` می‌گذرد */
export function LabelSettingsForm({ value, onChange }: { value: LabelConfig; onChange: (v: LabelConfig) => void }) {
  const set = (patch: Partial<LabelConfig>) => onChange(normalizeLabelConfig({ ...value, ...patch }));
  const active = LABEL_PRESETS.find((p) => Object.entries(p.cfg).every(([k, v]) => value[k as keyof LabelConfig] === v))?.key;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LABEL_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => set(p.cfg)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${active === p.key ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 dark:bg-white/5"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className="block text-[11px] font-bold text-gray-500 mb-1">کاغذ</span>
          <select value={value.media} onChange={(e) => set({ media: e.target.value as LabelConfig["media"] })} className={fieldCls}>
            <option value="roll">رول</option>
            <option value="a4">برگه A4</option>
          </select>
        </label>
        <Num label="عرض برچسب (mm)" value={value.w} onChange={(w) => set({ w })} />
        <Num label="ارتفاع (mm)" value={value.h} onChange={(h) => set({ h })} />
        <Num label="کنار هم" value={value.cols} onChange={(cols) => set({ cols })} />
        <Num label="فاصله‌ی بین دو برچسب (mm)" value={value.gapX} onChange={(gapX) => set({ gapX })} />
        <Num label="فاصله‌ی عمودی A4 (mm)" value={value.gapY} onChange={(gapY) => set({ gapY })} />
        <Num label="حاشیه‌ی کناری (mm)" value={value.marginX} onChange={(marginX) => set({ marginX })} />
        <Num label="جابه‌جایی به پایین (mm)" value={value.marginTop} onChange={(marginTop) => set({ marginTop })} />
      </div>
      <p className="text-[11px] text-gray-500">
        اندازه‌ی هر صفحه‌ی چاپ (عرض × ارتفاع): <b dir="ltr">{faNum(pageWidthOf(value))} × {faNum(pageHeightOf(value))} mm</b> — همین اندازه را در تنظیم کاغذ چاپگر بگذارید، حاشیه‌ی چاپ مرورگر «هیچ» و مقیاس ۱۰۰٪.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block col-span-2">
          <span className="block text-[11px] font-bold text-gray-500 mb-1">متن بالای برچسب (نام فروشگاه)</span>
          <input value={value.header} onChange={(e) => set({ header: e.target.value })} className={fieldCls} placeholder="اختیاری" />
        </label>
        <Num label="قلم عنوان (pt)" value={value.titleSize} onChange={(titleSize) => set({ titleSize })} />
        <Num label="ارتفاع بارکد (٪)" value={value.barcodePct} onChange={(barcodePct) => set({ barcodePct })} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Toggle label="نام کالا" value={value.showTitle} onChange={(showTitle) => set({ showTitle })} />
        <Toggle label="قیمت" value={value.showPrice} onChange={(showPrice) => set({ showPrice })} />
        <Toggle label="کد زیر بارکد" value={value.showCode} onChange={(showCode) => set({ showCode })} />
        <Toggle label="چرخش ۹۰ درجه (برچسب ایستاده)" value={value.rotate} onChange={(rotate) => set({ rotate })} />
        <label className="flex items-center gap-1.5 text-xs font-bold">
          قیمت به
          <select value={value.priceUnit} onChange={(e) => set({ priceUnit: e.target.value as LabelConfig["priceUnit"] })} className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
            <option value="toman">تومان</option>
            <option value="rial">ریال</option>
          </select>
        </label>
      </div>
    </div>
  );
}
