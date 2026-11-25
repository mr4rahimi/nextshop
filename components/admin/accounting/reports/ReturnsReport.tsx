"use client";

/**
 * گزارش «مرجوعی‌ها» — دلیل، کالا/مدل با نرخ برگشت، و فهرست هر مرجوعی (webhesab-parity.md بخش ۳۴.۱).
 * هر عدد کلیک‌پذیر: دلیل یا کالا ← فهرست پایین فیلتر می‌شود؛ ردیف ← فاکتور برگشت و فروش اولیه.
 */

import Link from "next/link";
import { useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Card, SectionTitle, Segmented } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

interface Data {
  by: "item" | "model";
  summary: { count: number; qty: number; amount: string; salesCount: number; salesAmount: string; rateBp: number | null; avgDays: number | null };
  reasons: { reason: string; count: number; qty: number; amount: string }[];
  groups: { key: string; title: string; code: string | null; productIds: string[]; qty: number; amount: string; sold: number; rateBp: number | null; topReason: string | null }[];
  rows: {
    id: string;
    number: number | null;
    date: string;
    partyId: string;
    partyName: string;
    reason: string;
    qty: number;
    amount: string;
    items: string;
    productIds: string[];
    ref: { id: string; number: number | null; date: string; ticket: number | null } | null;
    days: number | null;
    seller: string | null;
    where: string;
    cashier: string | null;
  }[];
  truncated: boolean;
}

const pct = (bp: number | null) => (bp === null ? "—" : `${faNum(Math.round(bp) / 100)}٪`);
const jd = (v: string) => formatJalali(new Date(v));
const link = "font-bold text-blue-600 hover:underline";

export default function ReturnsReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [by, setBy] = useState<"model" | "item">("model");
  const [only, setOnly] = useState<{ kind: "reason" | "group"; value: string; label: string; ids?: string[] } | null>(null);
  const { data, error, loading } = useReport<Data>("returns", { from: range.from, to: range.to, by });

  const rows = (data?.rows ?? []).filter((r) =>
    !only ? true : only.kind === "reason" ? r.reason === only.value : r.productIds.some((id) => only.ids?.includes(id)),
  );

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      "returns",
      ["تاریخ", "شماره برگشت", "مشتری", "اقلام", "تعداد", "مبلغ", "دلیل", "فاکتور فروش", "تاریخ فروش", "روز تا برگشت", "فروشنده", "محل", "صندوقدار"],
      rows.map((r) => [jd(r.date), r.number, r.partyName, r.items, r.qty, r.amount, r.reason, r.ref?.number, r.ref ? jd(r.ref.date) : "", r.days, r.seller, r.where, r.cashier]),
    );
  }

  const pick = (o: typeof only) => {
    setOnly(o);
    setTimeout(() => document.getElementById("returns-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  return (
    <ReportFrame
      title="مرجوعی‌ها"
      help="accountingReturnsReport"
      desc="چه چیزی، چرا و چقدر برمی‌گردد — به تفکیک دلیل و کالا، با نرخ برگشت نسبت به فروش همان بازه."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={<RangeBar value={range} onChange={setRange} />}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">مرجوعی</p>
              <p className="mt-1 text-lg font-black tabular-nums">{faNum(data.summary.count)}</p>
              <p className="text-[11px] text-gray-500">{faNum(data.summary.qty)} عدد کالا</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">مبلغ برگشتی</p>
              <p className="mt-1 text-lg"><Amt v={data.summary.amount} strong /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">نرخ مرجوعی</p>
              <p className="mt-1 text-lg font-black tabular-nums">{pct(data.summary.rateBp)}</p>
              <p className="text-[11px] text-gray-500">از فروش <Amt v={data.summary.salesAmount} muted /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">میانگین روز تا برگشت</p>
              <p className="mt-1 text-lg font-black tabular-nums">{data.summary.avgDays === null ? "—" : faNum(data.summary.avgDays)}</p>
            </Card>
          </div>

          {data.reasons.length > 0 && (
            <Card className="p-4 space-y-3">
              <SectionTitle title="به تفکیک دلیل" />
              <div className="space-y-2">
                {data.reasons.map((r) => {
                  const w = data.summary.count ? (r.count / data.summary.count) * 100 : 0;
                  return (
                    <button key={r.reason} onClick={() => pick({ kind: "reason", value: r.reason, label: r.reason })} className="block w-full text-right">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">{r.reason}</span>
                        <span className="tabular-nums text-gray-500">
                          {faNum(r.count)} مرجوعی · {faNum(r.qty)} عدد · <Amt v={r.amount} />
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${w}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {data.groups.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
                <SectionTitle title={by === "model" ? "بیشترین برگشت — مدل" : "بیشترین برگشت — کالا"} />
                <Segmented value={by} onChange={(v) => (setBy(v), setOnly(null))} options={[{ value: "model", label: "مدل (همه‌ی رنگ/سایزها)" }, { value: "item", label: "هر کالا" }]} />
              </div>
              <Table
                head={
                  <tr>
                    <th className={th}>{by === "model" ? "مدل" : "کالا"}</th>
                    <th className={thNum}>برگشتی</th>
                    <th className={thNum}>فروش بازه</th>
                    <th className={thNum}>نرخ برگشت</th>
                    <th className={thNum}>مبلغ</th>
                    <th className={th}>دلیل اصلی</th>
                  </tr>
                }
              >
                {data.groups.slice(0, 50).map((g) => (
                  <tr key={g.key}>
                    <td className={td}>
                      <button onClick={() => pick({ kind: "group", value: g.key, label: g.title, ids: g.productIds })} className={`${link} text-right`}>
                        {g.title}
                      </button>
                      {g.code && <span className="mr-2 text-[11px] text-gray-400">{g.code}</span>}
                    </td>
                    <td className={`${tdNum} font-black tabular-nums`}>{faNum(g.qty)}</td>
                    <td className={`${tdNum} tabular-nums text-gray-500`}>{faNum(g.sold)}</td>
                    <td className={`${tdNum} tabular-nums ${g.rateBp !== null && g.rateBp >= 2000 ? "font-black text-rose-600" : ""}`}>{pct(g.rateBp)}</td>
                    <td className={tdNum}><Amt v={g.amount} /></td>
                    <td className={`${td} text-xs text-gray-500`}>{g.topReason}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          <Card className="overflow-hidden" >
            <div id="returns-list" className="flex flex-wrap items-center gap-2 px-4 pt-4">
              <SectionTitle title={`فهرست مرجوعی‌ها (${faNum(rows.length)})`} />
              {only && (
                <button onClick={() => setOnly(null)} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/15">
                  فقط «{only.label}» ✕
                </button>
              )}
            </div>
            {rows.length ? (
              <Table
                head={
                  <tr>
                    <th className={th}>تاریخ</th>
                    <th className={th}>مشتری</th>
                    <th className={th}>اقلام</th>
                    <th className={thNum}>مبلغ</th>
                    <th className={th}>دلیل</th>
                    <th className={th}>فروش اولیه</th>
                    <th className={th}>کجا</th>
                  </tr>
                }
              >
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>
                      <Link href={`/admin/accounting/invoices/${r.id}`} className={link}>
                        {jd(r.date)}
                      </Link>
                      <span className="block text-[11px] text-gray-400">برگشت {faNum(r.number ?? 0)}</span>
                    </td>
                    <td className={td}>
                      <Link href={`/admin/accounting/parties/${r.partyId}`} className="hover:text-blue-600">
                        {r.partyName}
                      </Link>
                    </td>
                    <td className={`${td} max-w-[16rem] text-xs`}>
                      <span className="line-clamp-2">{r.items}</span>
                    </td>
                    <td className={tdNum}><Amt v={r.amount} /></td>
                    <td className={`${td} text-xs`}>{r.reason}</td>
                    <td className={`${td} text-xs`}>
                      {r.ref ? (
                        <>
                          <Link href={`/admin/accounting/invoices/${r.ref.id}`} className={link}>
                            {r.ref.ticket ? `رسید ${faNum(r.ref.ticket)}` : `فاکتور ${faNum(r.ref.number ?? 0)}`}
                          </Link>
                          <span className="block text-gray-400">
                            {jd(r.ref.date)} · {r.days === 0 ? "همان روز" : `${faNum(r.days ?? 0)} روز بعد`}
                            {r.seller && ` · ${r.seller}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">بی‌مرجع</span>
                      )}
                    </td>
                    <td className={`${td} text-xs text-gray-500`}>
                      {r.where}
                      {r.cashier && <span className="block">{r.cashier}</span>}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="px-4 pb-4 text-sm text-gray-500">در این بازه مرجوعی‌ای نیست.</p>
            )}
            {data.truncated && <p className="px-4 pb-3 text-[11px] text-amber-600">فقط ۵۰۰ مرجوعی آخر در فهرست آمده؛ جمع‌ها کامل‌اند.</p>}
          </Card>
        </>
      )}
    </ReportFrame>
  );
}
