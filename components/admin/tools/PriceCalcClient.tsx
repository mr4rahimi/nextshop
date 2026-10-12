"use client";

/**
 * ماشین‌حساب قیمت و سود — ابزار سریع بدون جدول؛ ورودی‌ها و کانال‌ها در
 * `localStorage` (`tools.priceCalc`) می‌مانند. منطق: `lib/tools/price-calc.ts`.
 * docs/features/tools.md بخش ۸
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import {
  DEFAULT_CHANNEL, DEFAULT_INPUT, calcChannel,
  type CalcInput, type Channel, type ChannelResult, type Rounding, type TargetMode,
} from "@/lib/tools/price-calc";
import { Card, Field, PageHeader, SectionTitle, Segmented, btn, inputCls } from "../accounting/ui";
import { Metric, MoneyInput, PctInput, fa, toman } from "./calc-inputs";

const STORE_KEY = "tools.priceCalc";

interface PickedProduct { id: string; title: string; price: number; salePrice: number | null }

function load(): { input: CalcInput; channels: Channel[] } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const x = JSON.parse(raw) as { input?: Partial<CalcInput>; channels?: Channel[] };
      return {
        input: { ...DEFAULT_INPUT, ...(x.input ?? {}) },
        channels: Array.isArray(x.channels) && x.channels.length ? x.channels.map((c) => ({ ...DEFAULT_CHANNEL, ...c })) : [DEFAULT_CHANNEL],
      };
    }
  } catch {}
  return { input: DEFAULT_INPUT, channels: [DEFAULT_CHANNEL] };
}

const ROUNDING: { value: Rounding; label: string }[] = [
  { value: "NONE", label: "بدون گرد کردن" },
  { value: "R1000", label: "هزار تومان" },
  { value: "R10000", label: "ده هزار تومان" },
  { value: "R100000", label: "صد هزار تومان" },
  { value: "END900", label: "ختم به ۹۰۰" },
];

export default function PriceCalcClient() {
  const [input, setInput] = useState<CalcInput>(DEFAULT_INPUT);
  const [channels, setChannels] = useState<Channel[]>([DEFAULT_CHANNEL]);
  const [loaded, setLoaded] = useState(false);
  const [product, setProduct] = useState<PickedProduct | null>(null);

  useEffect(() => {
    const x = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage فقط بعد از mount در دسترس است
    setInput(x.input);
    setChannels(x.channels);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ input, channels }));
    } catch {}
  }, [input, channels, loaded]);

  const set = (p: Partial<CalcInput>) => setInput((s) => ({ ...s, ...p }));
  const setCh = (id: string, p: Partial<Channel>) => setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const results = useMemo(() => channels.map((c) => calcChannel(input, c)), [input, channels]);
  const currentPrice = product ? product.salePrice ?? product.price : null;

  // ورودی درصدها متن خودشان را از مقدار اولیه می‌گیرند؛ پیش از خواندن localStorage رسم نشوند
  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  function addChannel() {
    setChannels((cs) => [...cs, { ...DEFAULT_CHANNEL, id: `c${Date.now().toString(36)}`, name: `کانال ${fa(cs.length + 1)}` }]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ماشین‌حساب قیمت و سود"
        help="toolsPriceCalc"
        desc="از قیمت خرید و کارمزدها قیمت فروش را حساب کنید، یا ببینید با یک قیمت چقدر سود می‌ماند — برای سایت و هر بازار آنلاین کنار هم."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle title="کالا" />
            <ProductPicker value={product} onChange={setProduct} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="قیمت خرید هر واحد (تومان)">
                <MoneyInput value={input.cost} onChange={(cost) => set({ cost })} />
              </Field>
              <Field label="هزینه‌های جانبی هر واحد" hint="حمل تا انبار، بسته‌بندی، …">
                <MoneyInput value={input.extraCost} onChange={(extraCost) => set({ extraCost })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle title="چه چیزی را حساب کنم" />
            <Segmented
              value={input.mode}
              onChange={(mode) => set({ mode })}
              options={[{ value: "TARGET", label: "قیمت از سود دلخواه" }, { value: "PRICE", label: "سود از قیمت فروش" }]}
            />
            {input.mode === "TARGET" ? (
              <>
                <Field label="سود دلخواه">
                  <Segmented<TargetMode>
                    value={input.targetMode}
                    onChange={(targetMode) => set({ targetMode, targetValue: targetMode === "AMOUNT" ? 100_000 : 20 })}
                    options={[
                      { value: "MARGIN", label: "٪ از قیمت فروش" },
                      { value: "MARKUP", label: "٪ روی قیمت خرید" },
                      { value: "AMOUNT", label: "مبلغ ثابت" },
                    ]}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={input.targetMode === "AMOUNT" ? "سود هر واحد (تومان)" : "درصد سود"}
                    hint={input.targetMode === "MARGIN" ? "حاشیه‌ی سود: ۲۰٪ یعنی از هر ۱۰۰ تومان فروش ۲۰ تومان سود" : input.targetMode === "MARKUP" ? "مارک‌آپ: ۲۵٪ یعنی قیمت خرید + یک‌چهارم آن" : undefined}
                  >
                    {input.targetMode === "AMOUNT" ? (
                      <MoneyInput value={input.targetValue} onChange={(targetValue) => set({ targetValue })} />
                    ) : (
                      <PctInput key={input.targetMode} value={input.targetValue} max={input.targetMode === "MARGIN" ? 99 : 1000} onChange={(targetValue) => set({ targetValue })} />
                    )}
                  </Field>
                  <Field label="گرد کردن قیمت" hint="همیشه به بالا — سود از هدف کمتر نمی‌شود">
                    <select className={inputCls} value={input.rounding} onChange={(e) => set({ rounding: e.target.value as Rounding })}>
                      {ROUNDING.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            ) : (
              <Field label="قیمت فروش به مشتری (تومان)">
                <div className="flex gap-2">
                  <MoneyInput value={input.price} onChange={(price) => set({ price })} />
                  {currentPrice !== null && (
                    <button className={btn.small} onClick={() => set({ price: currentPrice })}>قیمت فعلی</button>
                  )}
                </div>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="مالیات بر ارزش افزوده" hint="اگر قیمت فروش شامل مالیات است و سهمش را می‌پردازید. نرخ را با حسابدارتان چک کنید.">
                <div className="flex items-center gap-2">
                  <Segmented value={input.vatEnabled ? "on" : "off"} onChange={(v) => set({ vatEnabled: v === "on" })} options={[{ value: "off", label: "ندارد" }, { value: "on", label: "دارد" }]} />
                  {input.vatEnabled && <div className="w-24"><PctInput value={input.vatPct} max={50} onChange={(vatPct) => set({ vatPct })} /></div>}
                </div>
              </Field>
              <Field label="حداقل سود در تخفیف (تومان)" hint="برای «بیشترین تخفیف ممکن»؛ ۰ یعنی تا سربه‌سر">
                <MoneyInput value={input.minProfit} onChange={(minProfit) => set({ minProfit })} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle
              title="کانال‌های فروش"
              actions={
                <button className={btn.small} onClick={addChannel}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  کانال
                </button>
              }
            />
            <p className="-mt-1 text-[11px] leading-5 text-gray-400">
              کارمزد هر بازار را از قرارداد یا پنل فروشندگی خودتان وارد کنید؛ اینجا ذخیره می‌ماند. کارمزد درگاه و هزینه‌ی ارسالی که خودتان می‌دهید را هم بنویسید.
            </p>
            {channels.map((c) => (
              <div key={c.id} className="space-y-2 rounded-xl border border-[var(--adm-border)] p-3">
                <div className="flex items-center gap-2">
                  <input className={`${inputCls} font-bold`} value={c.name} maxLength={40} onChange={(e) => setCh(c.id, { name: e.target.value })} />
                  {channels.length > 1 && (
                    <button className="shrink-0 p-1.5 text-gray-400 hover:text-red-500" onClick={() => setChannels((cs) => cs.filter((x) => x.id !== c.id))} aria-label="حذف کانال">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="کارمزد ٪"><PctInput value={c.commissionPct} onChange={(commissionPct) => setCh(c.id, { commissionPct })} /></Field>
                  <Field label="کارمزد ثابت"><MoneyInput value={c.commissionFixed} onChange={(commissionFixed) => setCh(c.id, { commissionFixed })} /></Field>
                  <Field label="درگاه ٪"><PctInput value={c.gatewayPct} onChange={(gatewayPct) => setCh(c.id, { gatewayPct })} /></Field>
                  <Field label="ارسال با شما"><MoneyInput value={c.shippingCost} onChange={(shippingCost) => setCh(c.id, { shippingCost })} /></Field>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {input.cost <= 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">قیمت خرید را وارد کنید.</p>}
          {results.map((r) => (
            <ResultCard key={r.channel.id} r={r} mode={input.mode} currentPrice={currentPrice} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ r, mode, currentPrice }: { r: ChannelResult; mode: CalcInput["mode"]; currentPrice: number | null }) {
  const P = r.price ?? 0;
  const loss = P > 0 && r.profit < 0;
  const parts = P > 0
    ? [
        { label: "بهای تمام‌شده", value: r.unitCost, cls: "bg-slate-400" },
        { label: "کارمزد", value: r.commission + r.gateway, cls: "bg-amber-400" },
        { label: "مالیات", value: r.vat, cls: "bg-sky-400" },
        { label: loss ? "زیان" : "سود", value: Math.abs(r.profit), cls: loss ? "bg-red-500" : "bg-emerald-500" },
      ]
    : [];
  const barTotal = parts.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black">{r.channel.name || "کانال"}</p>
        {r.k <= 0 && <span className="text-[11px] font-bold text-red-600">کارمزدها از کل قیمت بیشترند</span>}
      </div>

      {r.price === null ? (
        <p className="text-xs font-bold text-red-600">با این کارمزدها رسیدن به این درصد سود ممکن نیست؛ درصد را کمتر کنید.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-gray-400">{mode === "TARGET" ? "قیمت فروش پیشنهادی" : "قیمت فروش"}</p>
              <p className="text-2xl font-black tabular-nums">{toman(P)}</p>
              {currentPrice !== null && mode === "TARGET" && P > 0 && (
                <p className="text-[11px] text-gray-400">
                  قیمت فعلی سایت {toman(currentPrice)} ({P >= currentPrice ? "+" : "−"}{fa(Math.abs(((P - currentPrice) / currentPrice) * 100), 1)}٪)
                </p>
              )}
            </div>
            <div className="text-left">
              <p className="text-[11px] font-bold text-gray-400">{loss ? "زیان هر واحد" : "سود خالص هر واحد"}</p>
              <p className={`text-xl font-black tabular-nums ${loss ? "text-red-600" : "text-emerald-600"}`}>{toman(Math.abs(r.profit))}</p>
            </div>
          </div>

          {parts.length > 0 && (
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                {parts.map((p) => p.value > 0 && <div key={p.label} className={p.cls} style={{ width: `${(p.value / barTotal) * 100}%` }} title={p.label} />)}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
                {parts.map((p) => (
                  <span key={p.label} className="inline-flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${p.cls}`} />
                    {p.label} {fa(Math.round(p.value))}
                  </span>
                ))}
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Metric label="حاشیه‌ی سود" value={`${fa(r.marginPct, 1)}٪`} hint="سود ÷ قیمت فروش" />
            <Metric label="مارک‌آپ" value={r.unitCost > 0 ? `${fa(r.markupPct, 1)}٪` : "—"} hint="سود ÷ بهای تمام‌شده" />
            <Metric label="نقطه‌ی سربه‌سر" value={r.breakEven ? fa(Math.ceil(r.breakEven)) : "—"} hint="قیمتی که سود صفر است" />
            <Metric label="بیشترین تخفیف" value={`${fa(Math.floor(r.maxDiscountPct * 10) / 10, 1)}٪`} hint="بدون رفتن زیر حداقل سود" />
          </dl>
        </>
      )}
    </Card>
  );
}

/** انتخاب محصول فقط برای مقایسه با قیمت فعلی سایت — چیزی ذخیره نمی‌شود */
function ProductPicker({ value, onChange }: { value: PickedProduct | null; onChange: (p: PickedProduct | null) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedProduct[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- پاک کردن نتیجه‌ی جستجوی قبلی
      setItems([]);
      return;
    }
    timer.current = setTimeout(() => {
      fetch(`/api/admin/tools/products?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((x: { items: PickedProduct[] }) => setItems(x.items ?? []))
        .catch(() => setItems([]));
    }, 300);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-500/10">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold">{value.title}</p>
          <p className="text-[11px] text-gray-500">قیمت فعلی سایت: {toman(value.salePrice ?? value.price)}</p>
        </div>
        <button className="p-1 text-gray-400 hover:text-gray-700" onClick={() => onChange(null)} aria-label="برداشتن محصول">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input className={`${inputCls} pr-9`} placeholder="مقایسه با قیمت یک محصول سایت (اختیاری)" value={q} onChange={(e) => setQ(e.target.value)} />
      {items.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--adm-border)] bg-white shadow-lg dark:bg-[#1a1f2e]">
          {items.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-xs hover:bg-gray-50 dark:hover:bg-white/5"
              onClick={() => { onChange(p); setQ(""); setItems([]); }}
            >
              <span className="truncate">{p.title}</span>
              <span className="shrink-0 tabular-nums text-gray-500">{fa(p.salePrice ?? p.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
