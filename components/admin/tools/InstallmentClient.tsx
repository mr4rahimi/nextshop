"use client";

/**
 * فروش اقساطی — قیمت قسطی، جدول اقساط با تاریخ شمسی، و اینکه با تورم قسطی واقعاً از نقدی سودمندتر است
 * یا نه. ابزار سریع بدون جدول دیتابیس؛ ورودی‌ها در `localStorage` (`tools.installment`).
 * منطق: `lib/tools/installment-pricing.ts` (کارمزد و جدول همان قواعد برنامه‌ی اقساط حسابداری).
 * docs/features/tools.md بخش ۱۸
 */

import { useMemo, useState } from "react";
import { todayKey } from "@/lib/accounting/dates";
import { FEE_MODE_LABELS, type FeeMode } from "@/lib/accounting/installments-calc";
import { formatJalali } from "@/lib/club/jalali";
import { DEFAULT_INSTALLMENT, calcInstallments, type DownMode, type InstallmentInput } from "@/lib/tools/installment-pricing";
import { Card, Field, PageHeader, SectionTitle, Segmented, inputCls } from "../accounting/ui";
import { DecimalInput, Metric, MoneyInput, PctInput, fa, toman, useStored } from "./calc-inputs";

const ROUNDING = [1, 1_000, 10_000, 100_000];

export default function InstallmentClient() {
  const [input, setInput, loaded] = useStored<InstallmentInput>("tools.installment", DEFAULT_INSTALLMENT);
  const [today] = useState(() => todayKey());
  const set = (p: Partial<InstallmentInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcInstallments(input, today), [input, today]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const ready = input.cashPrice > 0 && r.principal > 0;
  const hasInflation = input.inflationPct > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="فروش اقساطی"
        help="toolsInstallment"
        desc="قیمت قسطی و مبلغ هر قسط را حساب کنید و ببینید با تورم، فروش قسطی واقعاً از نقدی سود بیشتری دارد یا نه."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="قیمت و پیش‌پرداخت" />
            <Field label="قیمت نقدی (تومان)">
              <MoneyInput value={input.cashPrice} onChange={(cashPrice) => set({ cashPrice })} />
            </Field>
            <Field label="پیش‌پرداخت">
              <div className="flex items-center gap-2">
                <Segmented<DownMode> value={input.downMode} onChange={(downMode) => set({ downMode, down: downMode === "PCT" ? 30 : 0 })} options={[{ value: "PCT", label: "درصد" }, { value: "AMOUNT", label: "مبلغ" }]} />
                <div className="flex-1">
                  {input.downMode === "PCT" ? (
                    <PctInput key="pct" value={input.down} onChange={(down) => set({ down })} />
                  ) : (
                    <MoneyInput value={input.down} onChange={(down) => set({ down })} />
                  )}
                </div>
              </div>
            </Field>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="اقساط" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="تعداد قسط">
                <DecimalInput value={input.count} max={120} suffix="قسط" onChange={(count) => set({ count: Math.round(count) })} />
              </Field>
              <Field label="فاصله‌ی اقساط">
                <select className={inputCls} value={input.intervalMonths} onChange={(e) => set({ intervalMonths: Number(e.target.value) })}>
                  {[1, 2, 3, 6].map((m) => <option key={m} value={m}>{m === 1 ? "ماهانه" : `هر ${fa(m)} ماه`}</option>)}
                </select>
              </Field>
              <Field label="گرد کردن قسط">
                <select className={inputCls} value={input.roundTo} onChange={(e) => set({ roundTo: Number(e.target.value) })}>
                  {ROUNDING.map((x) => <option key={x} value={x}>{x === 1 ? "بدون گرد کردن" : `${fa(x)} تومان`}</option>)}
                </select>
              </Field>
            </div>
            <Field label="کارمزد فروش قسطی">
              <select className={inputCls} value={input.feeMode} onChange={(e) => set({ feeMode: e.target.value as FeeMode })}>
                {(Object.keys(FEE_MODE_LABELS) as FeeMode[]).map((m) => <option key={m} value={m}>{FEE_MODE_LABELS[m]}</option>)}
              </select>
            </Field>
            {(input.feeMode === "MONTHLY" || input.feeMode === "TOTAL") && (
              <Field label={input.feeMode === "MONTHLY" ? "درصد ماهانه" : "درصد کل دوره"} hint={input.feeMode === "MONTHLY" ? "ساده، روی مبلغ قسطی: «ماهی ۳ درصد»" : undefined}>
                <PctInput key={input.feeMode} value={input.feePct} max={200} onChange={(feePct) => set({ feePct })} />
              </Field>
            )}
            {input.feeMode === "FIXED" && (
              <Field label="کارمزد ثابت (تومان)">
                <MoneyInput value={input.feeFixed} onChange={(feeFixed) => set({ feeFixed })} />
              </Field>
            )}
            <Field label="تورم یا هزینه‌ی پول ماهانه (اختیاری)" hint="پولی که دیرتر می‌گیرید ارزش کمتری دارد؛ برای مقایسه‌ی واقعی با فروش نقدی">
              <PctInput value={input.inflationPct} max={50} onChange={(inflationPct) => set({ inflationPct })} />
            </Field>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ready ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {input.cashPrice <= 0 ? "قیمت نقدی را وارد کنید." : "پیش‌پرداخت کل قیمت را پوشانده؛ قسطی نمی‌ماند."}
            </p>
          ) : (
            <>
              <Card className="space-y-4 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400">مبلغ هر قسط</p>
                    <p className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{toman(r.rows[0]?.amount ?? 0)}</p>
                    <p className="text-[11px] text-gray-400">{fa(r.rows.length)} قسط{r.rows.length > 1 && r.rows[r.rows.length - 1].amount !== r.rows[0].amount ? ` — آخری ${fa(r.rows[r.rows.length - 1].amount)}` : ""}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-gray-400">قیمت کل قسطی</p>
                    <p className="text-xl font-black tabular-nums">{toman(r.totalPrice)}</p>
                    <p className="text-[11px] text-gray-400">{fa(r.markupPct, 1)}٪ بیشتر از نقدی</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label="پیش‌پرداخت" value={fa(r.downAmount)} hint="همان روز فروش" />
                  <Metric label="مبلغ قسطی" value={fa(r.principal)} hint="قیمت نقدی منهای پیش‌پرداخت" />
                  <Metric label="کارمزد" value={fa(r.fee)} hint={FEE_MODE_LABELS[input.feeMode]} />
                </dl>

                {hasInflation && (
                  <div className={`rounded-xl p-3 text-xs leading-6 ${r.realGain >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                    با تورم ماهانه‌ی {fa(input.inflationPct, 1)}٪، ارزش امروزِ همه‌ی دریافتی‌ها <b>{toman(r.presentValue)}</b> است؛ یعنی فروش قسطی{" "}
                    {r.realGain >= 0 ? <>واقعاً <b className="text-emerald-700 dark:text-emerald-300">{toman(r.realGain)}</b> از نقدی بیشتر می‌دهد.</> : <><b className="text-red-700 dark:text-red-300">{toman(-r.realGain)}</b> از نقدی کمتر می‌دهد.</>}
                    {r.breakEvenMonthlyPct !== null && <> کارمزد ماهانه باید دست‌کم <b>{fa(Math.ceil(r.breakEvenMonthlyPct * 100) / 100, 2)}٪</b> باشد تا قسطی از نقدی کم نیاید.</>}
                  </div>
                )}
              </Card>

              <Card className="space-y-2 p-4">
                <SectionTitle title="جدول اقساط" />
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-gray-400">
                        <th className="py-1.5 text-right font-bold">قسط</th>
                        <th className="py-1.5 text-right font-bold">سررسید</th>
                        <th className="py-1.5 text-left font-bold">مبلغ</th>
                        {hasInflation && <th className="py-1.5 text-left font-bold">ارزش امروز</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {r.rows.map((x) => (
                        <tr key={x.seq} className="border-t border-[var(--adm-border)] tabular-nums">
                          <td className="py-1.5">{fa(x.seq)}</td>
                          <td className="py-1.5">{formatJalali(x.dueDate)}</td>
                          <td className="py-1.5 text-left">{fa(x.amount)}</td>
                          {hasInflation && <td className="py-1.5 text-left text-gray-500">{fa(Math.round(x.pv))}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-400">کارمزد و گرد کردن با همان قواعد برنامه‌ی اقساط فاکتور حساب شده؛ باقی‌مانده‌ی گرد کردن روی قسط آخر است.</p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
