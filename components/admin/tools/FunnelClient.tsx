"use client";

/**
 * قیف فروش و نرخ تبدیل — نرخ هر مرحله، هزینه‌ی هر نفر، بزرگ‌ترین ریزش و «اگر نرخ این مرحله
 * بهتر شود». ابزار سریع بدون جدول؛ ورودی‌ها در `localStorage` (`tools.funnel`).
 * منطق: `lib/tools/funnel.ts`. docs/features/tools.md بخش ۱۲
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_FUNNEL, MAX_STAGES, calcFunnel, whatIf,
  type FunnelInput, type FunnelResult, type FunnelStage,
} from "@/lib/tools/funnel";
import { Card, Field, PageHeader, SectionTitle, btn, inputCls } from "../accounting/ui";
import { Metric, MoneyInput, PctInput, fa, toman } from "./calc-inputs";

const STORE_KEY = "tools.funnel";

const pct = (x: number) => `${fa(x * 100, x < 0.01 ? 2 : 1)}٪`;

function load(): FunnelInput {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const x = JSON.parse(raw) as Partial<FunnelInput>;
      return {
        ...DEFAULT_FUNNEL,
        ...x,
        stages: Array.isArray(x.stages) && x.stages.length >= 2 ? x.stages.slice(0, MAX_STAGES) : DEFAULT_FUNNEL.stages,
      };
    }
  } catch {}
  return DEFAULT_FUNNEL;
}

export default function FunnelClient() {
  const [input, setInput] = useState<FunnelInput>(DEFAULT_FUNNEL);
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

  const set = (p: Partial<FunnelInput>) => setInput((s) => ({ ...s, ...p }));
  const setStage = (id: string, p: Partial<FunnelStage>) =>
    setInput((s) => ({ ...s, stages: s.stages.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const r = useMemo(() => calcFunnel(input), [input]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  function addStage() {
    setInput((s) => {
      // مرحله‌ی تازه پیش از آخرین مرحله (فروش) می‌نشیند
      const st = [...s.stages];
      st.splice(st.length - 1, 0, { id: `s${Date.now().toString(36)}`, name: "", count: 0 });
      return { ...s, stages: st };
    });
  }

  const first = input.stages[0]?.count ?? 0;
  const lastName = input.stages[input.stages.length - 1]?.name || "فروش";

  return (
    <div className="space-y-6">
      <PageHeader
        title="قیف فروش و نرخ تبدیل"
        help="toolsFunnel"
        desc="تعداد هر مرحله را بدهید (نمایش، کلیک، تماس، فروش) تا نرخ تبدیل هر مرحله، هزینه‌ی هر مشتری و جایی که بیشترین مشتری را از دست می‌دهید معلوم شود."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle
              title="مرحله‌ها"
              actions={
                input.stages.length < MAX_STAGES && (
                  <button className={btn.small} onClick={addStage}>
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    مرحله
                  </button>
                )
              }
            />
            <p className="-mt-1 text-[11px] leading-5 text-gray-400">
              به ترتیب از بالای قیف. نام مرحله‌ها را به دلخواه عوض کنید؛ مثلاً «افزودن به سبد» یا «پیام دایرکت».
            </p>
            {input.stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-400">{fa(i + 1)}</span>
                <input className={`${inputCls} min-w-0 flex-1`} placeholder="نام مرحله" value={s.name} maxLength={40} onChange={(e) => setStage(s.id, { name: e.target.value })} />
                <div className="w-32 shrink-0 sm:w-40">
                  <MoneyInput value={s.count} onChange={(count) => setStage(s.id, { count })} />
                </div>
                <button
                  className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 disabled:invisible"
                  disabled={input.stages.length <= 2}
                  onClick={() => setInput((x) => ({ ...x, stages: x.stages.filter((y) => y.id !== s.id) }))}
                  aria-label="حذف مرحله"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="هزینه و درآمد (اختیاری)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="هزینه‌ی کل تبلیغ (تومان)" hint="برای هزینه‌ی هر کلیک، هر تماس و هر فروش">
                <MoneyInput value={input.cost} onChange={(cost) => set({ cost })} />
              </Field>
              <Field label="میانگین مبلغ هر فروش (تومان)" hint="برای درآمد و ROAS">
                <MoneyInput value={input.avgOrder} onChange={(avgOrder) => set({ avgOrder })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {first <= 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              تعداد مرحله‌ی اول (مثلاً نمایش) را وارد کنید.
            </p>
          ) : (
            <>
              <Card className="space-y-4 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400">نرخ تبدیل کل</p>
                    <p className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{r.overall !== null ? pct(r.overall) : "—"}</p>
                    {r.overall !== null && r.overall > 0 && (
                      <p className="text-[11px] text-gray-500">یعنی از هر {fa(Math.round(1 / r.overall))} {input.stages[0].name || "نفر"}، یک {lastName}</p>
                    )}
                  </div>
                  {r.rows[r.rows.length - 1].costPer !== null && (
                    <div className="text-left">
                      <p className="text-[11px] font-bold text-gray-400">هزینه‌ی هر {lastName}</p>
                      <p className="text-xl font-black tabular-nums">{toman(r.rows[r.rows.length - 1].costPer!)}</p>
                    </div>
                  )}
                </div>
                <FunnelChart r={r} />
              </Card>

              {(r.rows.some((x) => x.costPer !== null) || r.revenue !== null) && (
                <Card className="space-y-3 p-4">
                  <SectionTitle title="هزینه‌ی هر نفر" />
                  <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {r.rows.map((x, i) => x.costPer !== null && i > 0 && (
                      <Metric key={x.stage.id} label={`هر ${x.stage.name || `مرحله‌ی ${fa(i + 1)}`}`} value={toman(x.costPer)} hint="هزینه‌ی کل ÷ تعداد این مرحله" />
                    ))}
                    {r.revenue !== null && <Metric label="درآمد" value={toman(r.revenue)} hint="تعداد آخرین مرحله × میانگین مبلغ" />}
                    {r.roas !== null && <Metric label="ROAS" value={`${fa(r.roas, 1)}×`} hint="درآمد ÷ هزینه؛ سود واقعی را در ابزار ROI تبلیغات ببینید" />}
                  </dl>
                </Card>
              )}

              {r.weakest !== null && <WhatIf input={input} r={r} lastName={lastName} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * قیف با پهنای لگاریتمی — با پهنای خطی، ۳ فروش از ۱۰۰۰ نمایش دیده نمی‌شد. نرخ‌ها عدد دقیق‌اند،
 * پهنا فقط برای نشان دادن ترتیب است.
 */
function FunnelChart({ r }: { r: FunnelResult }) {
  const first = r.rows[0]?.stage.count ?? 0;
  const width = (n: number) => (first > 0 ? Math.max(12, (Math.log10(Math.max(n, 0) + 1) / Math.log10(first + 1)) * 100) : 12);
  return (
    <div className="space-y-1">
      {r.rows.map((x, i) => {
        const weak = r.weakest === i;
        return (
          <div key={x.stage.id}>
            {i > 0 && (
              <p className={`py-0.5 text-center text-[11px] ${weak ? "font-black text-red-600" : "text-gray-500"}`}>
                {x.fromPrev !== null ? `↓ ${pct(x.fromPrev)}` : "↓"}
                {x.dropped > 0 && ` · ${fa(x.dropped)} نفر نرسیدند`}
                {weak && " · بزرگ‌ترین ریزش"}
                {x.exceedsPrev && " · بیشتر از مرحله‌ی قبل!"}
              </p>
            )}
            <div
              className={`mx-auto flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs text-white ${weak ? "bg-red-500" : "bg-indigo-500"}`}
              style={{ width: `${width(x.stage.count)}%`, opacity: 1 - i * 0.08 }}
            >
              <span className="truncate font-bold">{x.stage.name || `مرحله‌ی ${fa(i + 1)}`}</span>
              <span className="shrink-0 font-black tabular-nums">{fa(x.stage.count)}</span>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[10px] text-gray-400">پهنای نوارها به‌اندازه‌ی واقعی نیست تا مرحله‌های کوچک هم دیده شوند.</p>
    </div>
  );
}

function WhatIf({ input, r, lastName }: { input: FunnelInput; r: FunnelResult; lastName: string }) {
  const [index, setIndex] = useState(r.weakest ?? 1);
  const i = Math.min(index, input.stages.length - 1);
  const current = r.rows[i]?.fromPrev ?? 0;
  const [ratePct, setRatePct] = useState(() => Math.round(current * 200 * 10) / 10 || 10);
  const out = whatIf(input, i, ratePct / 100);
  const last = input.stages[input.stages.length - 1].count;
  const label = (k: number) => input.stages[k].name || `مرحله‌ی ${fa(k + 1)}`;

  return (
    <Card className="space-y-3 p-4">
      <SectionTitle title="اگر نرخ یک مرحله بهتر شود" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="مرحله">
          <select
            className={inputCls}
            value={i}
            onChange={(e) => {
              const k = Number(e.target.value);
              setIndex(k);
              setRatePct(Math.round((r.rows[k]?.fromPrev ?? 0.05) * 200 * 10) / 10 || 10);
            }}
          >
            {input.stages.map((_, k) => k > 0 && (
              <option key={k} value={k}>{label(k - 1)} ← {label(k)}</option>
            ))}
          </select>
        </Field>
        <Field label="نرخ تازه" hint={`نرخ فعلی ${pct(current)}`}>
          <PctInput key={i} value={ratePct} onChange={setRatePct} />
        </Field>
      </div>
      {out !== null ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-6 dark:bg-emerald-500/10">
          با همین تعداد {input.stages[0].name || "مرحله‌ی اول"}، به‌جای {fa(last)} {lastName}، حدود <b className="text-base tabular-nums">{fa(out, 1)}</b> {lastName}
          {input.cost > 0 && out > 0 && <> و هزینه‌ی هر {lastName} <b>{toman(input.cost / out)}</b></>} می‌شود.
        </p>
      ) : (
        <p className="text-xs text-gray-400">برای این مرحله عدد کافی وارد نشده.</p>
      )}
    </Card>
  );
}
