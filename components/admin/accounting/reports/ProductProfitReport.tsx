"use client";

/** سود هر کالا، دسته یا کانال — فروش و بها از فاکتور و کاردکس (بخش ۱۱) */

import { useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Card, Chips } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

type By = "product" | "category" | "channel";
interface Row {
  key: string;
  label: string;
  qty: number;
  revenue: string;
  cost: string;
  profit: string;
  marginBp: number | null;
}
interface Data {
  rows: Row[];
  totals: { qty: number; revenue: string; cost: string; profit: string };
}

const margin = (bp: number | null) => (bp === null ? "—" : `${(bp / 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`);

export default function ProductProfitReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [by, setBy] = useState<By>("product");
  const { data, error, loading } = useReport<Data>("profit", { from: range.from, to: range.to, by });
  const label = by === "product" ? "کالا" : by === "category" ? "دسته" : "کانال";

  function exportCsv() {
    if (!data) return;
    downloadCsv(`profit-by-${by}`, [label, "تعداد", "فروش (بی‌مالیات)", "بهای تمام‌شده", "سود", "درصد سود"], [
      ...data.rows.map((r) => [r.label, r.qty, r.revenue, r.cost, r.profit, r.marginBp === null ? "" : r.marginBp / 100]),
      ["جمع", data.totals.qty, data.totals.revenue, data.totals.cost, data.totals.profit, ""],
    ]);
  }
  const totalMargin = data && BigInt(data.totals.revenue) > 0n ? Number((BigInt(data.totals.profit) * 10_000n) / BigInt(data.totals.revenue)) : null;

  return (
    <ReportFrame
      title="سود هر کالا، دسته و کانال"
      help="accountingProfit"
      desc="فروش هر ردیف پس از تخفیف و بدون مالیات، منهای بهای همان کالا در لحظه‌ی فروش. برگشتی‌ها کم می‌شوند."
      printSub={`${rangeText(range)} — به تفکیک ${label}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <RangeBar value={range} onChange={setRange} />
          <Chips<By>
            value={by}
            onChange={setBy}
            options={[
              { value: "product", label: "کالا" },
              { value: "category", label: "دسته" },
              { value: "channel", label: "کانال فروش" },
            ]}
          />
        </>
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">فروش</p>
              <p className="text-lg mt-1"><Amt v={data.totals.revenue} strong /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">بهای تمام‌شده</p>
              <p className="text-lg mt-1"><Amt v={data.totals.cost} strong /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">سود</p>
              <p className="text-lg mt-1"><Amt v={data.totals.profit} strong /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">درصد سود</p>
              <p className="text-lg mt-1 font-black">{margin(totalMargin)}</p>
            </Card>
          </div>
          <Table
            head={
              <tr>
                <th className={th}>{label}</th>
                <th className={thNum}>تعداد</th>
                <th className={thNum}>فروش</th>
                <th className={thNum}>بهای تمام‌شده</th>
                <th className={thNum}>سود</th>
                <th className={thNum}>درصد سود</th>
              </tr>
            }
            foot={
              <tr>
                <td className={td}>جمع</td>
                <td className={tdNum}>{faNum(data.totals.qty)}</td>
                <td className={tdNum}><Amt v={data.totals.revenue} strong /></td>
                <td className={tdNum}><Amt v={data.totals.cost} strong /></td>
                <td className={tdNum}><Amt v={data.totals.profit} strong /></td>
                <td className={tdNum}>{margin(totalMargin)}</td>
              </tr>
            }
          >
            {data.rows.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} max-w-[18rem] truncate`}>{r.label}</td>
                <td className={`${tdNum} tabular-nums`}>{faNum(r.qty)}</td>
                <td className={tdNum}><Amt v={r.revenue} /></td>
                <td className={tdNum}><Amt v={r.cost} muted /></td>
                <td className={tdNum}><Amt v={r.profit} strong /></td>
                <td className={`${tdNum} tabular-nums ${r.marginBp !== null && r.marginBp < 0 ? "text-red-600" : ""}`}>{margin(r.marginBp)}</td>
              </tr>
            ))}
            {!data.rows.length && (
              <tr>
                <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={6}>
                  در این بازه فاکتور فروشی صادر نشده.
                </td>
              </tr>
            )}
          </Table>
          <p className="text-[11px] text-gray-400 leading-5">
            کرایه‌ی ارسال و مالیات در این گزارش نیستند؛ برای همین جمع آن با «سود ناخالص» گزارش سود و زیان کمی فرق دارد.
          </p>
        </>
      )}
    </ReportFrame>
  );
}
