"use client";

/**
 * ارزش طول عمر مشتری (LTV) — هر مشتری در کل همکاری چقدر فروش و سود می‌آورد و چقدر می‌شود خرج
 * جذبش کرد. ابزار سریع بدون جدول؛ ورودی‌ها در `localStorage` (`tools.ltv`).
 * منطق: `lib/tools/ltv.ts`. docs/features/tools.md بخش ۱۹
 */

import { useMemo } from "react";
import Link from "next/link";
import { DEFAULT_LTV, calcLtv, type LtvInput } from "@/lib/tools/ltv";
import { Card, Field, PageHeader, SectionTitle } from "../accounting/ui";
import { DecimalInput, Metric, MoneyInput, PctInput, fa, toman, useStored } from "./calc-inputs";

export default function LtvClient() {
  const [input, setInput, loaded] = useStored<LtvInput>("tools.ltv", DEFAULT_LTV);
  const set = (p: Partial<LtvInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcLtv(input), [input]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const ready = r.ltvRevenue > 0;
  const tone = r.ratio === null ? "" : r.ratio >= 3 ? "text-emerald-600" : r.ratio >= 1 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <PageHeader
        title="ارزش طول عمر مشتری"
        help="toolsLtv"
        desc="هر مشتری در کل همکاری‌اش چقدر سود می‌آورد — و بنابراین برای جذب یک مشتری تازه تا چه مبلغی می‌شود خرج کرد."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="مشتری معمولی" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="میانگین مبلغ هر خرید (تومان)">
                <MoneyInput value={input.avgOrder} onChange={(avgOrder) => set({ avgOrder })} />
              </Field>
              <Field label="چند بار در سال می‌خرد">
                <DecimalInput value={input.ordersPerYear} max={365} suffix="بار" onChange={(ordersPerYear) => set({ ordersPerYear })} />
              </Field>
              <Field label="چند سال مشتری می‌ماند">
                <DecimalInput value={input.years} max={50} suffix="سال" onChange={(years) => set({ years })} />
              </Field>
              <Field label="حاشیه‌ی سود فروش">
                <PctInput value={input.marginPct} max={99} onChange={(marginPct) => set({ marginPct })} />
              </Field>
            </div>
            <p className="text-[11px] leading-5 text-gray-400">
              اگر باشگاه مشتریان دارید، میانگین خرید و دفعات خرید را از گزارش‌های باشگاه و فروش بردارید.
            </p>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="هزینه‌ی جذب" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="سهم مجاز از سود برای جذب" hint="رایج: یک‌سوم — LTV به هزینه‌ی جذب ۳ به ۱">
                <PctInput value={input.cacSharePct} onChange={(cacSharePct) => set({ cacSharePct })} />
              </Field>
              <Field label="هزینه‌ی جذب فعلی هر مشتری (اختیاری)" hint="هزینه‌ی تبلیغ ÷ مشتری تازه">
                <MoneyInput value={input.currentCac} onChange={(currentCac) => set({ currentCac })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ready ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              میانگین خرید، دفعات خرید در سال و سال‌های ماندن را وارد کنید.
            </p>
          ) : (
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-gray-400">سودی که هر مشتری در کل می‌آورد</p>
                  <p className="text-3xl font-black tabular-nums text-emerald-600">{toman(r.ltvProfit)}</p>
                  <p className="text-[11px] text-gray-400">از {toman(r.ltvRevenue)} خرید</p>
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-gray-400">سقف هزینه‌ی جذب هر مشتری</p>
                  <p className="text-xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{toman(r.maxCac)}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <Metric label="سود سالانه‌ی هر مشتری" value={fa(Math.round(r.yearlyProfit))} hint="میانگین خرید × دفعات × حاشیه" />
                {r.ratio !== null && <Metric label="LTV به هزینه‌ی جذب" value={`${fa(r.ratio, 1)} به ۱`} hint="۳ به ۱ یا بیشتر سالم است؛ کمتر از ۱ یعنی هر مشتری ضرر است" />}
                {r.paybackMonths !== null && <Metric label="برگشت هزینه‌ی جذب" value={`${fa(r.paybackMonths, 1)} ماه`} hint="چند ماه طول می‌کشد تا سود مشتری هزینه‌ی جذبش را بپوشاند" />}
              </dl>

              {r.ratio !== null && (
                <p className={`text-sm font-bold ${tone}`}>
                  {r.ratio >= 3
                    ? "هزینه‌ی جذب سالم است؛ جا برای تبلیغ بیشتر هست."
                    : r.ratio >= 1
                      ? "هزینه‌ی جذب سود را کم می‌کند؛ یا تبلیغ را ارزان‌تر کنید یا مشتری را بیشتر نگه دارید."
                      : "هر مشتری تازه از سودی که می‌آورد گران‌تر تمام می‌شود."}
                </p>
              )}
              <p className="text-[11px] leading-5 text-gray-400">
                هزینه‌ی جذب واقعی هر کمپین را در <Link href="/admin/tools/ad-roi" className="underline">ROI تبلیغات</Link> ببینید و با این سقف مقایسه کنید.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
