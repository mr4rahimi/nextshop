"use client";

/**
 * کالای راکد و پرفروش — docs/plans/webhesab-parity.md بخش ۶.
 * راکد: موجودی دارد ولی در بازه کم فروخته؛ پرفروش: بیشترین فروش خالص و «روزهای پوشش» تا اتمام.
 * نام هر سطر ← پنجره‌ی جزئیات (کالاها و فاکتورها)؛ کالا لینک «کاردکس» هم دارد.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { faNum, toLatinDigits } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Badge, Card, inputCls, Segmented } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";
import { DetailSheet, groupOptions } from "./SalesAnalysisReport";

type Mode = "slow" | "fast";
interface Row {
  key: string;
  productId: string | null;
  modelId: string | null;
  label: string;
  code: string | null;
  items: number;
  stock: number;
  sold: number;
  ratePct: number | null;
  lastSale: string | null;
  daysSinceSale: number | null;
  lastIn: string | null;
  coverDays: number | null;
  value: string | null;
  low: boolean;
}
interface Data {
  rows: Row[];
  totals: { rows: number; stock: number; sold: number; value: string | null; low: number; neverSold: number };
  truncated: boolean;
  days: number;
  costs: boolean;
  lowCoverDays: number;
  from: string;
  to: string;
  groups: { id: string; name: string; parentId: string | null }[];
  warehouses: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

const num = (s: string) => toLatinDigits(s).replace(/[^\d.]/g, "");
const day = (iso: string) => iso.slice(0, 10);

export default function MoversReport() {
  const [mode, setMode] = useState<Mode>("slow");
  const [groupBy, setGroupBy] = useState<"item" | "model">("item");
  const [range, setRange] = useState<Range>(() => rangeFor("3m"));
  const [f, setF] = useState({ groupId: "", warehouseId: "", supplierId: "" });
  const [t, setT] = useState({ maxSold: "0", maxRate: "", minSold: "1", top: "" });
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  // «همه» برای راکد یعنی از ابتدای کار
  const from = range.preset === "all" ? "2000-01-01" : range.from;
  const { data, error, loading } = useReport<Data>("movers", {
    mode,
    groupBy,
    from,
    to: range.to,
    ...f,
    ...(mode === "slow" ? { maxSold: num(t.maxSold), maxRate: num(t.maxRate) } : { minSold: num(t.minSold), top: num(t.top) }),
  });

  const rows = useMemo(() => {
    const s = toLatinDigits(q.trim()).toLowerCase();
    return (data?.rows ?? []).filter((r) => !s || toLatinDigits(`${r.label} ${r.code ?? ""}`).toLowerCase().includes(s));
  }, [data, q]);

  function exportCsv() {
    if (!data) return;
    downloadCsv(`${mode === "slow" ? "slow" : "best"}-${groupBy}`, [
      groupBy === "model" ? "مدل" : "کالا", "کد", "موجودی", `فروش خالص (${data.days} روز)`, "نرخ فروش ٪", "آخرین فروش", "روز از آخرین فروش", "آخرین ورود", "روزهای پوشش",
      ...(data.costs ? ["ارزش موجودی (تومان)"] : []),
    ], rows.map((r) => [
      r.label, r.code, r.stock, r.sold, r.ratePct, r.lastSale ? formatJalali(new Date(r.lastSale)) : "", r.daysSinceSale, r.lastIn ? formatJalali(new Date(r.lastIn)) : "", r.coverDays,
      ...(data.costs ? [r.value] : []),
    ]));
  }

  const setNum = (k: keyof typeof t) => (e: React.ChangeEvent<HTMLInputElement>) => setT({ ...t, [k]: e.target.value });

  return (
    <ReportFrame
      title="کالای راکد و پرفروش"
      help="accountingMovers"
      desc={mode === "slow" ? "کالاهایی که موجودی دارند ولی در این بازه کم یا اصلاً فروش نرفته‌اند — پول خوابیده در انبار." : "پرفروش‌ترین کالاها و این‌که موجودی فعلی با همین سرعت چند روز دیگر تمام می‌شود."}
      printSub={`${rangeText(range)} — ${mode === "slow" ? "راکد" : "پرفروش"}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <div className="flex flex-wrap gap-2">
            <div className="w-56">
              <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: "slow", label: "راکد" }, { value: "fast", label: "پرفروش" }]} />
            </div>
            <div className="w-56">
              <Segmented<"item" | "model">
                value={groupBy}
                onChange={setGroupBy}
                options={[{ value: "item", label: "هر کالا" }, { value: "model", label: "هر مدل (رنگ‌ها با هم)" }]}
              />
            </div>
          </div>
          <RangeBar value={range} onChange={setRange} />
          <div className="flex flex-wrap items-end gap-2">
            {mode === "slow" ? (
              <>
                <label className="text-[11px] font-bold text-gray-500">
                  حداکثر فروش در بازه
                  <input value={t.maxSold} onChange={setNum("maxSold")} inputMode="numeric" className={`${inputCls} mt-1 w-28 text-center`} />
                </label>
                <label className="text-[11px] font-bold text-gray-500">
                  یا نرخ فروش تا (٪)
                  <input value={t.maxRate} onChange={setNum("maxRate")} inputMode="numeric" placeholder="—" className={`${inputCls} mt-1 w-28 text-center`} />
                </label>
              </>
            ) : (
              <>
                <label className="text-[11px] font-bold text-gray-500">
                  حداقل فروش در بازه
                  <input value={t.minSold} onChange={setNum("minSold")} inputMode="numeric" className={`${inputCls} mt-1 w-28 text-center`} />
                </label>
                <label className="text-[11px] font-bold text-gray-500">
                  فقط درصد برتر
                  <input value={t.top} onChange={setNum("top")} inputMode="numeric" placeholder="همه" className={`${inputCls} mt-1 w-28 text-center`} />
                </label>
              </>
            )}
            {!!data?.groups.length && (
              <select value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })} className={`${inputCls} w-auto`} aria-label="گروه">
                <option value="">همه‌ی گروه‌ها</option>
                {groupOptions(data.groups).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            )}
            {(data?.warehouses.length ?? 0) > 1 && (
              <select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })} className={`${inputCls} w-auto`} aria-label="انبار">
                <option value="">همه‌ی انبارها</option>
                {data!.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
            {!!data?.suppliers.length && (
              <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} className={`${inputCls} w-auto`} aria-label="عرضه‌کننده">
                <option value="">همه‌ی عرضه‌کننده‌ها</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا کد" className={`${inputCls} flex-1 min-w-[9rem]`} />
          </div>
        </>
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">{mode === "slow" ? "کالای راکد" : "کالای پرفروش"}</p>
              <p className="text-lg mt-1 font-black tabular-nums">{faNum(data.totals.rows)}</p>
              <p className="text-[11px] text-gray-400">در {faNum(data.days)} روز</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">موجودی همین‌ها</p>
              <p className="text-lg mt-1 font-black tabular-nums">{faNum(data.totals.stock)}</p>
              {data.totals.value !== null && (
                <p className="text-[11px] text-gray-400">
                  ارزش <Amt v={data.totals.value} /> تومان
                </p>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">فروش خالص بازه</p>
              <p className="text-lg mt-1 font-black tabular-nums">{faNum(data.totals.sold)}</p>
            </Card>
            <Card className="p-4">
              {mode === "slow" ? (
                <>
                  <p className="text-[11px] text-gray-500">هرگز فروش نرفته</p>
                  <p className="text-lg mt-1 font-black tabular-nums">{faNum(data.totals.neverSold)}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500">رو به اتمام</p>
                  <p className={`text-lg mt-1 font-black tabular-nums ${data.totals.low ? "text-red-600" : ""}`}>{faNum(data.totals.low)}</p>
                  <p className="text-[11px] text-gray-400">پوشش {faNum(data.lowCoverDays)} روز یا کمتر</p>
                </>
              )}
            </Card>
          </div>

          <Table
            head={
              <tr>
                <th className={th}>{groupBy === "model" ? "مدل" : "کالا"}</th>
                <th className={thNum}>موجودی</th>
                <th className={thNum}>فروش خالص</th>
                <th className={thNum} title="فروش ÷ (فروش + موجودی)">
                  نرخ فروش
                </th>
                <th className={thNum}>آخرین فروش</th>
                <th className={thNum}>آخرین ورود</th>
                <th className={thNum} title="موجودی ÷ فروش روزانه‌ی بازه">
                  روزهای پوشش
                </th>
                {data.costs && <th className={thNum}>ارزش موجودی</th>}
              </tr>
            }
          >
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} max-w-[20rem]`}>
                  <button onClick={() => setDetail(r)} className="block max-w-full truncate text-right font-bold text-blue-700 dark:text-blue-300 hover:underline" title="کالاها و فاکتورهای فروش">
                    {r.label}
                  </button>
                  <span className="flex gap-2 text-[10px] text-gray-400">
                    {r.code && <span>{r.code}</span>}
                    {r.modelId && <span>{faNum(r.items)} کالا</span>}
                    {r.productId && (
                      <Link href={`/admin/accounting/inventory/${r.productId}`} className="font-bold hover:text-blue-600">
                        کاردکس ←
                      </Link>
                    )}
                  </span>
                </td>
                <td className={`${tdNum} tabular-nums font-bold`}>{faNum(r.stock)}</td>
                <td className={`${tdNum} tabular-nums ${r.sold ? "" : "text-gray-300 dark:text-gray-600"}`}>{faNum(r.sold)}</td>
                <td className={`${tdNum} tabular-nums text-gray-500`}>{r.ratePct === null ? "—" : `${r.ratePct.toLocaleString("fa-IR")}٪`}</td>
                <td className={`${tdNum} whitespace-nowrap text-xs`}>
                  {r.lastSale ? (
                    <>
                      {formatJalali(new Date(r.lastSale))}
                      <span className="block text-[10px] text-gray-400">{faNum(r.daysSinceSale ?? 0)} روز پیش</span>
                    </>
                  ) : (
                    <Badge tone="red">هرگز</Badge>
                  )}
                </td>
                <td className={`${tdNum} whitespace-nowrap text-xs text-gray-500`}>{r.lastIn ? formatJalali(new Date(r.lastIn)) : "—"}</td>
                <td className={`${tdNum} tabular-nums`}>
                  {r.coverDays === null ? "—" : r.low ? <Badge tone="red">{faNum(r.coverDays)} روز</Badge> : `${faNum(r.coverDays)} روز`}
                </td>
                {data.costs && (
                  <td className={tdNum}>
                    <Amt v={r.value} />
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={8}>
                  {mode === "slow" ? "با این شرط‌ها کالای راکدی نیست." : "در این بازه فروشی با این شرط‌ها نیست."}
                </td>
              </tr>
            )}
          </Table>
          {data.truncated && <p className="text-[11px] text-amber-600">فقط ۲۰۰۰ سطر اول نشان داده شد؛ با گروه یا انبار محدودتر کنید.</p>}
          <p className="text-[11px] text-gray-400 leading-5">
            فروش از کاردکس است (فروش منهای برگشتی، هر انبار جدا). «روزهای پوشش» یعنی موجودی فعلی با سرعت فروش همین بازه چند روز دیگر تمام می‌شود. «آخرین ورود» خرید،
            اول دوره، حواله یا اضافی انبارگردانی است.
          </p>
        </>
      )}

      {detail && data && (
        <DetailSheet
          params={{
            from: day(data.from),
            to: day(data.to),
            by: detail.modelId ? "model" : "item",
            row: detail.modelId ?? detail.productId ?? "",
            ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
          }}
          title={detail.label}
          onClose={() => setDetail(null)}
        />
      )}
    </ReportFrame>
  );
}
