"use client";

/**
 * مقایسه‌ی محصولات — ۲ تا ۴ محصول کنار هم: قیمت، سود و حاشیه، فروش و کانال‌ها، موجودی، نرخ تبدیل،
 * نظرها و نمودار فروش هفتگی. انتخاب‌ها در `localStorage` (`tools.compare`).
 * داده: `/api/admin/tools/compare` ← `lib/tools/compare-data.ts`؛ شاخص‌ها: `lib/tools/compare.ts`.
 * docs/features/tools.md بخش ۲۱
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star, X } from "lucide-react";
import { bestIndex, deriveCompare, type CompareRaw, type CompareRow } from "@/lib/tools/compare";
import { api, Card, Chips, ErrorText, PageHeader, SectionTitle, inputCls } from "../accounting/ui";
import { fa, useStored } from "./calc-inputs";

const MAX = 4;
const DAYS = ["30", "90", "180", "365"] as const;
type Days = (typeof DAYS)[number];

/** رنگ هر محصول به جایگاهش در انتخاب بسته است، نه رتبه‌اش — پالت اعتبارسنجی‌شده (dataviz، روشن/تاریک) */
const SERIES = [
  { stroke: "stroke-[#2a78d6] dark:stroke-[#3987e5]", fill: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  { stroke: "stroke-[#eb6834] dark:stroke-[#d95926]", fill: "bg-[#eb6834] dark:bg-[#d95926]" },
  { stroke: "stroke-[#1baf7a] dark:stroke-[#199e70]", fill: "bg-[#1baf7a] dark:bg-[#199e70]" },
  { stroke: "stroke-[#eda100] dark:stroke-[#c98500]", fill: "bg-[#eda100] dark:bg-[#c98500]" },
];

interface Picked { id: string; title: string }

export default function CompareClient() {
  const [s, setS, loaded] = useStored<{ picked: Picked[]; days: Days }>("tools.compare", { picked: [], days: "90" });
  const [state, setState] = useState<{ key: string; items: CompareRaw[] | null; error: string | null }>({ key: "", items: null, error: null });
  const key = `${s.picked.map((p) => p.id).join(",")}|${s.days}`;

  useEffect(() => {
    if (!loaded || s.picked.length === 0) return;
    let alive = true;
    api<{ items: CompareRaw[] }>(`/api/admin/tools/compare?ids=${encodeURIComponent(s.picked.map((p) => p.id).join(","))}&days=${s.days}`)
      .then((d) => alive && setState({ key, items: d.items, error: null }))
      .catch((e: Error) => alive && setState({ key, items: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [key, loaded, s.picked, s.days]);

  const rows = useMemo(() => (state.items ?? []).map((r) => deriveCompare(r, Number(s.days))), [state.items, s.days]);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const loading = s.picked.length > 0 && state.key !== key;

  return (
    <div className="space-y-6">
      <PageHeader
        title="مقایسه‌ی محصولات"
        help="toolsCompare"
        desc="دو تا چهار محصول را کنار هم ببینید: قیمت، سود و حاشیه‌ی سود، فروش در هر کانال، موجودی، نرخ تبدیل و نظر مشتری‌ها."
      />

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {s.picked.map((p, i) => (
            <span key={p.id} className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-xl bg-gray-100 py-1 pl-1 pr-2.5 text-xs font-bold dark:bg-white/5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SERIES[i].fill}`} />
              <span className="truncate">{p.title}</span>
              <button className="p-0.5 text-gray-400 hover:text-red-500" onClick={() => setS((x) => ({ ...x, picked: x.picked.filter((y) => y.id !== p.id) }))} aria-label="برداشتن">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        {s.picked.length < MAX && (
          <ProductSearch exclude={s.picked.map((p) => p.id)} onPick={(p) => setS((x) => ({ ...x, picked: [...x.picked, p].slice(0, MAX) }))} />
        )}
        <Chips<Days> value={s.days} onChange={(days) => setS((x) => ({ ...x, days }))} options={DAYS.map((d) => ({ value: d, label: `${fa(Number(d))} روز اخیر` }))} />
      </Card>

      {s.picked.length < 2 && <p className="text-xs text-gray-400">دست‌کم دو محصول انتخاب کنید.</p>}
      {state.error && state.key === key && <ErrorText>{state.error}</ErrorText>}
      {loading && <p className="text-xs text-gray-400">در حال خواندن فروش…</p>}
      {rows.length >= 2 && state.key === key && (
        <>
          <CompareTable rows={rows} days={Number(s.days)} />
          <WeeklyChart rows={rows} />
          <Notes rows={rows} />
        </>
      )}
    </div>
  );
}

// ── جدول ──────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  hint?: string;
  get: (r: CompareRow) => number | null;
  show: (v: number, r: CompareRow) => string;
  /** بزرگ‌تر بهتر است؛ undefined یعنی «بهترین» ندارد */
  higher?: boolean;
}

const pct = (x: number) => `${fa(x * 100, x < 0.01 ? 2 : 1)}٪`;

function metrics(days: number): { title: string; items: Metric[] }[] {
  return [
    {
      title: "قیمت و سود",
      items: [
        { label: "قیمت فعلی", get: (r) => r.price, show: (v, r) => (r.listPrice > v ? `${fa(v)} (از ${fa(r.listPrice)})` : fa(v)) },
        { label: "بهای میانگین واحد", hint: "بهای فعلی کالا در حسابداری", get: (r) => r.unitCost, show: (v) => fa(Math.round(v)) },
        { label: "سود هر واحد با قیمت فعلی", get: (r) => r.unitProfitNow, show: (v) => fa(Math.round(v)), higher: true },
        { label: `سود فروش‌های ${fa(days)} روز`, get: (r) => r.profit, show: (v) => fa(Math.round(v)), higher: true },
        { label: "حاشیه‌ی سود فروش‌ها", hint: "سود ÷ مبلغ فروش", get: (r) => r.margin, show: pct, higher: true },
      ],
    },
    {
      title: "فروش",
      items: [
        { label: "تعداد فروش", get: (r) => r.qty, show: (v) => fa(v), higher: true },
        { label: "مبلغ فروش", get: (r) => r.revenue, show: (v) => fa(Math.round(v)), higher: true },
        { label: "فروش روزانه", get: (r) => r.dailyQty, show: (v) => fa(v, v < 1 ? 2 : 1), higher: true },
        { label: "بازدید صفحه", get: (r) => r.views, show: (v) => fa(v), higher: true },
        { label: "نرخ تبدیل", hint: "سفارش آنلاین ÷ بازدید صفحه", get: (r) => r.conversion, show: pct, higher: true },
      ],
    },
    {
      title: "موجودی و نظر مشتری",
      items: [
        { label: "موجودی سایت", get: (r) => r.stock, show: (v) => fa(v) },
        { label: "موجودی چند روز فروش است", get: (r) => r.coverage, show: (v) => (v >= 999 ? "بیش از ۹۹۹" : fa(Math.round(v))) },
        { label: "امتیاز", get: (r) => (r.ratingCount > 0 ? r.ratingAvg : null), show: (v) => `${fa(v, 1)} از ۵`, higher: true },
        { label: "تعداد نظر", get: (r) => r.ratingCount, show: (v) => fa(v), higher: true },
      ],
    },
  ];
}

function CompareTable({ rows, days }: { rows: CompareRow[]; days: number }) {
  const channels = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) for (const c of r.channels) m.set(c.code, c.label);
    return [...m];
  }, [rows]);

  const line = (m: Metric) => {
    const values = rows.map(m.get);
    const best = m.higher === undefined ? null : bestIndex(values, m.higher);
    return (
      <tr key={m.label} className="border-t border-[var(--adm-border)]">
        <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-500" title={m.hint}>{m.label}</th>
        {values.map((v, i) => (
          <td key={rows[i].id} className={`px-2 py-2 text-left tabular-nums ${best === i ? "font-black" : ""}`}>
            {v === null ? <span className="text-gray-400">—</span> : m.show(v, rows[i])}
            {best === i && <Star className="mr-1 inline h-3 w-3 fill-current text-amber-500" aria-label="بهترین" />}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-xs">
          <thead>
            <tr>
              <th className="w-40" />
              {rows.map((r, i) => (
                <th key={r.id} className="px-2 pb-3 text-left align-bottom">
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="line-clamp-2 text-xs font-black">{r.title}</span>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SERIES[i].fill}`} />
                  </span>
                  {!r.isActive && <span className="block text-[10px] font-bold text-amber-600">غیرفعال</span>}
                </th>
              ))}
            </tr>
          </thead>
          {metrics(days).map((g) => (
            <tbody key={g.title}>
              <tr><td colSpan={rows.length + 1} className="px-2 pb-1 pt-4 text-[11px] font-black text-indigo-600 dark:text-indigo-400">{g.title}</td></tr>
              {g.items.map(line)}
            </tbody>
          ))}
          {channels.length > 0 && (
            <tbody>
              <tr><td colSpan={rows.length + 1} className="px-2 pb-1 pt-4 text-[11px] font-black text-indigo-600 dark:text-indigo-400">فروش در هر کانال (تعداد · مبلغ)</td></tr>
              {channels.map(([code, label]) => {
                const qtys = rows.map((r) => r.channels.find((c) => c.code === code)?.qty ?? 0);
                const best = bestIndex(qtys);
                return (
                  <tr key={code} className="border-t border-[var(--adm-border)]">
                    <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-500">{label}</th>
                    {rows.map((r, i) => {
                      const c = r.channels.find((x) => x.code === code);
                      return (
                        <td key={r.id} className={`px-2 py-2 text-left tabular-nums ${best === i ? "font-black" : ""}`}>
                          {c ? <>{fa(c.qty)} <span className="text-gray-400">· {fa(Math.round(c.revenue))}</span></> : <span className="text-gray-400">—</span>}
                          {best === i && <Star className="mr-1 inline h-3 w-3 fill-current text-amber-500" aria-label="بهترین" />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
      <p className="mt-3 text-[11px] text-gray-400">
        <Star className="ml-0.5 inline h-3 w-3 fill-current text-amber-500" aria-hidden /> بهترین عدد هر ردیف. مبلغ‌ها به تومان.
      </p>
    </Card>
  );
}

// ── نمودار فروش هفتگی ────────────────────────────────────────────────────

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 22, left: 34 };

function WeeklyChart({ rows }: { rows: CompareRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = rows[0]?.weekly.length ?? 0;
  const max = Math.max(1, ...rows.flatMap((r) => r.weekly));
  if (weeks < 2) return null;

  const x = (i: number) => PAD.left + (i / (weeks - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  // برچسب انتهای خط: حداقل ۱۲ واحد فاصله تا روی هم نیفتند
  const ends = rows.map((r, i) => ({ i, y: y(r.weekly[weeks - 1]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 12);

  return (
    <Card className="space-y-2 p-4">
      <SectionTitle title="فروش هفتگی (تعداد، همه‌ی کانال‌ها)" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {rows.map((r, i) => (
          <span key={r.id} className="inline-flex max-w-[14rem] items-center gap-1.5">
            <span className={`h-0.5 w-4 shrink-0 rounded ${SERIES[i].fill}`} />
            <span className="truncate text-gray-600 dark:text-gray-300">{r.title}</span>
          </span>
        ))}
      </div>
      <div className="relative" dir="ltr">
        <svg viewBox={`0 0 ${W + 28} ${H}`} className="w-full" role="img" aria-label="نمودار فروش هفتگی محصولات" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-gray-200 dark:stroke-white/10" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-gray-400 text-[10px]">{fa(t)}</text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="fill-gray-400 text-[10px]">{fa(weeks)} هفته پیش</text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-gray-400 text-[10px]">این هفته</text>
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-gray-300 dark:stroke-white/20" strokeWidth={1} />}
          {rows.map((r, i) => (
            <polyline
              key={r.id}
              points={r.weekly.map((v, k) => `${x(k)},${y(v)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={SERIES[i].stroke}
            />
          ))}
          {hover !== null && rows.map((r, i) => (
            <circle key={r.id} cx={x(hover)} cy={y(r.weekly[hover])} r={4} strokeWidth={2} className={`fill-white dark:fill-[#1a1f2e] ${SERIES[i].stroke}`} />
          ))}
          {ends.map((e) => (
            <text key={e.i} x={W - PAD.right + 4} y={e.y + 3} className="fill-gray-500 text-[10px] font-bold">{fa(rows[e.i].weekly[weeks - 1])}</text>
          ))}
          {Array.from({ length: weeks }, (_, k) => (
            <rect
              key={k}
              x={x(k) - (W - PAD.left - PAD.right) / (weeks - 1) / 2}
              y={0}
              width={(W - PAD.left - PAD.right) / (weeks - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(k)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-[var(--adm-border)] bg-white px-2.5 py-1.5 text-[11px] shadow-lg dark:bg-[#1a1f2e]"
            style={x(hover) > W / 2 ? { right: `${((W + 28 - x(hover)) / (W + 28)) * 100 + 2}%` } : { left: `${(x(hover) / (W + 28)) * 100 + 2}%` }}
            dir="rtl"
          >
            <p className="mb-1 font-bold text-gray-500">{hover === weeks - 1 ? "این هفته" : `${fa(weeks - 1 - hover)} هفته پیش`}</p>
            {rows.map((r, i) => (
              <p key={r.id} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${SERIES[i].fill}`} />
                <span className="max-w-[10rem] truncate">{r.title}</span>
                <b className="mr-auto pr-2 tabular-nums">{fa(r.weekly[hover])}</b>
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── توضیح‌ها ──────────────────────────────────────────────────────────────

function Notes({ rows }: { rows: CompareRow[] }) {
  const noViews = rows.every((r) => r.views === null);
  const partialCost = rows.filter((r) => r.qty > 0 && r.costKnownQty < r.qty);
  const noCost = rows.filter((r) => r.qty > 0 && r.profit === null);
  const variants = rows.some((r) => r.hasVariants);
  return (
    <ul className="list-disc space-y-1 pr-5 text-[11px] leading-5 text-gray-500">
      {noViews && <li>آمار بازدید وصل نیست، پس بازدید و نرخ تبدیل خالی است. از «کارتابل ← آمار بازدید» وصلش کنید.</li>}
      {!noViews && <li>بازدید از میان ۱۰۰۰ صفحه‌ی پربازدید بازه خوانده می‌شود؛ صفحه‌ی خیلی کم‌بازدید صفر دیده می‌شود.</li>}
      {partialCost.length > 0 && <li>بهای فروش‌هایی که روی سفارش ثبت نشده (و همه‌ی فروش بازارگاه‌ها) با بهای میانگین فعلی کالا حساب شد.</li>}
      {noCost.length > 0 && <li>{noCost.map((r) => r.title).join("، ")}: بهای تمام‌شده در حسابداری ندارد، پس سود فروش حساب نشد.</li>}
      {variants && <li>محصول رنگ و سایزدار جمع همه‌ی تنوع‌هایش است.</li>}
    </ul>
  );
}

// ── انتخاب محصول ─────────────────────────────────────────────────────────

function ProductSearch({ exclude, onPick }: { exclude: string[]; onPick: (p: Picked) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Picked[]>([]);
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
        .then((x: { items: Picked[] }) => setItems(x.items ?? []))
        .catch(() => setItems([]));
    }, 300);
  }, [q]);

  const shown = items.filter((p) => !exclude.includes(p.id));
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input className={`${inputCls} pr-9`} placeholder="جستجو و افزودن محصول برای مقایسه" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--adm-border)] bg-white shadow-lg dark:bg-[#1a1f2e]">
          {shown.map((p) => (
            <button
              key={p.id}
              className="block w-full truncate px-3 py-2 text-right text-xs hover:bg-gray-50 dark:hover:bg-white/5"
              onClick={() => { onPick({ id: p.id, title: p.title }); setQ(""); setItems([]); }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
