"use client";

/**
 * گزارش مشتریان — docs/plans/webhesab-parity.md بخش ۲۵.
 * سه زبانه: نفرات برتر (فروش بر مبنای مشتری)، اولین خرید (مشتری تازه)، روزانه.
 * هر عدد قابل کلیک: نام ← صورت‌حساب شخص، تعداد فاکتور ← پنجره‌ی کالاها و فاکتورها
 * (همان پنجره‌ی «تحلیل فروش»)، روز ← همان روز در زبانه‌ی دیگر.
 */

import Link from "next/link";
import { useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Card, inputCls, Segmented } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { DetailSheet } from "./SalesAnalysisReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

type Mode = "top" | "first" | "daily";

interface PartyBits {
  partyId: string;
  code: number;
  name: string;
  mobile: string | null;
  card: string | null;
  tier: string | null;
  legacy: { invoices: number; spent: string; last: string | null } | null;
}
interface TopRow extends PartyBits {
  rank: number;
  invoices: number;
  returns: number;
  sales: string;
  discount: string;
  returned: string;
  net: string;
  avg: string;
  qty: number;
  first: string;
  last: string | null;
  shareBp: number;
}
interface FirstRow extends PartyBits {
  invoiceId: string;
  number: number | null;
  date: string;
  amount: string;
  qty: number;
  warehouse: string | null;
  laterInvoices: number;
  laterNet: string;
  lastDate: string | null;
}
interface DayRow {
  day: string;
  invoices: number;
  customers: number;
  walkIn: number;
  fresh: number;
  returns: number;
  net: string;
  avg: string;
}
type Data = { warehouses: { id: string; name: string }[] } & (
  | {
      mode: "top";
      rows: TopRow[];
      totals: { customers: number; invoices: number; sales: string; discount: string; returned: string; net: string; shown: number; shownNet: string; shownShareBp: number };
      walkIn: { invoices: number; net: string };
    }
  | { mode: "first"; rows: FirstRow[]; totals: { customers: number; firstNet: string; returning: number; laterNet: string; legacyHidden: number } }
  | {
      mode: "daily";
      from: string;
      to: string;
      rows: DayRow[];
      totals: { invoices: number; customers: number; walkIn: number; fresh: number; returns: number; net: string; activeDays: number; maxInvoices: number };
    }
);

const pct = (bp: number) => `${(bp / 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
const jd = (d: string | null) => (d ? formatJalali(new Date(d)) : "—");
const link = "font-bold text-blue-700 dark:text-blue-300 hover:underline";

export default function CustomersReport() {
  const [mode, setMode] = useState<Mode>("top");
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("net");
  const [limit, setLimit] = useState("100");
  const [legacy, setLegacy] = useState(false);
  const [detail, setDetail] = useState<{ partyId: string; name: string; from: string; to: string } | null>(null);

  const params = {
    mode,
    from: range.from,
    to: range.to,
    warehouseId,
    q: mode === "daily" ? "" : q.trim(),
    ...(mode === "top" ? { sort, limit } : {}),
    ...(mode === "first" && legacy ? { legacy: "1" } : {}),
  };
  const { data, error, loading } = useReport<Data>("customers", params);
  const d = data && data.mode === mode ? data : null;

  /** یک روز ← زبانه‌ی دیگر با همان روز */
  const gotoDay = (day: string, m: Mode) => {
    setRange({ preset: "custom", from: day, to: day });
    setMode(m);
  };

  function exportCsv() {
    if (!d) return;
    if (d.mode === "top")
      downloadCsv("customers-top", ["رتبه", "کد", "مشتری", "موبایل", "کارت", "سطح", "فاکتور", "خرید", "تخفیف", "مرجوعی", "خالص", "میانگین فاکتور", "اقلام", "آخرین خرید", "سهم ٪"], d.rows.map((r) => [
        r.rank, r.code, r.name, r.mobile, r.card, r.tier, r.invoices, r.sales, r.discount, r.returned, r.net, r.avg, r.qty, jd(r.last), r.shareBp / 100,
      ]));
    else if (d.mode === "first")
      downloadCsv("customers-first", ["کد", "مشتری", "موبایل", "تاریخ اولین خرید", "شماره فاکتور", "مبلغ اولین خرید", "انبار", "فاکتورهای بعدی", "خرید بعدی", "آخرین خرید"], d.rows.map((r) => [
        r.code, r.name, r.mobile, jd(r.date), r.number, r.amount, r.warehouse, r.laterInvoices, r.laterNet, jd(r.lastDate),
      ]));
    else
      downloadCsv("customers-daily", ["روز", "فاکتور فروش", "مشتری", "بی‌نام", "تازه", "مرجوعی", "فروش خالص", "میانگین فاکتور"], d.rows.map((r) => [
        jd(r.day), r.invoices, r.customers, r.walkIn, r.fresh, r.returns, r.net, r.avg,
      ]));
  }

  const name = (r: PartyBits) => (
    <span className="block min-w-0">
      <Link href={`/admin/accounting/parties/${r.partyId}`} className={`${link} block truncate`} title="صورت‌حساب">
        {r.name}
      </Link>
      <span className="block text-[11px] text-gray-400 tabular-nums">
        {faNum(r.code)}
        {r.mobile && ` · ${faNum(r.mobile)}`}
        {r.card && ` · کارت ${faNum(r.card)}`}
        {r.tier && ` · ${r.tier}`}
      </span>
      {r.legacy && r.legacy.invoices > 0 && (
        <span className="block text-[10px] text-amber-700 dark:text-amber-300" title="سابقه در نرم‌افزار قبلی">
          قبلاً {faNum(r.legacy.invoices)} فاکتور، <Amt v={r.legacy.spent} muted />
        </span>
      )}
    </span>
  );

  return (
    <ReportFrame
      title="گزارش مشتریان"
      help="accountingCustomers"
      desc="نفرات برتر خرید، مشتری‌های تازه و تعداد مشتری هر روز — از همه‌ی کانال‌ها. روی هر نام یا عدد بزنید تا جزئیاتش باز شود."
      printSub={`${rangeText(range)} — ${mode === "top" ? "نفرات برتر" : mode === "first" ? "اولین خرید" : "روزانه"}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "top", label: "نفرات برتر" },
              { value: "first", label: "اولین خرید" },
              { value: "daily", label: "روزانه" },
            ]}
          />
          <RangeBar value={range} onChange={setRange} />
          <div className="flex flex-wrap gap-2">
            {(data?.warehouses.length ?? 0) > 1 && (
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={`${inputCls} w-auto`} aria-label="انبار">
                <option value="">همه‌ی انبارها</option>
                {data!.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
            {mode === "top" && (
              <>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} w-auto`} aria-label="ترتیب">
                  <option value="net">بیشترین خرید</option>
                  <option value="invoices">بیشترین تعداد فاکتور</option>
                  <option value="last">تازه‌ترین خرید</option>
                </select>
                <select value={limit} onChange={(e) => setLimit(e.target.value)} className={`${inputCls} w-auto`} aria-label="تعداد نفرات">
                  <option value="10">۱۰ نفر اول</option>
                  <option value="50">۵۰ نفر اول</option>
                  <option value="100">۱۰۰ نفر اول</option>
                  <option value="500">۵۰۰ نفر اول</option>
                  <option value="0">همه (تا ۲٬۰۰۰)</option>
                </select>
              </>
            )}
            {mode === "first" && (
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} />
                خریداران نرم‌افزار قبلی هم
              </label>
            )}
            {mode !== "daily" && (
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، موبایل، کد یا کارت" className={`${inputCls} flex-1 min-w-[9rem]`} />
            )}
          </div>
        </>
      }
    >
      {d?.mode === "top" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="خرید خالص مشتریان" value={<Amt v={d.totals.net} strong />} sub={`${faNum(d.totals.customers)} مشتری · ${faNum(d.totals.invoices)} فاکتور`} />
            <Stat
              label={`سهم ${faNum(d.totals.shown)} نفر نمایش‌داده‌شده`}
              value={<span className="font-black tabular-nums">{pct(d.totals.shownShareBp)}</span>}
              sub={<Amt v={d.totals.shownNet} muted />}
            />
            <Stat label="تخفیف داده‌شده" value={<Amt v={d.totals.discount} strong />} sub={<>مرجوعی <Amt v={d.totals.returned} muted /></>} />
            <Stat label="فروش بی‌نام (مشتری حضوری)" value={<Amt v={d.walkIn.net} strong />} sub={`${faNum(d.walkIn.invoices)} فاکتور`} />
          </div>
          <Table
            head={
              <tr>
                <th className={thNum}>#</th>
                <th className={th}>مشتری</th>
                <th className={thNum}>فاکتور</th>
                <th className={thNum}>خرید</th>
                <th className={thNum}>تخفیف</th>
                <th className={thNum}>مرجوعی</th>
                <th className={thNum}>خالص</th>
                <th className={thNum}>میانگین فاکتور</th>
                <th className={thNum}>آخرین خرید</th>
                <th className={thNum}>سهم</th>
              </tr>
            }
          >
            {d.rows.map((r) => (
              <tr key={r.partyId} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${tdNum} tabular-nums text-gray-400`}>{faNum(r.rank)}</td>
                <td className={`${td} max-w-[18rem]`}>
                  {name(r)}
                  <Link
                    href={`/admin/accounting/reports/sales?by=group&partyId=${r.partyId}&from=${range.from}&to=${range.to}`}
                    className="text-[10px] font-bold text-gray-400 hover:text-blue-600"
                  >
                    تحلیل خرید ←
                  </Link>
                </td>
                <td className={`${tdNum} tabular-nums`}>
                  <button onClick={() => setDetail({ partyId: r.partyId, name: r.name, from: range.from, to: range.to })} className={link} title="کالاها و فاکتورها">
                    {faNum(r.invoices)}
                  </button>
                </td>
                <td className={tdNum}>
                  <Amt v={r.sales} />
                </td>
                <td className={tdNum}>
                  <Amt v={r.discount} muted />
                </td>
                <td className={`${tdNum} ${r.returns ? "text-red-600" : ""}`}>
                  <Amt v={r.returned} muted />
                  {r.returns > 0 && <span className="block text-[10px]">{faNum(r.returns)} فاکتور</span>}
                </td>
                <td className={tdNum}>
                  <Amt v={r.net} strong />
                </td>
                <td className={tdNum}>
                  <Amt v={r.avg} muted />
                </td>
                <td className={`${tdNum} text-xs text-gray-500`}>{jd(r.last)}</td>
                <td className={`${tdNum} w-24`}>
                  <Share bp={r.shareBp} />
                </td>
              </tr>
            ))}
            {!d.rows.length && <Empty cols={10} />}
          </Table>
        </>
      )}

      {d?.mode === "first" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="مشتری تازه" value={<span className="font-black tabular-nums">{faNum(d.totals.customers)}</span>} sub={d.totals.legacyHidden ? `${faNum(d.totals.legacyHidden)} خریدار قبلی کنار گذاشته شد` : undefined} />
            <Stat label="جمع اولین خریدها" value={<Amt v={d.totals.firstNet} strong />} />
            <Stat
              label="دوباره خرید کردند"
              value={<span className="font-black tabular-nums">{faNum(d.totals.returning)}</span>}
              sub={d.totals.customers ? pct(Math.round((d.totals.returning / d.totals.customers) * 10_000)) : undefined}
            />
            <Stat label="خرید بعدی همین‌ها تا امروز" value={<Amt v={d.totals.laterNet} strong />} />
          </div>
          <Table
            head={
              <tr>
                <th className={th}>مشتری</th>
                <th className={thNum}>اولین خرید</th>
                <th className={thNum}>فاکتور</th>
                <th className={thNum}>مبلغ</th>
                <th className={th}>انبار</th>
                <th className={thNum}>بعد از آن</th>
                <th className={thNum}>آخرین خرید</th>
              </tr>
            }
          >
            {d.rows.map((r) => (
              <tr key={r.partyId} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} max-w-[18rem]`}>{name(r)}</td>
                <td className={`${tdNum} text-xs`}>{jd(r.date)}</td>
                <td className={`${tdNum} tabular-nums`}>
                  <Link href={`/admin/accounting/invoices/${r.invoiceId}`} className={link}>
                    {r.number ? faNum(r.number) : "—"}
                  </Link>
                </td>
                <td className={tdNum}>
                  <Amt v={r.amount} />
                </td>
                <td className={`${td} text-xs text-gray-500`}>{r.warehouse ?? "—"}</td>
                <td className={`${tdNum} tabular-nums`}>
                  {r.laterInvoices ? (
                    <button onClick={() => setDetail({ partyId: r.partyId, name: r.name, from: r.date.slice(0, 10), to: "" })} className={link} title="همه‌ی خریدها از اولین خرید">
                      {faNum(r.laterInvoices)} فاکتور
                      <span className="block text-[10px] font-normal">
                        <Amt v={r.laterNet} muted />
                      </span>
                    </button>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">برنگشته</span>
                  )}
                </td>
                <td className={`${tdNum} text-xs text-gray-500`}>{jd(r.lastDate)}</td>
              </tr>
            ))}
            {!d.rows.length && <Empty cols={7} />}
          </Table>
        </>
      )}

      {d?.mode === "daily" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="فاکتور فروش" value={<span className="font-black tabular-nums">{faNum(d.totals.invoices)}</span>} sub={`${faNum(d.totals.walkIn)} بی‌نام · ${faNum(d.totals.returns)} مرجوعی`} />
            <Stat label="مشتری شناخته‌شده" value={<span className="font-black tabular-nums">{faNum(d.totals.customers)}</span>} sub={`${faNum(d.totals.fresh)} تازه`} />
            <Stat label="فروش خالص" value={<Amt v={d.totals.net} strong />} />
            <Stat
              label="میانگین فاکتور در روز"
              value={<span className="font-black tabular-nums">{d.totals.activeDays ? faNum(Math.round(d.totals.invoices / d.totals.activeDays)) : "۰"}</span>}
              sub={`${faNum(d.totals.activeDays)} روز فروش`}
            />
          </div>
          <Table
            head={
              <tr>
                <th className={th}>روز</th>
                <th className={th}>فاکتور فروش</th>
                <th className={thNum}>مشتری</th>
                <th className={thNum}>بی‌نام</th>
                <th className={thNum}>تازه</th>
                <th className={thNum}>مرجوعی</th>
                <th className={thNum}>فروش خالص</th>
                <th className={thNum}>میانگین فاکتور</th>
              </tr>
            }
          >
            {[...d.rows].reverse().map((r) => (
              <tr key={r.day} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} text-xs whitespace-nowrap`}>
                  {r.invoices ? (
                    <button onClick={() => gotoDay(r.day, "top")} className={link} title="مشتریان این روز">
                      {jd(r.day)}
                    </button>
                  ) : (
                    <span className="text-gray-400">{jd(r.day)}</span>
                  )}
                </td>
                <td className={`${td} w-48`}>
                  <span className="flex items-center gap-2">
                    <span className="w-8 text-left text-xs font-black tabular-nums">{faNum(r.invoices)}</span>
                    <span className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" aria-hidden>
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${d.totals.maxInvoices ? (r.invoices / d.totals.maxInvoices) * 100 : 0}%` }} />
                    </span>
                  </span>
                </td>
                <td className={`${tdNum} tabular-nums`}>
                  {r.customers ? (
                    <button onClick={() => gotoDay(r.day, "top")} className={link}>
                      {faNum(r.customers)}
                    </button>
                  ) : (
                    <Zero />
                  )}
                </td>
                <td className={`${tdNum} tabular-nums text-gray-500`}>{r.walkIn ? faNum(r.walkIn) : <Zero />}</td>
                <td className={`${tdNum} tabular-nums`}>
                  {r.fresh ? (
                    <button onClick={() => gotoDay(r.day, "first")} className={link} title="مشتری‌های تازه‌ی این روز">
                      {faNum(r.fresh)}
                    </button>
                  ) : (
                    <Zero />
                  )}
                </td>
                <td className={`${tdNum} tabular-nums ${r.returns ? "text-red-600" : ""}`}>{r.returns ? faNum(r.returns) : <Zero />}</td>
                <td className={tdNum}>
                  <Amt v={r.net} />
                </td>
                <td className={tdNum}>
                  <Amt v={r.avg} muted />
                </td>
              </tr>
            ))}
          </Table>
          <p className="text-[11px] text-gray-400 leading-5">«مشتری» یعنی خریدار با نام (هر کس یک بار در روز). «تازه» یعنی اولین فاکتور فروش آن مشتری همان روز بوده. حداکثر ۴۰۰ روز.</p>
        </>
      )}

      {detail && (
        <DetailSheet
          params={{ by: "customer", row: detail.partyId, from: detail.from, to: detail.to, warehouseId: warehouseId || null }}
          title={detail.name}
          onClose={() => setDetail(null)}
        />
      )}
    </ReportFrame>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </Card>
  );
}

function Share({ bp }: { bp: number }) {
  return (
    <span className="flex items-center gap-1.5 justify-end">
      <span className="text-[11px] tabular-nums text-gray-500">{pct(bp)}</span>
      <span className="h-1.5 w-10 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" aria-hidden>
        <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, bp / 100))}%` }} />
      </span>
    </span>
  );
}

const Zero = () => <span className="text-gray-300 dark:text-gray-600">۰</span>;

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={cols}>
        در این بازه و با این فیلترها خریدی نیست.
      </td>
    </tr>
  );
}
