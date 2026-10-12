"use client";

/**
 * ROI تبلیغات — سود خالص، ROI، ROAS و ROAS سربه‌سر یک تبلیغ. ابزار سریع بدون جدول؛
 * ورودی‌ها در `localStorage` (`tools.adRoi`). منطق: `lib/tools/ad-roi.ts`.
 * docs/features/tools.md بخش ۱۱
 */

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_AD_ROI, calcAdRoi, type AdRoiInput, type ProfitBasis, type ProfitMode } from "@/lib/tools/ad-roi";
import { Card, Field, PageHeader, SectionTitle, Segmented } from "../accounting/ui";
import { Metric, MoneyInput, PctInput, fa, toman } from "./calc-inputs";

const STORE_KEY = "tools.adRoi";

function load(): AdRoiInput {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULT_AD_ROI, ...(JSON.parse(raw) as Partial<AdRoiInput>) };
  } catch {}
  return DEFAULT_AD_ROI;
}

export default function AdRoiClient() {
  const [input, setInput] = useState<AdRoiInput>(DEFAULT_AD_ROI);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage فقط بعد از mount در دسترس است
    setInput(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(input));
    } catch {}
  }, [input, loaded]);

  const set = (p: Partial<AdRoiInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcAdRoi(input), [input]);

  // ورودی درصد متن خودش را از مقدار اولیه می‌گیرد؛ پیش از خواندن localStorage رسم نشود
  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const ready = input.adCost > 0 && input.revenue > 0;
  const loss = r.net < 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ROI تبلیغات"
        help="toolsAdRoi"
        desc="هزینه‌ی تبلیغ، فروشی که آورد و سودش را بدهید تا ببینید تبلیغ واقعاً سود داد یا فقط فروش آورد."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="تبلیغ" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="هزینه‌ی تبلیغ (تومان)" hint="همه‌ی هزینه: شارژ پنل، دستمزد ادمین یا بلاگر، طراحی">
                <MoneyInput value={input.adCost} onChange={(adCost) => set({ adCost })} />
              </Field>
              <Field label="فروشی که تبلیغ آورد (تومان)" hint="مبلغ سفارش‌هایی که از این تبلیغ آمدند">
                <MoneyInput value={input.revenue} onChange={(revenue) => set({ revenue })} />
              </Field>
              <Field label="تعداد سفارش (اختیاری)" hint="برای هزینه‌ی جذب هر سفارش">
                <MoneyInput value={input.orders} onChange={(orders) => set({ orders })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="سود همین فروش" />
            <Segmented<ProfitMode>
              value={input.profitMode}
              onChange={(profitMode) => set({ profitMode })}
              options={[{ value: "AMOUNT", label: "مبلغ سود را می‌دانم" }, { value: "MARGIN", label: "درصد سود را می‌دانم" }]}
            />
            {input.profitMode === "AMOUNT" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="سود حاصل (تومان)" hint="فروش منهای قیمت خرید کالا و هزینه‌های هر سفارش">
                  <MoneyInput value={input.profit} onChange={(profit) => set({ profit })} />
                </Field>
                <Field label="هزینه‌ی تبلیغ از این سود کم شده؟">
                  <Segmented<ProfitBasis>
                    value={input.profitBasis}
                    onChange={(profitBasis) => set({ profitBasis })}
                    options={[{ value: "BEFORE_AD", label: "نه، هنوز کم نشده" }, { value: "AFTER_AD", label: "بله، کم شده" }]}
                  />
                </Field>
              </div>
            ) : (
              <Field label="حاشیه‌ی سود فروش" hint="از هر ۱۰۰ تومان فروش چند تومان سود می‌ماند، پیش از هزینه‌ی تبلیغ">
                <div className="w-32">
                  <PctInput value={input.marginPct} onChange={(marginPct) => set({ marginPct })} />
                </div>
              </Field>
            )}
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ready ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              هزینه‌ی تبلیغ و فروشی که آورد را وارد کنید.
            </p>
          ) : (
            <>
              <Card className="space-y-4 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400">ROI واقعی تبلیغ</p>
                    <p className={`text-3xl font-black tabular-nums ${loss ? "text-red-600" : "text-emerald-600"}`}>
                      {r.roiPct! < 0 ? "−" : ""}{fa(Math.abs(r.roiPct!), 1)}٪
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-gray-400">{loss ? "ضرر خالص تبلیغ" : "سود خالص تبلیغ"}</p>
                    <p className={`text-xl font-black tabular-nums ${loss ? "text-red-600" : "text-emerald-600"}`}>{toman(Math.abs(r.net))}</p>
                  </div>
                </div>
                <p className="text-sm leading-7">
                  {loss ? (
                    <>این تبلیغ <b>{toman(input.revenue)}</b> فروش آورد ولی <b className="text-red-600">{toman(Math.abs(r.net))}</b> ضرر داد.</>
                  ) : (
                    <>هر ۱ تومان تبلیغ، <b>{fa(1 + r.roiPct! / 100, 2)}</b> تومان برگرداند؛ یعنی <b className="text-emerald-600">{toman(r.net)}</b> سود خالص.</>
                  )}
                </p>
                <p className="text-[11px] text-gray-400">
                  {input.profitMode === "MARGIN"
                    ? `سود از حاشیه‌ی ${fa(input.marginPct, 1)}٪ حساب شد و هزینه‌ی تبلیغ از آن کم شد.`
                    : input.profitBasis === "AFTER_AD"
                      ? "سود واردشده بعد از کم کردن هزینه‌ی تبلیغ حساب شد."
                      : "هزینه‌ی تبلیغ از سود واردشده کم شد."}
                </p>

                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Metric label="ROAS" value={`${fa(r.roas!, 1)}×`} hint="فروش ÷ هزینه‌ی تبلیغ" />
                  <Metric label="ROAS سربه‌سر" value={r.breakEvenRoas ? `${fa(r.breakEvenRoas, 1)}×` : "—"} hint="کمتر از این، تبلیغ ضرر است" />
                  <Metric label="فروش سربه‌سر" value={r.breakEvenRevenue ? fa(Math.ceil(r.breakEvenRevenue)) : "—"} hint="کمترین فروشی که هزینه‌ی تبلیغ را بپوشاند" />
                  <Metric label="حاشیه‌ی سود" value={`${fa(r.margin * 100, 1)}٪`} hint="سود پیش از تبلیغ ÷ فروش" />
                </dl>

                {r.breakEvenRoas !== null && <RoasBar roas={r.roas!} breakEven={r.breakEvenRoas} />}
              </Card>

              {r.cpa !== null && (
                <Card className="space-y-3 p-4">
                  <SectionTitle title="هر سفارش" />
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <Metric label="هزینه‌ی جذب" value={toman(r.cpa)} hint="هزینه‌ی تبلیغ ÷ تعداد سفارش (CPA)" />
                    <Metric label="سقف هزینه‌ی جذب" value={toman(Math.max(0, r.maxCpa!))} hint="سود هر سفارش پیش از تبلیغ؛ بیشتر از این خرج کنید ضرر است" />
                    <Metric label={r.netPerOrder! < 0 ? "ضرر هر سفارش" : "سود خالص هر سفارش"} value={toman(Math.abs(r.netPerOrder!))} hint="بعد از سهم تبلیغ" />
                  </dl>
                </Card>
              )}
            </>
          )}
          <p className="px-1 text-[11px] leading-5 text-gray-400">
            ROAS بالا یعنی فروش زیاد، نه لزوماً سود. با حاشیه‌ی سود ۱۰٪، حتی ROAS ۸ ضرر است؛ همیشه ROI را ببینید.
          </p>
        </div>
      </div>
    </div>
  );
}

/** ROAS فعلی در برابر ROAS سربه‌سر روی یک نوار */
function RoasBar({ roas, breakEven }: { roas: number; breakEven: number }) {
  const max = Math.max(roas, breakEven) * 1.25;
  const ok = roas >= breakEven;
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-white/5">
        <div className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${(roas / max) * 100}%` }} />
        <div className="absolute -top-[3px] h-4 w-0.5 bg-gray-700 dark:bg-gray-200" style={{ right: `${(breakEven / max) * 100}%` }} title="ROAS سربه‌سر" />
      </div>
      <p className="mt-1.5 text-[10px] text-gray-500">
        خط عمودی ROAS سربه‌سر است ({fa(breakEven, 1)}×). {ok ? "تبلیغ از آن بالاتر است." : "تبلیغ به آن نرسیده."}
      </p>
    </div>
  );
}
