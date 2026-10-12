"use client";

/**
 * موجودی و نقطه‌ی سفارش — «موجودی برای ۲۳ روز کافی است؛ ۷ روز دیگر سفارش بدهید».
 * با حسابداری داخلی همه‌ی کالاها از کاردکس؛ بی‌آن فقط حساب دستی. منطق: `lib/tools/stock-velocity.ts`.
 * docs/features/tools.md بخش ۱۴
 */

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { DEFAULT_REORDER, dailySales, reorder, type ReorderResult, type ReorderSettings, type VelocityRow } from "@/lib/tools/stock-velocity";
import { downloadCsv } from "../accounting/reports/kit";
import { api, Card, Chips, ErrorText, Field, PageHeader, SectionTitle, Segmented, Stat, btn, inputCls } from "../accounting/ui";
import { DecimalInput, Metric, MoneyInput, fa, useStored } from "./calc-inputs";
import { NoAccountingNotice, StockFilters, daysText, lastSaleText, matchQuery, useStockData, type WindowDays } from "./stock-shared";

interface Settings extends ReorderSettings {
  days: WindowDays;
  warehouseId: string;
}

type Filter = "ORDER" | "WEEK" | "SELLING" | "OUT";
const PAGE = 100;

interface Line {
  row: VelocityRow;
  r: ReorderResult;
}

export default function ReorderClient() {
  const [s, setS, loaded] = useStored<Settings>("tools.reorder", { ...DEFAULT_REORDER, days: "90", warehouseId: "" });
  const { data, error, loading, reload } = useStockData(s.days, s.warehouseId);
  const [tab, setTab] = useState<"ALL" | "MANUAL">("ALL");

  if (!loaded) return <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const internal = data?.mode === "INTERNAL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="موجودی و نقطه‌ی سفارش"
        help="toolsReorder"
        desc="موجودی هر کالا برای چند روز کافی است و کِی باید دوباره سفارش بدهید — از روی سرعت فروش واقعی و زمان رسیدن کالا."
      />

      {error && <ErrorText>{error}</ErrorText>}
      {data && !internal && <NoAccountingNotice what="موجودی و فروش کالاها" />}
      {internal && (
        <Segmented value={tab} onChange={setTab} options={[{ value: "ALL", label: "همه‌ی کالاها" }, { value: "MANUAL", label: "حساب دستی" }]} />
      )}

      {data && (!internal || tab === "MANUAL") && <ManualReorder s={s} setS={setS} />}
      {internal && tab === "ALL" && <AllItems s={s} setS={setS} rows={data.rows} warehouses={data.warehouses} canEdit={data.canEdit} loading={loading} reload={reload} />}
      {!data && !error && <p className="text-xs text-gray-400">در حال خواندن انبار…</p>}
    </div>
  );
}

function SettingsFields({ s, setS }: { s: Settings; setS: (f: (x: Settings) => Settings) => void }) {
  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="زمان رسیدن کالا" hint="از سفارش تا انبار">
        <DecimalInput value={s.leadDays} max={365} suffix="روز" onChange={(leadDays) => set({ leadDays })} />
      </Field>
      <Field label="ذخیره‌ی اطمینان" hint="برای دیرکرد یا فروش ناگهانی">
        <DecimalInput value={s.safetyDays} max={365} suffix="روز" onChange={(safetyDays) => set({ safetyDays })} />
      </Field>
      <Field label="هر سفارش برای" hint="چند روز فروش را بپوشاند">
        <DecimalInput value={s.coverDays} max={730} suffix="روز" onChange={(coverDays) => set({ coverDays })} />
      </Field>
    </div>
  );
}

// ── حساب دستی ────────────────────────────────────────────────────────────

function ManualReorder({ s, setS }: { s: Settings; setS: (f: (x: Settings) => Settings) => void }) {
  const [m, setM, loaded] = useStored("tools.reorderManual", { qty: 0, daily: 0 });
  const [now] = useState(() => Date.now());
  const r = reorder(m.qty, m.daily, s);
  if (!loaded) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card className="space-y-3 p-4">
        <SectionTitle title="یک کالا" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="موجودی فعلی (تعداد)">
            <MoneyInput value={m.qty} onChange={(qty) => setM((x) => ({ ...x, qty }))} />
          </Field>
          <Field label="فروش روزانه (میانگین)" hint="مثلاً فروش ماه گذشته ÷ ۳۰">
            <DecimalInput value={m.daily} max={1_000_000} suffix="عدد" onChange={(daily) => setM((x) => ({ ...x, daily }))} />
          </Field>
        </div>
        <SettingsFields s={s} setS={setS} />
      </Card>

      <Card className="space-y-3 p-4">
        {m.daily <= 0 ? (
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">فروش روزانه را وارد کنید.</p>
        ) : (
          <>
            <p className="text-base leading-8">
              موجودی فعلی برای <span className="text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">{daysText(r.coverage)}</span> روز کافی است.
            </p>
            <OrderSentence r={r} />
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <Metric label="نقطه‌ی سفارش" value={`${fa(r.reorderPoint)} عدد`} hint="وقتی موجودی به این عدد رسید سفارش بدهید" />
              <Metric label="مقدار سفارش" value={`${fa(r.orderQty)} عدد`} hint="تا رسیدن کالا و سپس روزهای پوشش، کم نیاید" />
              <Metric label="تاریخ تمام شدن" value={r.coverage === null ? "—" : lastSaleText(new Date(now + r.coverage * 86_400_000).toISOString())} hint="با همین سرعت فروش" />
            </dl>
          </>
        )}
      </Card>
    </div>
  );
}

function OrderSentence({ r }: { r: ReorderResult }) {
  if (r.daysToOrder === null) return null;
  if (r.daysToOrder <= 0) {
    return <p className="rounded-xl bg-red-50 p-3 text-sm font-black text-red-700 dark:bg-red-500/10 dark:text-red-300">همین امروز سفارش بدهید — {fa(r.orderQty)} عدد.</p>;
  }
  return (
    <p className="text-sm">
      زمان سفارش مجدد: <b className="text-lg tabular-nums">{fa(Math.floor(r.daysToOrder))}</b> روز دیگر ({fa(r.orderQty)} عدد).
    </p>
  );
}

// ── همه‌ی کالاها ─────────────────────────────────────────────────────────

function AllItems({
  s, setS, rows, warehouses, canEdit, loading, reload,
}: {
  s: Settings;
  setS: (f: (x: Settings) => Settings) => void;
  rows: VelocityRow[];
  warehouses: { id: string; name: string }[];
  canEdit: boolean;
  loading: boolean;
  reload: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("ORDER");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const days = Number(s.days);

  const lines = useMemo<Line[]>(
    () => rows.map((row) => ({ row, r: reorder(row.qty, dailySales(row.sold, row.inStockDays, days), s) })),
    [rows, days, s],
  );
  const counts = useMemo(() => ({
    ORDER: lines.filter((l) => l.r.daysToOrder !== null && l.r.daysToOrder <= 0 && l.row.qty > 0).length,
    WEEK: lines.filter((l) => l.r.daysToOrder !== null && l.r.daysToOrder > 0 && l.r.daysToOrder <= 7).length,
    SELLING: lines.filter((l) => l.r.daily > 0).length,
    OUT: lines.filter((l) => l.row.qty <= 0 && l.r.daily > 0).length,
  }), [lines]);

  const shown = useMemo(() => {
    const f = lines.filter((l) => {
      if (!matchQuery(l.row, q)) return false;
      const d = l.r.daysToOrder;
      if (filter === "ORDER") return d !== null && d <= 0 && l.row.qty > 0;
      if (filter === "WEEK") return d !== null && d > 0 && d <= 7;
      if (filter === "OUT") return l.row.qty <= 0 && l.r.daily > 0;
      return l.r.daily > 0;
    });
    // فوری‌ترها اول
    return f.sort((a, b) => (a.r.daysToOrder ?? Infinity) - (b.r.daysToOrder ?? Infinity) || b.r.daily - a.r.daily);
  }, [lines, filter, q]);

  async function save(items: Line[]) {
    if (!items.length) return;
    if (items.length > 1 && !confirm(`نقطه‌ی سفارش پیشنهادی روی ${fa(items.length)} کالا ثبت شود؟ نقطه‌ی قبلی این کالاها جایگزین می‌شود.`)) return;
    setBusy(items.length > 1 ? "all" : items[0].row.id);
    setMsg(null);
    try {
      const d = await api<{ updated: number }>("/api/admin/tools/stock/reorder-point", {
        method: "POST",
        json: { items: items.map((l) => ({ id: l.row.id, reorderPoint: l.r.reorderPoint })) },
      });
      setMsg(`نقطه‌ی سفارش ${fa(d.updated)} کالا ثبت شد.`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    downloadCsv(
      `reorder-${s.days}d`,
      ["کد", "کالا", "موجودی", "فروش روزانه", "روز کافی", "نقطه‌ی سفارش پیشنهادی", "نقطه‌ی سفارش ثبت‌شده", "روز تا سفارش", "مقدار سفارش", "آخرین فروش"],
      shown.map((l) => [
        l.row.code, l.row.title, l.row.qty, Math.round(l.r.daily * 100) / 100,
        l.r.coverage === null ? "" : Math.round(l.r.coverage), l.r.reorderPoint, l.row.reorderPoint ?? "",
        l.r.daysToOrder === null ? "" : Math.floor(l.r.daysToOrder), l.r.orderQty, l.row.lastSale ?? "",
      ]),
    );
  }

  const pending = shown.filter((l) => l.r.daily > 0 && l.row.reorderPoint !== l.r.reorderPoint);

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <StockFilters days={s.days} onDays={(days) => setS((x) => ({ ...x, days }))} warehouseId={s.warehouseId} onWarehouse={(warehouseId) => setS((x) => ({ ...x, warehouseId }))} warehouses={warehouses} />
        <SettingsFields s={s} setS={setS} />
        <p className="text-[11px] leading-5 text-gray-400">
          فروش روزانه = فروش خالص {fa(days)} روز اخیر ÷ روزهایی که کالا موجود بود. روزهای ناموجود حساب نمی‌شوند تا کالای پرفروشی که تمام شده بود کم‌فروش دیده نشود.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="همین امروز سفارش بدهید" value={fa(counts.ORDER)} tone="red" />
        <Stat label="تا ۷ روز دیگر" value={fa(counts.WEEK)} tone="amber" />
        <Stat label="تمام شده ولی فروش دارد" value={fa(counts.OUT)} tone="gray" />
        <Stat label="کالای در حال فروش" value={fa(counts.SELLING)} tone="blue" />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chips<Filter>
            value={filter}
            onChange={(f) => { setFilter(f); setLimit(PAGE); }}
            options={[
              { value: "ORDER", label: "باید سفارش داد", count: counts.ORDER },
              { value: "WEEK", label: "تا ۷ روز", count: counts.WEEK },
              { value: "OUT", label: "تمام شده", count: counts.OUT },
              { value: "SELLING", label: "همه با فروش", count: counts.SELLING },
            ]}
          />
          <div className="flex gap-2">
            {canEdit && pending.length > 0 && (
              <button className={btn.small} disabled={busy !== null} onClick={() => save(pending)}>
                ثبت نقطه‌ی سفارش برای {fa(pending.length)} کالا
              </button>
            )}
            <button className={btn.small} onClick={exportCsv} disabled={!shown.length}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              اکسل
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input className={`${inputCls} pr-9`} placeholder="جستجوی نام یا کد کالا" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {msg && <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{msg}</p>}
        {loading && <p className="text-xs text-gray-400">در حال به‌روزرسانی…</p>}

        {shown.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">کالایی در این فهرست نیست.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-gray-400">
                  <th className="px-2 py-2 text-right font-bold">کالا</th>
                  <th className="px-2 py-2 text-left font-bold">موجودی</th>
                  <th className="px-2 py-2 text-left font-bold">فروش روزانه</th>
                  <th className="px-2 py-2 text-left font-bold">روز کافی</th>
                  <th className="px-2 py-2 text-left font-bold">سفارش</th>
                  <th className="px-2 py-2 text-left font-bold">مقدار</th>
                  <th className="px-2 py-2 text-left font-bold">نقطه‌ی سفارش</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((l) => {
                  const d = l.r.daysToOrder;
                  const urgent = d !== null && d <= 0;
                  return (
                    <tr key={l.row.id} className="border-t border-[var(--adm-border)] tabular-nums">
                      <td className="max-w-[16rem] px-2 py-2">
                        <p className="truncate font-bold">{l.row.title}</p>
                        <p className="text-[10px] text-gray-400">{l.row.code} · آخرین فروش {lastSaleText(l.row.lastSale)}</p>
                      </td>
                      <td className={`px-2 py-2 text-left ${l.row.qty <= 0 ? "text-red-600" : ""}`}>{fa(l.row.qty)}</td>
                      <td className="px-2 py-2 text-left">{fa(l.r.daily, l.r.daily < 1 ? 2 : 1)}</td>
                      <td className="px-2 py-2 text-left">{daysText(l.r.coverage)}</td>
                      <td className={`px-2 py-2 text-left font-bold ${urgent ? "text-red-600" : d !== null && d <= 7 ? "text-amber-600" : ""}`}>
                        {d === null ? "—" : urgent ? "امروز" : `${fa(Math.floor(d))} روز دیگر`}
                      </td>
                      <td className="px-2 py-2 text-left">{l.r.orderQty ? fa(l.r.orderQty) : "—"}</td>
                      <td className="px-2 py-2 text-left">
                        <span className="font-bold">{fa(l.r.reorderPoint)}</span>
                        {l.row.reorderPoint !== l.r.reorderPoint && (
                          <span className="block text-[10px] text-gray-400">
                            {l.row.reorderPoint === null ? "ثبت نشده" : `ثبت‌شده ${fa(l.row.reorderPoint)}`}
                            {canEdit && l.r.daily > 0 && (
                              <button className="mr-1 font-bold text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400" disabled={busy !== null} onClick={() => save([l])}>
                                {busy === l.row.id ? "…" : "ثبت"}
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > limit && (
          <button className={`${btn.small} w-full justify-center`} onClick={() => setLimit((n) => n + PAGE)}>
            {fa(shown.length - limit)} کالای دیگر
          </button>
        )}
        <p className="text-[11px] leading-5 text-gray-400">
          «نقطه‌ی سفارش» همان عدد فرم کالا در حسابداری است و هشدار کم بودن موجودی هم از آن استفاده می‌کند. ثبت فقط با دسترسی انبار ممکن است.
        </p>
      </Card>
    </div>
  );
}
