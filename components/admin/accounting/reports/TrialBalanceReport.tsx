"use client";

/** تراز آزمایشی — دو، چهار و شش ستونی؛ گروه، کل، معین یا تفصیلی (بخش ۱۱) */

import Link from "next/link";
import { useState } from "react";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Badge, Chips } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

type Level = "GROUP" | "LEDGER" | "SUBLEDGER" | "DETAIL";
type Cols = "2" | "4" | "6";
interface Row {
  key: string;
  accountId: string;
  code: string;
  name: string;
  detail: { kind: "party" | "treasury"; id: string; name: string } | null;
  openDebit: string;
  openCredit: string;
  debit: string;
  credit: string;
  closeDebit: string;
  closeCredit: string;
}
type Totals = Omit<Row, "key" | "accountId" | "code" | "name" | "detail">;
interface Data {
  rows: Row[];
  totals: Totals;
  balanced: boolean;
}

const COLS: Record<Cols, { key: keyof Totals; label: string }[]> = {
  "2": [
    { key: "closeDebit", label: "مانده بدهکار" },
    { key: "closeCredit", label: "مانده بستانکار" },
  ],
  "4": [
    { key: "debit", label: "گردش بدهکار" },
    { key: "credit", label: "گردش بستانکار" },
    { key: "closeDebit", label: "مانده بدهکار" },
    { key: "closeCredit", label: "مانده بستانکار" },
  ],
  "6": [
    { key: "openDebit", label: "ابتدای دوره بدهکار" },
    { key: "openCredit", label: "ابتدای دوره بستانکار" },
    { key: "debit", label: "گردش بدهکار" },
    { key: "credit", label: "گردش بستانکار" },
    { key: "closeDebit", label: "مانده بدهکار" },
    { key: "closeCredit", label: "مانده بستانکار" },
  ],
};

export default function TrialBalanceReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [level, setLevel] = useState<Level>("SUBLEDGER");
  const [cols, setCols] = useState<Cols>("4");
  const { data, error, loading } = useReport<Data>("trial", { from: range.from, to: range.to, level });
  const columns = COLS[cols];

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `trial-balance-${level.toLowerCase()}`,
      ["کد", "حساب", ...(level === "DETAIL" ? ["تفصیلی"] : []), ...columns.map((c) => c.label)],
      [
        ...data.rows.map((r) => [r.code, r.name, ...(level === "DETAIL" ? [r.detail?.name ?? ""] : []), ...columns.map((c) => r[c.key])]),
        ["", "جمع", ...(level === "DETAIL" ? [""] : []), ...columns.map((c) => data.totals[c.key])],
      ],
    );
  }

  const detailHref = (r: Row) =>
    r.detail ? (r.detail.kind === "party" ? `/admin/accounting/parties/${r.detail.id}` : `/admin/accounting/treasury/${r.detail.id}`) : `/admin/accounting/accounts/${r.accountId}`;

  return (
    <ReportFrame
      title="تراز آزمایشی"
      help="accountingTrial"
      desc="مانده و گردش همه‌ی حساب‌ها. جمع بدهکار هر ستون با بستانکارش برابر است."
      printSub={`${rangeText(range)} — ${cols} ستونی`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <RangeBar value={range} onChange={setRange} />
          <div className="flex flex-wrap gap-3">
            <Chips<Level>
              value={level}
              onChange={setLevel}
              options={[
                { value: "GROUP", label: "گروه" },
                { value: "LEDGER", label: "کل" },
                { value: "SUBLEDGER", label: "معین" },
                { value: "DETAIL", label: "تفصیلی" },
              ]}
            />
            <Chips<Cols>
              value={cols}
              onChange={setCols}
              options={[
                { value: "2", label: "دو ستونی" },
                { value: "4", label: "چهار ستونی" },
                { value: "6", label: "شش ستونی" },
              ]}
            />
          </div>
        </>
      }
    >
      {data && (
        <>
          {data.balanced ? <Badge tone="green">✓ تراز است</Badge> : <Badge tone="red">✗ جمع بدهکار و بستانکار برابر نیست</Badge>}
          <Table
            head={
              <tr>
                <th className={th}>کد</th>
                <th className={th}>حساب</th>
                {level === "DETAIL" && <th className={th}>تفصیلی</th>}
                {columns.map((c) => (
                  <th key={c.key} className={thNum}>
                    {c.label}
                  </th>
                ))}
              </tr>
            }
            foot={
              <tr>
                <td className={td} colSpan={level === "DETAIL" ? 3 : 2}>
                  جمع
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={tdNum}>
                    <Amt v={data.totals[c.key]} strong />
                  </td>
                ))}
              </tr>
            }
          >
            {data.rows.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} tabular-nums text-gray-500`}>{r.code}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/admin/accounting/accounts/${r.accountId}`} className="hover:text-blue-600">
                    {r.name}
                  </Link>
                </td>
                {level === "DETAIL" && (
                  <td className={`${td} whitespace-nowrap`}>
                    {r.detail ? (
                      <Link href={detailHref(r)} className="hover:text-blue-600">
                        {r.detail.name}
                      </Link>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={tdNum}>
                    <Amt v={r[c.key]} />
                  </td>
                ))}
              </tr>
            ))}
            {!data.rows.length && (
              <tr>
                <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={columns.length + 3}>
                  در این بازه سندی نیست.
                </td>
              </tr>
            )}
          </Table>
        </>
      )}
    </ReportFrame>
  );
}
