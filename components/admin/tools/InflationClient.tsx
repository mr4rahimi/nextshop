"use client";

/**
 * قیمت‌گذاری با تورم — سود روی کاغذ در برابر سود واقعی روی قیمت خرید دوباره. ابزار سریع بدون جدول؛
 * ورودی‌ها در `localStorage` (`tools.inflation`). منطق: `lib/tools/inflation.ts`.
 * docs/features/tools.md بخش ۱۶
 */

import { useMemo } from "react";
import { DEFAULT_INFLATION, calcInflation, type InflationInput, type ReplaceMode } from "@/lib/tools/inflation";
import { Card, Field, PageHeader, SectionTitle, Segmented } from "../accounting/ui";
import { DecimalInput, Metric, MoneyInput, PctInput, fa, toman, useStored } from "./calc-inputs";

const pct = (x: number | null) => (x === null ? "—" : `${x < 0 ? "−" : ""}${fa(Math.abs(x) * 100, 1)}٪`);

export default function InflationClient() {
  const [input, setInput, loaded] = useStored<InflationInput>("tools.inflation", DEFAULT_INFLATION);
  const set = (p: Partial<InflationInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcInflation(input), [input]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const ready = input.oldCost > 0 && input.price > 0 && r.replacement > 0;
  const eaten = r.realProfit < 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="قیمت‌گذاری با تورم"
        help="toolsInflation"
        desc="سود روی کاغذ را با سود واقعی مقایسه کنید: اگر با پول فروش نتوانید همان کالا را دوباره بخرید، سرمایه‌تان کوچک می‌شود."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="قیمت خرید" />
            <Field label="قیمت خرید قبلی هر واحد (تومان)" hint="همان که کالای فعلی انبار با آن خریده شده">
              <MoneyInput value={input.oldCost} onChange={(oldCost) => set({ oldCost })} />
            </Field>
            <Segmented<ReplaceMode>
              value={input.mode}
              onChange={(mode) => set({ mode })}
              options={[{ value: "KNOWN", label: "قیمت خرید امروز را می‌دانم" }, { value: "RATE", label: "از نرخ تورم حساب کن" }]}
            />
            {input.mode === "KNOWN" ? (
              <Field label="قیمت خرید امروز هر واحد (تومان)" hint="از تأمین‌کننده بپرسید">
                <MoneyInput value={input.newCost} onChange={(newCost) => set({ newCost })} />
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="تورم ماهانه‌ی این کالا">
                  <PctInput value={input.monthlyPct} onChange={(monthlyPct) => set({ monthlyPct })} />
                </Field>
                <Field label="چند ماه در انبار می‌ماند" hint="از خرید تا فروش">
                  <DecimalInput value={input.months} max={120} suffix="ماه" onChange={(months) => set({ months })} />
                </Field>
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="فروش" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="قیمت فروش فعلی (تومان)">
                <MoneyInput value={input.price} onChange={(price) => set({ price })} />
              </Field>
              <Field label="هزینه‌ی درصدی از فروش (اختیاری)" hint="کارمزد بازار، درگاه">
                <PctInput value={input.variablePct} max={99} onChange={(variablePct) => set({ variablePct })} />
              </Field>
              <Field label="سود دلخواه" hint="درصد از قیمت فروش، روی قیمت خرید امروز">
                <PctInput value={input.targetMarginPct} max={95} onChange={(targetMarginPct) => set({ targetMarginPct })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ready ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              قیمت خرید قبلی، قیمت خرید امروز (یا نرخ تورم) و قیمت فروش را وارد کنید.
            </p>
          ) : (
            <Card className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold text-gray-400">سود روی کاغذ</p>
                  <p className="text-xl font-black tabular-nums text-gray-500">{toman(r.paperProfit)}</p>
                  <p className="text-[11px] text-gray-400">{pct(r.paperMargin)} از فروش</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400">سود واقعی</p>
                  <p className={`text-2xl font-black tabular-nums ${eaten ? "text-red-600" : "text-emerald-600"}`}>
                    {eaten ? "−" : ""}{toman(Math.abs(r.realProfit))}
                  </p>
                  <p className="text-[11px] text-gray-400">{pct(r.realMargin)} از فروش</p>
                </div>
              </div>

              <p className={`rounded-xl p-3 text-sm leading-7 ${eaten ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>
                با پول فروش <b>۱۰</b> واحد، امروز <b className="text-lg tabular-nums">{fa(r.rebuyOf10 ?? 0, 1)}</b> واحد می‌شود خرید.
                {eaten ? " سودی که می‌بینید در واقع از سرمایه خورده می‌شود." : " سرمایه حفظ می‌شود."}
              </p>

              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <Metric label="قیمت خرید امروز" value={fa(Math.round(r.replacement))} hint={input.mode === "RATE" ? "قیمت قبلی با تورم مرکب ماهانه" : "واردشده"} />
                <Metric label="کمترین قیمت حفظ سرمایه" value={r.keepPrice === null ? "—" : fa(Math.ceil(r.keepPrice))} hint="کمتر از این، با پول فروش نمی‌شود همان کالا را دوباره خرید" />
                <Metric label={`قیمت با سود ${fa(input.targetMarginPct)}٪`} value={r.targetPrice === null ? "ممکن نیست" : fa(Math.ceil(r.targetPrice))} hint="سود دلخواه روی قیمت خرید امروز" />
              </dl>
              {r.targetPrice !== null && r.targetPrice > input.price && (
                <p className="text-xs text-gray-500">
                  برای سود {fa(input.targetMarginPct)}٪ واقعی، قیمت باید <b>{fa(((r.targetPrice - input.price) / input.price) * 100, 1)}٪</b> بالا برود.
                </p>
              )}
            </Card>
          )}
          <p className="px-1 text-[11px] leading-5 text-gray-400">
            در بازار تورمی، قیمت را بر پایه‌ی قیمت خرید دوباره بگذارید، نه قیمتی که کالای فعلی با آن خریده شده.
          </p>
        </div>
      </div>
    </div>
  );
}
