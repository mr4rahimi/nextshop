"use client";

/** هزینه‌ها به تفکیک سرفصل — از دفتر، با نمودار و مقایسه (بخش ۱۱) */

import Link from "next/link";
import { useState } from "react";
import { HBarChart } from "@/components/admin/reports/charts";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Card, SectionTitle } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, Change, downloadCsv, ReportFrame, SERIES, Table, td, tdNum, th, thNum, useIsDark, useReport } from "./kit";

interface Row {
  accountId: string;
  code: string;
  name: string;
  group: string;
  amount: string;
  prev: string | null;
}
interface Data {
  rows: Row[];
  total: string;
  prevTotal: string | null;
}

export default function ExpenseReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [compare, setCompare] = useState(true);
  const dark = useIsDark();
  const { data, error, loading } = useReport<Data>("expenses", { from: range.from, to: range.to, compare: compare && range.from ? "1" : null });
  const hasPrev = data?.prevTotal !== null && data?.prevTotal !== undefined;

  function exportCsv() {
    if (!data) return;
    downloadCsv("expenses", ["کد", "سرفصل", "گروه", "مبلغ", ...(hasPrev ? ["دوره‌ی قبل"] : [])], [
      ...data.rows.map((r) => [r.code, r.name, r.group, r.amount, ...(hasPrev ? [r.prev] : [])]),
      ["", "جمع", "", data.total, ...(hasPrev ? [data.prevTotal] : [])],
    ]);
  }

  const color = (dark ? SERIES.dark : SERIES.light).expenses;
  return (
    <ReportFrame
      title="گزارش هزینه‌ها"
      help="accountingExpenseReport"
      desc="همه‌ی هزینه‌های ثبت‌شده در دفتر — از فرم هزینه، تسویه‌ی پورسانت، کارمزدها و سند دستی."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <RangeBar value={range} onChange={setRange} />
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} disabled={!range.from} />
            مقایسه با دوره‌ی هم‌طولِ قبل
          </label>
        </>
      }
    >
      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] items-start">
            <Card className="p-4 space-y-3">
              <SectionTitle title="جمع هزینه‌ها" />
              <p className="text-2xl"><Amt v={data.total} strong /></p>
              {hasPrev && (
                <p className="text-xs text-gray-500">
                  دوره‌ی قبل <Amt v={data.prevTotal} muted /> <Change cur={data.total} prev={data.prevTotal} goodWhenUp={false} />
                </p>
              )}
              <HBarChart items={data.rows.filter((r) => BigInt(r.amount) > 0n).slice(0, 10).map((r) => ({ label: r.name, value: Number(r.amount), color }))} />
            </Card>
            <Table
              head={
                <tr>
                  <th className={th}>سرفصل</th>
                  <th className={thNum}>مبلغ</th>
                  {hasPrev && (
                    <>
                      <th className={thNum}>دوره‌ی قبل</th>
                      <th className={thNum}>تغییر</th>
                    </>
                  )}
                </tr>
              }
              foot={
                <tr>
                  <td className={td}>جمع</td>
                  <td className={tdNum}><Amt v={data.total} strong /></td>
                  {hasPrev && (
                    <>
                      <td className={tdNum}><Amt v={data.prevTotal} /></td>
                      <td className={tdNum}><Change cur={data.total} prev={data.prevTotal} goodWhenUp={false} /></td>
                    </>
                  )}
                </tr>
              }
            >
              {data.rows.map((r) => (
                <tr key={r.accountId} className="hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className={td}>
                    <Link href={`/admin/accounting/accounts/${r.accountId}`} className="font-bold hover:text-blue-600">
                      {r.name}
                    </Link>
                    <span className="block text-[11px] text-gray-400">{r.group}</span>
                  </td>
                  <td className={tdNum}><Amt v={r.amount} /></td>
                  {hasPrev && (
                    <>
                      <td className={tdNum}><Amt v={r.prev} muted /></td>
                      <td className={tdNum}><Change cur={r.amount} prev={r.prev} goodWhenUp={false} /></td>
                    </>
                  )}
                </tr>
              ))}
              {!data.rows.length && (
                <tr>
                  <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={4}>
                    در این بازه هزینه‌ای ثبت نشده.
                  </td>
                </tr>
              )}
            </Table>
          </div>
        </>
      )}
    </ReportFrame>
  );
}
