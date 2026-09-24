"use client";

/** گردش صندوق و بانک — موجودی ابتدا، ورود، خروج، موجودی پایان (بخش ۱۱) */

import Link from "next/link";
import { useState } from "react";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { KIND_META } from "../TreasuryForm";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

interface Row {
  id: string;
  name: string;
  kind: keyof typeof KIND_META;
  opening: string;
  in: string;
  out: string;
  closing: string;
}
interface Data {
  rows: Row[];
  totals: { opening: string; in: string; out: string; closing: string };
}

export default function TreasuryFlowReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const { data, error, loading } = useReport<Data>("treasury", { from: range.from, to: range.to });

  function exportCsv() {
    if (!data) return;
    downloadCsv("treasury-flow", ["صندوق/بانک", "نوع", "موجودی ابتدا", "ورود", "خروج", "موجودی پایان"], [
      ...data.rows.map((r) => [r.name, KIND_META[r.kind].label, r.opening, r.in, r.out, r.closing]),
      ["جمع", "", data.totals.opening, data.totals.in, data.totals.out, data.totals.closing],
    ]);
  }

  return (
    <ReportFrame
      title="گردش صندوق و بانک"
      help="accountingTreasuryReport"
      desc="چقدر پول در هر صندوق و حساب بود، چقدر آمد، چقدر رفت. برای ریز هر حساب روی نامش بزنید."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={<RangeBar value={range} onChange={setRange} />}
    >
      {data && (
        <Table
          head={
            <tr>
              <th className={th}>صندوق / بانک</th>
              <th className={thNum}>موجودی ابتدا</th>
              <th className={thNum}>ورود</th>
              <th className={thNum}>خروج</th>
              <th className={thNum}>موجودی پایان</th>
            </tr>
          }
          foot={
            <tr>
              <td className={td}>جمع</td>
              <td className={tdNum}><Amt v={data.totals.opening} strong /></td>
              <td className={tdNum}><Amt v={data.totals.in} strong /></td>
              <td className={tdNum}><Amt v={data.totals.out} strong /></td>
              <td className={tdNum}><Amt v={data.totals.closing} strong /></td>
            </tr>
          }
        >
          {data.rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
              <td className={`${td} whitespace-nowrap`}>
                <Link href={`/admin/accounting/treasury/${r.id}`} className="font-bold hover:text-blue-600">
                  {KIND_META[r.kind].icon} {r.name}
                </Link>
              </td>
              <td className={tdNum}><Amt v={r.opening} muted /></td>
              <td className={tdNum}><Amt v={r.in} /></td>
              <td className={tdNum}><Amt v={r.out} /></td>
              <td className={tdNum}><Amt v={r.closing} strong /></td>
            </tr>
          ))}
        </Table>
      )}
    </ReportFrame>
  );
}
