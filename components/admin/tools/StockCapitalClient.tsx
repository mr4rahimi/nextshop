"use client";

/**
 * سرمایه‌ی درگیر در موجودی — ارزش موجودی، سرمایه‌ی خوابیده، کالاهای پرفروش/کم‌گردش/راکد/بی‌فروش،
 * و «کدام کالاها سرمایه را قفل کرده‌اند». با حسابداری داخلی از کاردکس؛ بی‌آن جدول دستی.
 * منطق: `lib/tools/stock-velocity.ts`. docs/features/tools.md بخش ۱۵
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import {
  CLASS_LABEL, DEFAULT_CLASS, capitalRows,
  type CapitalRow, type ClassSettings, type StockClass, type VelocityRow,
} from "@/lib/tools/stock-velocity";
import { downloadCsv } from "../accounting/reports/kit";
import { Card, Chips, ErrorText, Field, PageHeader, SectionTitle, Stat, btn, inputCls } from "../accounting/ui";
import { DecimalInput, MoneyInput, fa, toman, useStored } from "./calc-inputs";
import {
  CLASS_BADGE, CLASS_TONE, NoAccountingNotice, StockFilters, daysText, lastSaleText, matchQuery, useStockData,
  type WindowDays,
} from "./stock-shared";

interface Settings extends ClassSettings {
  days: WindowDays;
  warehouseId: string;
}

const CLASSES: StockClass[] = ["FAST", "SLOW", "STALE", "DEAD"];
const PAGE = 100;

/** «میلیون تومان» برای عددهای بزرگ خلاصه */
const short = (n: number) => (n >= 1e9 ? `${fa(n / 1e9, 1)} میلیارد` : n >= 1e6 ? `${fa(n / 1e6, 1)} میلیون` : fa(Math.round(n)));

export default function StockCapitalClient() {
  const [s, setS, loaded] = useStored<Settings>("tools.stockCapital", { ...DEFAULT_CLASS, days: "90", warehouseId: "" });
  const { data, error, loading } = useStockData(s.days, s.warehouseId);

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const internal = data?.mode === "INTERNAL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="سرمایه‌ی درگیر در موجودی"
        help="toolsStockCapital"
        desc="چقدر پول در انبار است، چقدرش بیش از نیاز خوابیده، و کدام کالاها سرمایه را قفل کرده‌اند."
      />

      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <p className="text-xs text-gray-400">در حال خواندن انبار…</p>}
      {data && !internal && (
        <>
          <NoAccountingNotice what="ارزش و فروش کالاها" />
          <ManualCapital s={s} setS={setS} />
        </>
      )}
      {internal && !data.withCost && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          ارزش موجودی از بهای تمام‌شده حساب می‌شود؛ برای دیدن آن دسترسی «دیدن بهای تمام‌شده» در حسابداری لازم است.
        </p>
      )}
      {internal && data.withCost && <Report s={s} setS={setS} rows={data.rows} warehouses={data.warehouses} loading={loading} windowDays={Number(s.days)} />}
    </div>
  );
}

function ClassFields({ s, setS }: { s: Settings; setS: (f: (x: Settings) => Settings) => void }) {
  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="پرفروش: موجودی کمتر از" hint="روز فروش">
        <DecimalInput value={s.fastDays} max={3650} suffix="روز" onChange={(fastDays) => set({ fastDays })} />
      </Field>
      <Field label="راکد: موجودی بیشتر از" hint="روز فروش">
        <DecimalInput value={s.staleDays} max={3650} suffix="روز" onChange={(staleDays) => set({ staleDays })} />
      </Field>
      <Field label="نیاز انبار" hint="بیش از این‌همه روز فروش «خوابیده» است">
        <DecimalInput value={s.needDays} max={3650} suffix="روز" onChange={(needDays) => set({ needDays })} />
      </Field>
    </div>
  );
}

// ── گزارش از کاردکس ──────────────────────────────────────────────────────

function Report({
  s, setS, rows, warehouses, loading, windowDays,
}: {
  s: Settings;
  setS: (f: (x: Settings) => Settings) => void;
  rows: VelocityRow[];
  warehouses: { id: string; name: string }[];
  loading: boolean;
  windowDays: number;
}) {
  const [filter, setFilter] = useState<StockClass | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  // ناموجودها ارزشی ندارند و فقط فهرست را شلوغ می‌کنند
  const all = useMemo(() => capitalRows(rows, windowDays, s).filter((r) => r.cls !== "OUT"), [rows, windowDays, s]);
  const shown = useMemo(
    () => all.filter((r) => (filter === "ALL" || r.cls === filter) && matchQuery(r.row, q)).sort((a, b) => b.locked - a.locked || b.value - a.value),
    [all, filter, q],
  );

  function exportCsv() {
    downloadCsv(
      `stock-capital-${s.days}d`,
      ["کد", "کالا", "دسته", "موجودی", "بهای واحد", "ارزش", "سرمایه‌ی خوابیده", "فروش روزانه", "روز پوشش", "آخرین فروش"],
      shown.map((r) => [
        r.row.code, r.row.title, CLASS_LABEL[r.cls], r.row.qty, r.row.unitCost ?? 0, Math.round(r.value), Math.round(r.locked),
        Math.round(r.daily * 100) / 100, r.coverage === null ? "" : Math.round(r.coverage), r.row.lastSale ?? "",
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <StockFilters days={s.days} onDays={(days) => setS((x) => ({ ...x, days }))} warehouseId={s.warehouseId} onWarehouse={(warehouseId) => setS((x) => ({ ...x, warehouseId }))} warehouses={warehouses} />
        <ClassFields s={s} setS={setS} />
      </Card>
      {loading && <p className="text-xs text-gray-400">در حال به‌روزرسانی…</p>}

      <Summary rows={all} needDays={s.needDays} windowDays={windowDays} />
      <Locked rows={all} />

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chips<StockClass | "ALL">
            value={filter}
            onChange={(f) => { setFilter(f); setLimit(PAGE); }}
            options={[{ value: "ALL", label: "همه", count: all.length }, ...CLASSES.map((c) => ({ value: c, label: CLASS_LABEL[c], count: all.filter((r) => r.cls === c).length }))]}
          />
          <button className={btn.small} onClick={exportCsv} disabled={!shown.length}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            اکسل
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input className={`${inputCls} pr-9`} placeholder="جستجوی نام یا کد کالا" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <CapitalTable rows={shown.slice(0, limit)} />
        {shown.length > limit && (
          <button className={`${btn.small} w-full justify-center`} onClick={() => setLimit((n) => n + PAGE)}>
            {fa(shown.length - limit)} کالای دیگر
          </button>
        )}
      </Card>
    </div>
  );
}

function Summary({ rows, needDays, windowDays }: { rows: CapitalRow[]; needDays: number; windowDays: number }) {
  const total = rows.reduce((t, r) => t + r.value, 0);
  const locked = rows.reduce((t, r) => t + r.locked, 0);
  const atPrice = rows.reduce((t, r) => t + (r.row.price ? Math.max(0, r.row.qty) * r.row.price : 0), 0);
  const priced = rows.some((r) => r.row.price);
  const byClass = CLASSES.map((c) => {
    const list = rows.filter((r) => r.cls === c);
    return { c, value: list.reduce((t, r) => t + r.value, 0), count: list.length };
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ارزش موجودی" value={short(total)} sub="با بهای تمام‌شده (تومان)" tone="blue" />
        <Stat label="سرمایه‌ی خوابیده" value={short(locked)} sub={`${total > 0 ? fa((locked / total) * 100, 0) : "۰"}٪ — بیش از نیاز ${fa(needDays)} روز`} tone="red" />
        <Stat label="راکد و بی‌فروش" value={short(byClass[2].value + byClass[3].value)} sub={`${fa(byClass[2].count + byClass[3].count)} کالا`} tone="amber" />
        {priced && <Stat label="ارزش با قیمت فروش" value={short(atPrice)} sub="اگر همه با قیمت فعلی فروش برود" tone="green" />}
      </div>
      {total > 0 && (
        <Card className="space-y-2 p-4">
          <SectionTitle title="سرمایه به تفکیک سرعت فروش" />
          <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            {byClass.map((b) => b.value > 0 && <div key={b.c} className={CLASS_TONE[b.c]} style={{ width: `${(b.value / total) * 100}%` }} title={CLASS_LABEL[b.c]} />)}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {byClass.map((b) => (
              <div key={b.c} className="flex items-start gap-1.5">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${CLASS_TONE[b.c]}`} />
                <span>
                  <b>{CLASS_LABEL[b.c]}</b> {fa((b.value / total) * 100, 0)}٪
                  <span className="block text-[10px] text-gray-400">{short(b.value)} · {fa(b.count)} کالا</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">بر پایه‌ی فروش {fa(windowDays)} روز اخیر؛ «بی‌فروش» یعنی در این بازه هیچ فروشی نداشته.</p>
        </Card>
      )}
    </>
  );
}

/** ده کالایی که بیشترین سرمایه‌ی خوابیده را دارند */
function Locked({ rows }: { rows: CapitalRow[] }) {
  const top = [...rows].filter((r) => r.locked > 0 && r.cls !== "FAST").sort((a, b) => b.locked - a.locked).slice(0, 10);
  if (!top.length) return null;
  return (
    <Card className="space-y-3 p-4">
      <SectionTitle title="این‌ها سرمایه را قفل کرده‌اند" />
      <div className="space-y-2">
        {top.map((r) => {
          const cost = r.row.unitCost ?? 0;
          const discount = r.row.price && cost ? `/admin/tools/discount?price=${Math.round(r.row.price)}&cost=${Math.round(cost)}` : null;
          return (
            <div key={r.row.id} className="flex items-center gap-3 rounded-xl border border-[var(--adm-border)] p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{r.row.title}</p>
                <p className="text-[10px] text-gray-400">
                  <span className={`rounded px-1 py-0.5 ${CLASS_BADGE[r.cls]}`}>{CLASS_LABEL[r.cls]}</span>
                  {" · "}{fa(r.row.qty)} عدد · {r.coverage === null ? "فروشی ندارد" : `${daysText(r.coverage)} روز فروش`} · آخرین فروش {lastSaleText(r.row.lastSale)}
                </p>
              </div>
              <div className="shrink-0 text-left">
                <p className="text-sm font-black tabular-nums text-red-600">{short(r.locked)}</p>
                <p className="text-[10px] text-gray-400">از {short(r.value)}</p>
              </div>
              {discount && (
                <Link href={discount} className="shrink-0 text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400" title="چقدر تخفیف بدهم؟">
                  تخفیف
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400">«خوابیده» = ارزش موجودی بیش از نیاز. با «تخفیف» ببینید تا چند درصد تخفیف هنوز ضرر نمی‌دهد.</p>
    </Card>
  );
}

function CapitalTable({ rows }: { rows: CapitalRow[] }) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-gray-400">کالایی در این فهرست نیست.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-gray-400">
            <th className="px-2 py-2 text-right font-bold">کالا</th>
            <th className="px-2 py-2 text-left font-bold">موجودی</th>
            <th className="px-2 py-2 text-left font-bold">ارزش</th>
            <th className="px-2 py-2 text-left font-bold">خوابیده</th>
            <th className="px-2 py-2 text-left font-bold">فروش روزانه</th>
            <th className="px-2 py-2 text-left font-bold">چند روز تا فروش</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row.id} className="border-t border-[var(--adm-border)] tabular-nums">
              <td className="max-w-[16rem] px-2 py-2">
                <p className="truncate font-bold">{r.row.title}</p>
                <p className="text-[10px] text-gray-400">
                  <span className={`rounded px-1 py-0.5 ${CLASS_BADGE[r.cls]}`}>{CLASS_LABEL[r.cls]}</span> {r.row.code} · آخرین فروش {lastSaleText(r.row.lastSale)}
                </p>
              </td>
              <td className="px-2 py-2 text-left">{fa(r.row.qty)}</td>
              <td className="px-2 py-2 text-left">{fa(Math.round(r.value))}</td>
              <td className={`px-2 py-2 text-left ${r.locked > 0 ? "font-bold text-red-600" : "text-gray-400"}`}>{r.locked > 0 ? fa(Math.round(r.locked)) : "—"}</td>
              <td className="px-2 py-2 text-left">{fa(r.daily, r.daily < 1 ? 2 : 1)}</td>
              <td className="px-2 py-2 text-left">{daysText(r.coverage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── حالت دستی (بی‌حسابداری داخلی) ────────────────────────────────────────

interface ManualItem {
  id: string;
  name: string;
  qty: number;
  unitCost: number;
  monthly: number;
}

function ManualCapital({ s, setS }: { s: Settings; setS: (f: (x: Settings) => Settings) => void }) {
  const [m, setM, loaded] = useStored<{ items: ManualItem[] }>("tools.stockCapitalManual", { items: [{ id: "m1", name: "", qty: 0, unitCost: 0, monthly: 0 }] });
  // ماهانه = فروش ۳۰ روز با ۳۰ روز موجود بودن
  const rows = useMemo(
    () =>
      capitalRows(
        m.items.map((i) => ({ id: i.id, title: i.name || "کالا", code: "", image: null, qty: i.qty, sold: i.monthly, inStockDays: 30, lastSale: null, reorderPoint: null, unitCost: i.unitCost, price: null })),
        30,
        s,
      ),
    [m.items, s],
  );
  if (!loaded) return null;
  const setItem = (id: string, p: Partial<ManualItem>) => setM((x) => ({ items: x.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const total = rows.reduce((t, r) => t + r.value, 0);
  const locked = rows.reduce((t, r) => t + r.locked, 0);

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <SectionTitle
          title="کالاها"
          actions={
            <button className={btn.small} onClick={() => setM((x) => ({ items: [...x.items, { id: `m${Date.now().toString(36)}`, name: "", qty: 0, unitCost: 0, monthly: 0 }] }))}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              کالا
            </button>
          }
        />
        {m.items.map((i, k) => {
          const r = rows[k];
          return (
            <div key={i.id} className="space-y-2 rounded-xl border border-[var(--adm-border)] p-3">
              <div className="flex items-center gap-2">
                <input className={`${inputCls} font-bold`} placeholder="نام کالا" value={i.name} maxLength={60} onChange={(e) => setItem(i.id, { name: e.target.value })} />
                {m.items.length > 1 && (
                  <button className="shrink-0 p-1.5 text-gray-400 hover:text-red-500" onClick={() => setM((x) => ({ items: x.items.filter((y) => y.id !== i.id) }))} aria-label="حذف کالا">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="موجودی"><MoneyInput value={i.qty} onChange={(qty) => setItem(i.id, { qty })} /></Field>
                <Field label="قیمت خرید واحد"><MoneyInput value={i.unitCost} onChange={(unitCost) => setItem(i.id, { unitCost })} /></Field>
                <Field label="فروش ماهانه"><MoneyInput value={i.monthly} onChange={(monthly) => setItem(i.id, { monthly })} /></Field>
              </div>
              {r && i.qty > 0 && (
                <p className="text-[11px] text-gray-500">
                  <span className={`rounded px-1 py-0.5 ${CLASS_BADGE[r.cls]}`}>{CLASS_LABEL[r.cls]}</span>{" "}
                  ارزش {toman(r.value)} · {r.coverage === null ? "فروشی ندارد" : `${daysText(r.coverage)} روز تا فروش`}
                  {r.locked > 0 && <> · <b className="text-red-600">{toman(r.locked)}</b> خوابیده</>}
                </p>
              )}
            </div>
          );
        })}
        <ClassFields s={s} setS={setS} />
      </Card>
      {total > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="ارزش موجودی" value={short(total)} sub="تومان" tone="blue" />
          <Stat label="سرمایه‌ی خوابیده" value={short(locked)} sub={`${fa((locked / total) * 100, 0)}٪ — بیش از نیاز ${fa(s.needDays)} روز`} tone="red" />
        </div>
      )}
    </div>
  );
}
