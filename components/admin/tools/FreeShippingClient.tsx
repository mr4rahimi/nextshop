"use client";

/**
 * حداقل خرید برای ارسال رایگان — آستانه‌ای که هم مشتری را به خرید بیشتر بکشد و هم سود را نخورد.
 * ابزار سریع بدون جدول؛ ورودی‌ها در `localStorage` (`tools.freeShipping`).
 * منطق: `lib/tools/free-shipping.ts`. docs/features/tools.md بخش ۱۷
 */

import { useMemo } from "react";
import { DEFAULT_FREE_SHIPPING, calcFreeShipping, type FreeShippingInput } from "@/lib/tools/free-shipping";
import { Card, Field, PageHeader, SectionTitle, btn } from "../accounting/ui";
import { Metric, MoneyInput, PctInput, fa, toman, useStored } from "./calc-inputs";

export default function FreeShippingClient() {
  const [input, setInput, loaded] = useStored<FreeShippingInput>("tools.freeShipping", DEFAULT_FREE_SHIPPING);
  const set = (p: Partial<FreeShippingInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcFreeShipping(input), [input]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const ready = input.avgOrder > 0 && input.shippingCost > 0 && input.marginPct > 0;
  const custom = input.threshold > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="حداقل خرید برای ارسال رایگان"
        help="toolsFreeShipping"
        desc="آستانه‌ی «ارسال رایگان برای خرید بالای X» را طوری بگذارید که مشتری را به خرید بیشتر بکشد و هزینه‌ی ارسال از سود شما نرود."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="امروز" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="میانگین مبلغ سبد خرید (تومان)" hint="فروش ماه ÷ تعداد سفارش، بدون هزینه‌ی ارسال">
                <MoneyInput value={input.avgOrder} onChange={(avgOrder) => set({ avgOrder })} />
              </Field>
              <Field label="هزینه‌ی ارسال هر سفارش (تومان)" hint="که با ارسال رایگان خودتان می‌دهید">
                <MoneyInput value={input.shippingCost} onChange={(shippingCost) => set({ shippingCost })} />
              </Field>
              <Field label="حاشیه‌ی سود فروش" hint="از هر ۱۰۰ تومان فروش چقدر سود می‌ماند">
                <PctInput value={input.marginPct} max={99} onChange={(marginPct) => set({ marginPct })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="آستانه و سفارش‌ها (اختیاری)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="آستانه‌ای که در نظر دارید (تومان)" hint="خالی = همان پیشنهادی">
                <MoneyInput value={input.threshold} onChange={(threshold) => set({ threshold })} />
              </Field>
              <Field label="سفارش در ماه">
                <MoneyInput value={input.ordersPerMonth} onChange={(ordersPerMonth) => set({ ordersPerMonth })} />
              </Field>
              <Field label="چند درصد سفارش‌ها همین حالا بالای آستانه‌اند" hint="این‌ها بی‌آنکه بیشتر بخرند ارسال رایگان می‌گیرند">
                <PctInput value={input.alreadyAbovePct} onChange={(alreadyAbovePct) => set({ alreadyAbovePct })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ready ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              میانگین سبد، هزینه‌ی ارسال و حاشیه‌ی سود را وارد کنید.
            </p>
          ) : (
            <Card className="space-y-4 p-4">
              <div>
                <p className="text-[11px] font-bold text-gray-400">آستانه‌ی پیشنهادی</p>
                <p className="mt-1 text-base leading-8">
                  ارسال رایگان برای خرید بالای{" "}
                  <span className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{toman(r.suggested ?? 0)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  کمتر از <b>{toman(Math.ceil(r.breakEven ?? 0))}</b>، مشتری‌ای که برای ارسال رایگان بیشتر می‌خرد از سود شما کم می‌کند.
                  {!custom && (
                    <button className={`${btn.small} mr-2`} onClick={() => set({ threshold: r.suggested ?? 0 })}>از همین شروع کن</button>
                  )}
                </p>
              </div>

              {custom && (
                <div className={`rounded-xl p-3 text-xs leading-6 ${r.gainPerUpgrade >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                  با آستانه‌ی <b>{toman(r.threshold)}</b>، مشتری‌ای که سبدش را تا آستانه بالا می‌برد{" "}
                  {r.gainPerUpgrade >= 0 ? <>هر بار <b className="text-emerald-700 dark:text-emerald-300">{toman(r.gainPerUpgrade)}</b> سود بیشتر می‌دهد.</> : <>هر بار <b className="text-red-700 dark:text-red-300">{toman(-r.gainPerUpgrade)}</b> از سودتان کم می‌کند.</>}
                </div>
              )}

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <Metric label="سود سبد امروز" value={fa(Math.round(r.profitNow))} hint="میانگین سبد × حاشیه؛ ارسال با مشتری" />
                <Metric label="سود سبد در آستانه" value={fa(Math.round(r.profitAtThreshold))} hint="آستانه × حاشیه − هزینه‌ی ارسال" />
                <Metric label="نسبت به میانگین سبد" value={`${fa((r.threshold / input.avgOrder) * 100, 0)}٪`} hint="آستانه‌ی خیلی نزدیک به میانگین یعنی تقریباً همه رایگان می‌گیرند" />
              </dl>

              {r.giveawayMonthly !== null && r.giveawayMonthly > 0 && (
                <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  سفارش‌هایی که از قبل بالای آستانه‌اند ماهانه <b>{toman(r.giveawayMonthly)}</b> ارسال رایگان می‌گیرند.
                  {r.upgradesNeeded !== null ? <> برای جبرانش باید دست‌کم <b>{fa(r.upgradesNeeded)}</b> مشتری در ماه سبدشان را تا آستانه بالا ببرند.</> : " با این آستانه هیچ ارتقایی آن را جبران نمی‌کند."}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
