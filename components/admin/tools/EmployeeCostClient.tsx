"use client";

/**
 * هزینه‌ی واقعی کارمند برای کارفرما — حقوق، بیمه، عیدی، سنوات و هزینه‌های جانبی. نرخ‌ها ورودی‌اند.
 * ابزار سریع بدون جدول؛ ورودی‌ها در `localStorage` (`tools.employee`).
 * منطق: `lib/tools/employee-cost.ts`. docs/features/tools.md بخش ۲۰
 */

import { useMemo } from "react";
import { DEFAULT_EMPLOYEE, calcEmployee, type EmployeeInput } from "@/lib/tools/employee-cost";
import { Card, Field, PageHeader, SectionTitle } from "../accounting/ui";
import { DecimalInput, MoneyInput, PctInput, fa, toman, useStored } from "./calc-inputs";

const PART_TONE: Record<string, string> = {
  pay: "bg-slate-400",
  insurance: "bg-sky-500",
  bonus: "bg-amber-400",
  severance: "bg-orange-500",
  extra: "bg-violet-500",
};

export default function EmployeeCostClient() {
  const [input, setInput, loaded] = useStored<EmployeeInput>("tools.employee", DEFAULT_EMPLOYEE);
  const set = (p: Partial<EmployeeInput>) => setInput((s) => ({ ...s, ...p }));
  const r = useMemo(() => calcEmployee(input), [input]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="هزینه‌ی واقعی کارمند"
        help="toolsEmployee"
        desc="یک کارمند با بیمه، عیدی، سنوات و هزینه‌های جانبی ماهانه چقدر برای شما تمام می‌شود — و چند فروش بیشتر لازم دارد."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="پرداخت ماهانه" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="حقوق پایه (تومان)">
                <MoneyInput value={input.baseSalary} onChange={(baseSalary) => set({ baseSalary })} />
              </Field>
              <Field label="مزایای مشمول بیمه" hint="حق مسکن، بن خواربار، …">
                <MoneyInput value={input.insurableBenefits} onChange={(insurableBenefits) => set({ insurableBenefits })} />
              </Field>
              <Field label="مزایای دیگر" hint="مثلاً حق اولاد">
                <MoneyInput value={input.otherBenefits} onChange={(otherBenefits) => set({ otherBenefits })} />
              </Field>
              <Field label="هزینه‌های جانبی ماهانه" hint="ناهار، ایاب‌وذهاب، تجهیزات، اشتراک نرم‌افزار">
                <MoneyInput value={input.extraMonthly} onChange={(extraMonthly) => set({ extraMonthly })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="نرخ‌ها" />
            <p className="-mt-1 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
              نرخ‌ها هر سال عوض می‌شوند؛ پیش‌فرض‌ها فقط نقطه‌ی شروع‌اند. با حسابدارتان چک کنید.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="بیمه‌ی سهم کارفرما" hint="روی حقوق و مزایای مشمول">
                <PctInput value={input.insurancePct} onChange={(insurancePct) => set({ insurancePct })} />
              </Field>
              <Field label="عیدی و پاداش سالانه" hint="به ماه حقوق پایه">
                <DecimalInput value={input.bonusMonths} max={24} suffix="ماه" onChange={(bonusMonths) => set({ bonusMonths })} />
              </Field>
              <Field label="سنوات سالانه" hint="به ماه حقوق پایه">
                <DecimalInput value={input.severanceMonths} max={12} suffix="ماه" onChange={(severanceMonths) => set({ severanceMonths })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="فروش لازم (اختیاری)" />
            <Field label="سود هر فروش (تومان)" hint="برای «این کارمند چند فروش در ماه لازم دارد»">
              <MoneyInput value={input.profitPerSale} onChange={(profitPerSale) => set({ profitPerSale })} />
            </Field>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {input.baseSalary <= 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">حقوق پایه را وارد کنید.</p>
          ) : (
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-gray-400">هزینه‌ی ماهانه برای کارفرما</p>
                  <p className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{toman(r.monthly)}</p>
                  {r.overRatio !== null && <p className="text-[11px] text-gray-400">{fa(r.overRatio, 2)} برابر حقوق و مزایایی که کارمند می‌بیند</p>}
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-gray-400">سالانه</p>
                  <p className="text-xl font-black tabular-nums">{toman(r.yearly)}</p>
                </div>
              </div>

              <div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                  {r.parts.map((p) => p.value > 0 && <div key={p.key} className={PART_TONE[p.key]} style={{ width: `${(p.value / r.monthly) * 100}%` }} title={p.label} />)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
                  {r.parts.map((p) => (
                    <span key={p.key} className="flex items-start gap-1.5">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PART_TONE[p.key]}`} />
                      <span>
                        {p.label}
                        <span className="block font-bold tabular-nums">{fa(Math.round(p.value))}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {r.salesNeeded !== null && (
                <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-6 dark:bg-emerald-500/10">
                  این کارمند وقتی به‌صرفه است که دست‌کم <b className="text-base tabular-nums">{fa(r.salesNeeded)}</b> فروش بیشتر در ماه بیاورد
                  (یا همین‌قدر کار را جای فروش بیشتر انجام دهد).
                </p>
              )}
              <p className="text-[11px] leading-5 text-gray-400">عیدی و سنوات سالانه پرداخت می‌شوند ولی اینجا ماهانه‌شده آمده‌اند تا هزینه‌ی واقعی هر ماه دیده شود.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
