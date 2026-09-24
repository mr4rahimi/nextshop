"use client";

/** سود و زیان — docs/plans/accounting.md بخش ۱۱ */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { Card } from "../ui";
import { Amt, Change, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport, type Cell } from "./kit";

interface Line {
  accountId: string;
  code: string;
  name: string;
  amount: string;
  prev: string | null;
}
interface Group {
  key: string;
  title: string;
  lines: Line[];
  total: string;
  prevTotal: string | null;
}
interface Figures {
  netSales: string;
  gross: string;
  expenses: string;
  otherIncome: string;
  net: string;
}
interface Data {
  groups: { sales: Group; cogs: Group; otherIncome: Group; expenses: Group[] };
  totals: Figures;
  prevTotals: Figures | null;
}

export function rangeText(r: Range): string {
  if (!r.from && !r.to) return "از ابتدا تا امروز";
  return `از ${r.from ? formatJalali(new Date(r.from)) : "ابتدا"} تا ${r.to ? formatJalali(new Date(r.to)) : "امروز"}`;
}

export default function ProfitLossReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [compare, setCompare] = useState(true);
  const { data, error, loading } = useReport<Data>("pl", { from: range.from, to: range.to, compare: compare && range.from ? "1" : null });
  const hasPrev = !!data?.prevTotals;

  function exportCsv() {
    if (!data) return;
    const rows: Cell[][] = [];
    const push = (label: string, cur: string, prev: string | null) => rows.push(hasPrev ? [label, cur, prev ?? ""] : [label, cur]);
    const group = (g: Group) => {
      for (const l of g.lines) push(`   ${l.name}`, l.amount, l.prev);
    };
    group(data.groups.sales);
    push("فروش خالص", data.totals.netSales, data.prevTotals?.netSales ?? null);
    group(data.groups.cogs);
    push("سود ناخالص", data.totals.gross, data.prevTotals?.gross ?? null);
    group(data.groups.otherIncome);
    for (const g of data.groups.expenses) group(g);
    push("جمع هزینه‌ها", data.totals.expenses, data.prevTotals?.expenses ?? null);
    push("سود (زیان) خالص", data.totals.net, data.prevTotals?.net ?? null);
    downloadCsv("profit-loss", hasPrev ? ["شرح", "این دوره", "دوره‌ی قبل"] : ["شرح", "مبلغ"], rows);
  }

  const Row = ({ label, cur, prev, strong, indent, href, good = true }: { label: string; cur: string; prev: string | null; strong?: boolean; indent?: boolean; href?: string; good?: boolean }) => (
    <tr className={strong ? "bg-gray-50 dark:bg-white/5" : ""}>
      <td className={`${td} ${indent ? "pr-8 text-gray-600 dark:text-gray-300" : ""} ${strong ? "font-black" : ""}`}>
        {href ? (
          <Link href={href} className="hover:text-blue-600">
            {label}
          </Link>
        ) : (
          label
        )}
      </td>
      <td className={tdNum}>
        <Amt v={cur} strong={strong} />
      </td>
      {hasPrev && (
        <>
          <td className={tdNum}>
            <Amt v={prev} muted />
          </td>
          <td className={tdNum}>
            <Change cur={cur} prev={prev} goodWhenUp={good} />
          </td>
        </>
      )}
    </tr>
  );
  const lines = (g: Group, good = true) =>
    g.lines.map((l) => <Row key={l.accountId} label={l.name} cur={l.amount} prev={l.prev} indent href={`/admin/accounting/accounts/${l.accountId}`} good={good} />);

  return (
    <ReportFrame
      title="سود و زیان"
      help="accountingPL"
      desc="فروش منهای بهای کالای فروش‌رفته، منهای هزینه‌ها — سود واقعی کسب‌وکار در این بازه."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <RangeBar value={range} onChange={setRange} />
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} disabled={!range.from} />
            مقایسه با دوره‌ی هم‌طولِ قبل{!range.from && " (برای «همه» معنا ندارد)"}
          </label>
        </>
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: "فروش خالص", v: data.totals.netSales, p: data.prevTotals?.netSales ?? null },
              { l: "سود ناخالص", v: data.totals.gross, p: data.prevTotals?.gross ?? null },
              { l: "هزینه‌ها", v: data.totals.expenses, p: data.prevTotals?.expenses ?? null, bad: true },
              { l: "سود خالص", v: data.totals.net, p: data.prevTotals?.net ?? null },
            ].map((x) => (
              <Card key={x.l} className="p-4">
                <p className="text-[11px] text-gray-500">{x.l}</p>
                <p className="text-lg mt-1">
                  <Amt v={x.v} strong />
                </p>
                <Change cur={x.v} prev={x.p} goodWhenUp={!x.bad} />
              </Card>
            ))}
          </div>
          <Table
            head={
              <tr>
                <th className={th}>شرح</th>
                <th className={thNum}>{hasPrev ? "این دوره" : "مبلغ"}</th>
                {hasPrev && (
                  <>
                    <th className={thNum}>دوره‌ی قبل</th>
                    <th className={thNum}>تغییر</th>
                  </>
                )}
              </tr>
            }
          >
            {lines(data.groups.sales)}
            <Row label="فروش خالص" cur={data.totals.netSales} prev={data.prevTotals?.netSales ?? null} strong />
            {lines(data.groups.cogs, false)}
            <Row label="سود ناخالص" cur={data.totals.gross} prev={data.prevTotals?.gross ?? null} strong />
            {data.groups.otherIncome.lines.length > 0 && (
              <>
                {lines(data.groups.otherIncome)}
                <Row label="سایر درآمدها" cur={data.totals.otherIncome} prev={data.prevTotals?.otherIncome ?? null} strong />
              </>
            )}
            {data.groups.expenses.map((g) => (
              <GroupRows key={g.key} g={g} hasPrev={hasPrev} lines={lines(g, false)} />
            ))}
            <Row label="جمع هزینه‌ها" cur={data.totals.expenses} prev={data.prevTotals?.expenses ?? null} strong good={false} />
            <tr className="bg-blue-50 dark:bg-blue-500/10">
              <td className={`${td} font-black`}>{BigInt(data.totals.net) < 0n ? "زیان خالص" : "سود خالص"}</td>
              <td className={tdNum}>
                <Amt v={data.totals.net} strong />
              </td>
              {hasPrev && (
                <>
                  <td className={tdNum}>
                    <Amt v={data.prevTotals!.net} muted />
                  </td>
                  <td className={tdNum}>
                    <Change cur={data.totals.net} prev={data.prevTotals!.net} />
                  </td>
                </>
              )}
            </tr>
          </Table>
        </>
      )}
    </ReportFrame>
  );
}

function GroupRows({ g, hasPrev, lines }: { g: Group; hasPrev: boolean; lines: ReactNode }) {
  return (
    <>
      <tr>
        <td className={`${td} font-bold text-gray-500 text-xs pt-3`} colSpan={hasPrev ? 4 : 2}>
          {g.title}
        </td>
      </tr>
      {lines}
    </>
  );
}
