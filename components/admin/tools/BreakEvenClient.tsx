"use client";

/**
 * محاسبه‌ی نقطه‌ی سربه‌سر — چند فروش در ماه/سال تا ضرر نکنید. ابزار سریع بدون
 * جدول؛ ورودی‌ها در `localStorage` (`tools.breakEven`). منطق: `lib/tools/break-even.ts`.
 * docs/features/tools.md بخش ۱۰
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_BREAK_EVEN, calcBreakEven, priceSensitivity,
  type BreakEvenInput, type BreakEvenResult, type FixedCost,
} from "@/lib/tools/break-even";
import { Card, Field, PageHeader, SectionTitle, Segmented, btn, inputCls } from "../accounting/ui";
import { Metric, MoneyInput, PctInput, fa, toman } from "./calc-inputs";

const STORE_KEY = "tools.breakEven";

type Period = "30" | "365";
const PERIOD_LABEL: Record<Period, string> = { "30": "ماه", "365": "سال" };

function load(): BreakEvenInput {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const x = JSON.parse(raw) as Partial<BreakEvenInput>;
      return {
        ...DEFAULT_BREAK_EVEN,
        ...x,
        fixedCosts: Array.isArray(x.fixedCosts) && x.fixedCosts.length ? x.fixedCosts : DEFAULT_BREAK_EVEN.fixedCosts,
      };
    }
  } catch {}
  return DEFAULT_BREAK_EVEN;
}

export default function BreakEvenClient() {
  const [input, setInput] = useState<BreakEvenInput>(DEFAULT_BREAK_EVEN);
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

  const set = (p: Partial<BreakEvenInput>) => setInput((s) => ({ ...s, ...p }));
  const setCost = (id: string, p: Partial<FixedCost>) =>
    setInput((s) => ({ ...s, fixedCosts: s.fixedCosts.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const r = useMemo(() => calcBreakEven(input), [input]);
  const sens = useMemo(() => priceSensitivity(input), [input]);
  const period: Period = input.periodDays === 365 ? "365" : "30";
  const per = PERIOD_LABEL[period];

  // ورودی درصد متن خودش را از مقدار اولیه می‌گیرد؛ پیش از خواندن localStorage رسم نشود
  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  function addCost() {
    setInput((s) => ({ ...s, fixedCosts: [...s.fixedCosts, { id: `f${Date.now().toString(36)}`, name: "", amount: 0 }] }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="محاسبه‌ی نقطه‌ی سربه‌سر"
        help="toolsBreakEven"
        desc="هزینه‌های ثابت، هزینه‌ی هر واحد و قیمت فروش را بدهید تا ببینید حداقل چند محصول باید بفروشید که ضرر نکنید — و برای سود دلخواه چندتا."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle
              title="هزینه‌های ثابت"
              actions={
                <Segmented<Period>
                  value={period}
                  onChange={(v) => set({ periodDays: Number(v) })}
                  options={[{ value: "30", label: "ماهانه" }, { value: "365", label: "سالانه" }]}
                />
              }
            />
            <p className="-mt-1 text-[11px] leading-5 text-gray-400">
              هزینه‌هایی که چه بفروشید چه نفروشید باید بدهید. ردیف‌ها را به دلخواه عوض کنید؛ یک ردیف هم کافی است.
            </p>
            {input.fixedCosts.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <input className={`${inputCls} min-w-0 flex-1`} placeholder="عنوان هزینه" value={c.name} maxLength={60} onChange={(e) => setCost(c.id, { name: e.target.value })} />
                <div className="w-40 shrink-0 sm:w-48">
                  <MoneyInput value={c.amount} onChange={(amount) => setCost(c.id, { amount })} />
                </div>
                <button
                  className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 disabled:invisible"
                  disabled={input.fixedCosts.length === 1}
                  onClick={() => setInput((s) => ({ ...s, fixedCosts: s.fixedCosts.filter((x) => x.id !== c.id) }))}
                  aria-label="حذف ردیف"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--adm-border)] pt-3">
              <button className={btn.small} onClick={addCost}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                هزینه
              </button>
              <p className="text-xs font-bold">
                جمع در {per}: <span className="tabular-nums">{toman(r.fixedTotal)}</span>
              </p>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="هر محصول" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="قیمت فروش هر واحد (تومان)">
                <MoneyInput value={input.price} onChange={(price) => set({ price })} />
              </Field>
              <Field label="هزینه‌ی متغیر هر واحد (تومان)" hint="قیمت خرید یا ساخت + بسته‌بندی + ارسالی که خودتان می‌دهید">
                <MoneyInput value={input.variableCost} onChange={(variableCost) => set({ variableCost })} />
              </Field>
              <Field label="هزینه‌ی درصدی از فروش (اختیاری)" hint="کارمزد بازار آنلاین، درگاه پرداخت، پورسانت فروشنده">
                <PctInput value={input.variablePct} max={99} onChange={(variablePct) => set({ variablePct })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="هدف و پیش‌بینی (اختیاری)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`سود دلخواه در ${per} (تومان)`} hint="چند فروش لازم است تا این‌قدر سود بماند">
                <MoneyInput value={input.targetProfit} onChange={(targetProfit) => set({ targetProfit })} />
              </Field>
              <Field label={`فروش پیش‌بینی‌شده در ${per} (تعداد)`} hint="ببینید با این فروش سود می‌کنید یا ضرر">
                <MoneyInput value={input.expectedUnits} onChange={(expectedUnits) => set({ expectedUnits })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <ResultCard r={r} input={input} per={per} />
          {r.units !== null && input.price > 0 && (
            <Card className="space-y-2 p-4">
              <SectionTitle title="اگر قیمت را عوض کنید" />
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {sens.map((s) => (
                  <div key={s.pct} className="rounded-xl bg-gray-50 p-2.5 dark:bg-white/5">
                    <p className={`text-[10px] font-bold ${s.pct < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {s.pct > 0 ? "+" : "−"}{fa(Math.abs(s.pct))}٪ · {fa(Math.round(s.price))}
                    </p>
                    <p className="mt-0.5 font-black tabular-nums">{s.units === null ? "زیان در هر فروش" : `${fa(s.units)} عدد`}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-gray-400">
                تخفیف کوچک سربه‌سر را خیلی بالا می‌برد، چون از سود هر واحد کم می‌شود نه از قیمت.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ r, input, per }: { r: BreakEvenResult; input: BreakEvenInput; per: string }) {
  if (input.price <= 0) {
    return <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">قیمت فروش را وارد کنید.</p>;
  }
  if (r.units === null) {
    return (
      <Card className="space-y-2 p-4">
        <p className="text-sm font-black text-red-600">با این قیمت هر فروش خودش ضرر است.</p>
        <p className="text-xs leading-6 text-gray-500">
          هزینه‌ی هر واحد {toman(input.price - r.cm)} است و از قیمت فروش بیشتر یا برابر است؛ با فروش بیشتر فقط ضرر بیشتر می‌شود.
          {r.minPrice !== null && <> قیمت باید دست‌کم <b className="tabular-nums">{toman(Math.floor(r.minPrice) + 1)}</b> باشد تا هر فروش سود بدهد.</>}
        </p>
      </Card>
    );
  }

  const exp = input.expectedUnits > 0 && r.expectedProfit !== null;
  const loss = exp && r.expectedProfit! < 0;
  const progress = exp && r.units > 0 ? Math.min(100, (input.expectedUnits / r.units) * 100) : 0;

  return (
    <Card className="space-y-4 p-4">
      {r.fixedTotal <= 0 ? (
        <p className="text-sm font-black text-emerald-600">هزینه‌ی ثابتی وارد نشده؛ از اولین فروش سود می‌کنید.</p>
      ) : (
        <div>
          <p className="text-[11px] font-bold text-gray-400">نقطه‌ی سربه‌سر</p>
          <p className="mt-1 text-base leading-8">
            برای اینکه ضرر نکنید باید حداقل{" "}
            <span className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{fa(r.units)}</span>{" "}
            محصول در {per} بفروشید.
          </p>
          <p className="text-xs text-gray-500">
            یعنی روزانه حدود <b className="tabular-nums">{fa(r.unitsPerDay ?? 0, 1)}</b> فروش، و فروشی معادل <b className="tabular-nums">{toman(r.revenue ?? 0)}</b> در {per}.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <Metric label="سود هر فروش" value={toman(r.cm)} hint="قیمت منهای هزینه‌ی متغیر و درصدی؛ همین سهم، هزینه‌ی ثابت را می‌پوشاند" />
        <Metric label="از هر ۱۰۰ تومان فروش" value={`${fa(r.cmRatio * 100, 1)} تومان`} hint="سهمی از هر فروش که برای هزینه‌ی ثابت و سود می‌ماند" />
        <Metric label="هزینه‌ی ثابت" value={toman(r.fixedTotal)} hint={`جمع هزینه‌های ثابت در ${per}`} />
      </dl>

      {r.targetUnits !== null && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-6 dark:bg-emerald-500/10">
          برای <b>{toman(input.targetProfit)}</b> سود در {per} باید <b className="text-base tabular-nums">{fa(r.targetUnits)}</b> محصول بفروشید
          {r.fixedTotal > 0 && <> ({fa(r.targetUnits - r.units)} عدد بیشتر از سربه‌سر)</>}.
        </div>
      )}

      {exp && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-xs text-gray-500">با فروش {fa(input.expectedUnits)} عدد در {per}:</p>
            <p className={`text-lg font-black tabular-nums ${loss ? "text-red-600" : "text-emerald-600"}`}>
              {loss ? "زیان" : "سود"} {toman(Math.abs(r.expectedProfit!))}
            </p>
          </div>
          {r.units > 0 && (
            <>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                <div className={`h-full ${loss ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-gray-400">
                {loss
                  ? `${fa(r.units - input.expectedUnits)} فروش دیگر تا سربه‌سر مانده.`
                  : `حاشیه‌ی ایمنی ${fa(r.safetyPct ?? 0, 1)}٪ — فروش تا این اندازه کم شود هنوز ضرر نمی‌کنید.`}
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
