"use client";

/** ترازنامه — دارایی = بدهی + حقوق صاحبان سرمایه + سود بسته‌نشده (بخش ۱۱) */

import Link from "next/link";
import { useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { Badge, Card, Field } from "../ui";
import { Amt, downloadCsv, ReportFrame, useReport, type Cell } from "./kit";

interface Line {
  accountId: string;
  name: string;
  amount: string;
}
interface Group {
  key: string;
  title: string;
  lines: Line[];
  total: string;
}
interface Data {
  assets: Group[];
  liabilities: Group[];
  equity: Group[];
  totals: { assets: string; liabilities: string; equity: string; profit: string };
  balanced: boolean;
}

export default function BalanceSheetReport() {
  const [asOf, setAsOf] = useState(() => dayValue(todayKey()));
  const { data, error, loading } = useReport<Data>("balance", { asOf });

  function exportCsv() {
    if (!data) return;
    const rows: Cell[][] = [];
    const side = (title: string, gs: Group[], total: string) => {
      rows.push([title, ""]);
      for (const g of gs) {
        rows.push([`  ${g.title}`, g.total]);
        for (const l of g.lines) rows.push([`    ${l.name}`, l.amount]);
      }
      rows.push([`جمع ${title}`, total]);
    };
    side("دارایی‌ها", data.assets, data.totals.assets);
    side("بدهی‌ها", data.liabilities, data.totals.liabilities);
    side("حقوق صاحبان سرمایه", data.equity, data.totals.equity);
    rows.push(["سود (زیان) دوره — بسته‌نشده", data.totals.profit]);
    downloadCsv(`balance-sheet-${asOf}`, ["شرح", "مبلغ"], rows);
  }

  const liabEq = data ? BigInt(data.totals.liabilities) + BigInt(data.totals.equity) + BigInt(data.totals.profit) : 0n;

  return (
    <ReportFrame
      title="ترازنامه"
      help="accountingBalanceSheet"
      desc="آنچه کسب‌وکار دارد، آنچه بدهکار است، و سهم صاحبان آن — در یک روز."
      printSub={`در تاریخ ${formatJalali(new Date(asOf))}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <div className="max-w-xs">
          <Field label="در تاریخ">
            <JalaliDatePicker value={asOf} onChange={(v: string) => v && setAsOf(v)} clearable={false} />
          </Field>
        </div>
      }
    >
      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {data.balanced ? <Badge tone="green">✓ تراز است</Badge> : <Badge tone="red">✗ تراز نیست — با پشتیبانی تماس بگیرید</Badge>}
            <span className="text-gray-500">
              دارایی‌ها <Amt v={data.totals.assets} strong /> = بدهی و سرمایه و سود <Amt v={liabEq} strong />
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Side title="دارایی‌ها" groups={data.assets} total={data.totals.assets} />
            <div className="space-y-4">
              <Side title="بدهی‌ها" groups={data.liabilities} total={data.totals.liabilities} />
              <Side
                title="حقوق صاحبان سرمایه"
                groups={data.equity}
                total={String(BigInt(data.totals.equity) + BigInt(data.totals.profit))}
                extra={{ label: BigInt(data.totals.profit) < 0n ? "زیان دوره (بسته‌نشده)" : "سود دوره (بسته‌نشده)", amount: data.totals.profit }}
              />
            </div>
          </div>
        </>
      )}
    </ReportFrame>
  );
}

function Side({ title, groups, total, extra }: { title: string; groups: Group[]; total: string; extra?: { label: string; amount: string } }) {
  return (
    <Card className="overflow-hidden">
      <p className="px-4 py-3 text-sm font-black border-b border-gray-100 dark:border-white/5">{title}</p>
      <div className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
        {groups.map((g) => (
          <div key={g.key} className="px-4 py-2.5">
            <div className="flex justify-between font-bold">
              <span>{g.title}</span>
              <Amt v={g.total} />
            </div>
            {g.lines.map((l) => (
              <Link key={l.accountId} href={`/admin/accounting/accounts/${l.accountId}`} className="flex justify-between pr-4 py-0.5 text-xs text-gray-500 hover:text-blue-600">
                <span>{l.name}</span>
                <Amt v={l.amount} muted />
              </Link>
            ))}
          </div>
        ))}
        {extra && (
          <div className="px-4 py-2.5 flex justify-between font-bold">
            <span>{extra.label}</span>
            <Amt v={extra.amount} />
          </div>
        )}
        {!groups.length && !extra && <p className="px-4 py-4 text-xs text-gray-400">مانده‌ای ندارد.</p>}
      </div>
      <div className="px-4 py-3 flex justify-between font-black bg-gray-50 dark:bg-white/5">
        <span>جمع {title}</span>
        <Amt v={total} strong />
      </div>
    </Card>
  );
}
