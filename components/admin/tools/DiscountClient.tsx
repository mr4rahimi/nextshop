"use client";

/**
 * تخفیف و حراج — با X٪ تخفیف چقدر باید بیشتر بفروشید تا سود کل همان بماند. ابزار سریع بدون
 * جدول؛ ورودی‌ها در `localStorage` (`tools.discount`). منطق: `lib/tools/discount.ts`.
 * `?price=&cost=` (از «سرمایه‌ی درگیر») قیمت و هزینه را پر می‌کند.
 * docs/features/tools.md بخش ۱۳
 */

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DISCOUNT, DISCOUNT_STEPS, calcDiscount, discountRow,
  type CostMode, type DiscountInput, type DiscountResult,
} from "@/lib/tools/discount";
import { Card, Field, PageHeader, SectionTitle, Segmented } from "../accounting/ui";
import { Metric, MoneyInput, PctInput, fa, toman } from "./calc-inputs";

const STORE_KEY = "tools.discount";

function load(): DiscountInput {
  let x = DEFAULT_DISCOUNT;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) x = { ...DEFAULT_DISCOUNT, ...(JSON.parse(raw) as Partial<DiscountInput>) };
  } catch {}
  // پیوند «تخفیف» از سرمایه‌ی درگیر: ?price=&cost= — یک بار اعمال و از آدرس پاک می‌شود
  const qs = new URLSearchParams(window.location.search);
  const price = Number(qs.get("price"));
  const cost = Number(qs.get("cost"));
  if (price > 0 && cost >= 0 && qs.has("cost")) {
    x = { ...x, price: Math.round(price), costMode: "AMOUNT", unitCost: Math.round(cost), variablePct: 0 };
    window.history.replaceState(null, "", window.location.pathname);
  }
  return x;
}

export default function DiscountClient() {
  const [input, setInput] = useState<DiscountInput>(DEFAULT_DISCOUNT);
  const [loaded, setLoaded] = useState(false);
  // با کلیک روی ردیف جدول، ورودی درصد تخفیف از نو ساخته می‌شود تا متنش عوض شود
  const [discountKey, setDiscountKey] = useState(0);

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

  const set = (p: Partial<DiscountInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcDiscount(input), [input]);
  const rows = useMemo(() => {
    const steps = DISCOUNT_STEPS.includes(input.discountPct) || input.discountPct <= 0 ? DISCOUNT_STEPS : [...DISCOUNT_STEPS, input.discountPct].sort((a, b) => a - b);
    return steps.map((d) => discountRow(input, d));
  }, [input]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const ready = input.price > 0 && r.baseProfit > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="تخفیف و حراج"
        help="toolsDiscount"
        desc="پیش از تخفیف ببینید چقدر باید بیشتر بفروشید تا سودتان کم نشود — و تا چند درصد تخفیف اصلاً سود می‌ماند."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="محصول" />
            <Field label="قیمت فروش فعلی (تومان)">
              <MoneyInput value={input.price} onChange={(price) => set({ price })} />
            </Field>
            <Segmented<CostMode>
              value={input.costMode}
              onChange={(costMode) => set({ costMode })}
              options={[{ value: "AMOUNT", label: "هزینه‌ی هر واحد را می‌دانم" }, { value: "MARGIN", label: "درصد سود را می‌دانم" }]}
            />
            {input.costMode === "AMOUNT" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="هزینه‌ی هر واحد (تومان)" hint="قیمت خرید + بسته‌بندی + ارسالی که خودتان می‌دهید">
                  <MoneyInput value={input.unitCost} onChange={(unitCost) => set({ unitCost })} />
                </Field>
                <Field label="هزینه‌ی درصدی از فروش (اختیاری)" hint="کارمزد بازار آنلاین، درگاه، پورسانت">
                  <PctInput value={input.variablePct} max={99} onChange={(variablePct) => set({ variablePct })} />
                </Field>
              </div>
            ) : (
              <Field label="حاشیه‌ی سود فعلی" hint="از هر ۱۰۰ تومان فروش چند تومان سود می‌ماند">
                <div className="w-32">
                  <PctInput value={input.marginPct} max={99} onChange={(marginPct) => set({ marginPct })} />
                </div>
              </Field>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="تخفیف" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="درصد تخفیف">
                <PctInput key={discountKey} value={input.discountPct} max={99} onChange={(discountPct) => set({ discountPct })} />
              </Field>
              <Field label="فروش فعلی در دوره (اختیاری)" hint="مثلاً فروش ماهانه؛ برای تعداد لازم در حراج">
                <MoneyInput value={input.currentUnits} onChange={(currentUnits) => set({ currentUnits })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ready ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {input.price <= 0 ? "قیمت فروش را وارد کنید." : "با این قیمت و هزینه همین حالا هم سودی نمی‌ماند؛ جایی برای تخفیف نیست."}
            </p>
          ) : (
            <>
              <ResultCard r={r} input={input} />
              <Card className="space-y-2 p-4">
                <SectionTitle title="تخفیف‌های دیگر" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-gray-400">
                        <th className="py-1.5 text-right font-bold">تخفیف</th>
                        <th className="py-1.5 text-right font-bold">قیمت</th>
                        <th className="py-1.5 text-right font-bold">سود هر واحد</th>
                        <th className="py-1.5 text-right font-bold">فروش بیشتر لازم</th>
                        {input.currentUnits > 0 && <th className="py-1.5 text-right font-bold">تعداد لازم</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr
                          key={x.discountPct}
                          className={`cursor-pointer border-t border-[var(--adm-border)] tabular-nums hover:bg-gray-50 dark:hover:bg-white/5 ${x.discountPct === input.discountPct ? "bg-indigo-50 font-bold dark:bg-indigo-500/10" : ""}`}
                          onClick={() => { set({ discountPct: x.discountPct }); setDiscountKey((k) => k + 1); }}
                        >
                          <td className="py-1.5">{fa(x.discountPct, 1)}٪</td>
                          <td className="py-1.5">{fa(Math.round(x.newPrice))}</td>
                          <td className={`py-1.5 ${x.unitProfit <= 0 ? "text-red-600" : ""}`}>{fa(Math.round(x.unitProfit))}</td>
                          <td className={`py-1.5 ${x.extraSalesPct === null ? "text-red-600" : ""}`}>{x.extraSalesPct === null ? "ضرر در هر فروش" : `${fa(x.extraSalesPct, 1)}٪`}</td>
                          {input.currentUnits > 0 && <td className="py-1.5">{x.unitsNeeded === null ? "—" : fa(x.unitsNeeded)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-400">روی هر ردیف بزنید تا همان تخفیف بالا بنشیند.</p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ r, input }: { r: DiscountResult; input: DiscountInput }) {
  const d = fa(r.discountPct, 1);
  return (
    <Card className="space-y-4 p-4">
      {r.extraSalesPct === null ? (
        <div>
          <p className="text-sm font-black text-red-600">با {d}٪ تخفیف هر فروش ضرر است.</p>
          <p className="mt-1 text-xs text-gray-500">
            هر واحد {toman(Math.abs(r.unitProfit))} ضرر می‌دهد؛ هر چه بیشتر بفروشید ضرر بیشتر می‌شود. بیشترین تخفیف بی‌ضرر{" "}
            <b>{fa(Math.floor(r.maxDiscountPct * 10) / 10, 1)}٪</b> است.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-bold text-gray-400">برای اینکه سود کل کم نشود</p>
          <p className="mt-1 text-base leading-8">
            با {d}٪ تخفیف باید{" "}
            <span className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{fa(r.extraSalesPct, 1)}٪</span>{" "}
            بیشتر بفروشید.
          </p>
          {r.unitsNeeded !== null && (
            <p className="text-xs text-gray-500">
              یعنی به‌جای {fa(input.currentUnits)} عدد، دست‌کم <b className="tabular-nums">{fa(r.unitsNeeded)}</b> عدد ({fa(r.unitsNeeded - input.currentUnits)} عدد بیشتر).
            </p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Metric label="قیمت با تخفیف" value={fa(Math.round(r.newPrice))} hint="قیمت فعلی منهای تخفیف" />
        <Metric label="سود هر واحد الان" value={fa(Math.round(r.baseProfit))} hint={`حاشیه‌ی سود ${fa(r.baseMargin * 100, 1)}٪`} />
        <Metric label="سود هر واحد با تخفیف" value={fa(Math.round(r.unitProfit))} hint="تخفیف کامل از سود کم می‌شود، نه از قیمت" />
        <Metric label="بیشترین تخفیف بی‌ضرر" value={`${fa(Math.floor(r.maxDiscountPct * 10) / 10, 1)}٪`} hint="بیشتر از این، هر فروش ضرر است" />
      </dl>

      {r.baseTotal !== null && r.sameUnitsTotal !== null && r.extraSalesPct !== null && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          اگر حراج فروش را بیشتر نکند، سود دوره از <b>{toman(r.baseTotal)}</b> به <b>{toman(r.sameUnitsTotal)}</b> می‌رسد
          ({fa(((r.baseTotal - r.sameUnitsTotal) / r.baseTotal) * 100, 1)}٪ کمتر).
        </p>
      )}
    </Card>
  );
}
