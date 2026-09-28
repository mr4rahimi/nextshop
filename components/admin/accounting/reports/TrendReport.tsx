"use client";

/**
 * روند ماهانه (فاز ۱۰) — فروش خالص، سود ناخالص و هزینه‌ها؛ و ورود و خروج نقد.
 * دو نمودار جدا (نه دو محور روی یک نمودار)؛ هر نمودار «نمای جدول» دارد
 * (تله‌ی ۳۲: فیروزه‌ای روشن کنتراست کم دارد). پالت همان `SERIES` اعتبارسنجی‌شده.
 */

import { useState } from "react";
import { ChartLine, Table2 } from "lucide-react";
import { MultiLineChart, type Series } from "@/components/admin/reports/charts";
import { faNum } from "@/lib/accounting/money";
import { btn, Card, Chips, SectionTitle } from "../ui";
import { Amt, downloadCsv, ReportFrame, SERIES, Table, td, tdNum, th, thNum, useIsDark, useReport } from "./kit";

interface Data {
  months: { key: string; from: string; to: string }[];
  sales: string[];
  cogs: string[];
  gross: string[];
  otherIncome: string[];
  expenses: string[];
  net: string[];
  cashIn: string[];
  cashOut: string[];
  totals: Record<"sales" | "gross" | "expenses" | "net" | "cashIn" | "cashOut", string>;
}

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${faNum(String(y).slice(2))}`;
};

export default function TrendReport() {
  const [months, setMonths] = useState<"6" | "12" | "24">("12");
  const dark = useIsDark();
  const pal = dark ? SERIES.dark : SERIES.light;
  const { data, error, loading } = useReport<Data>("trend", { months });
  const [tablePl, setTablePl] = useState(false);
  const [tableCash, setTableCash] = useState(false);

  const num = (xs: string[]) => xs.map((x) => Number(x));
  const plSeries: Series[] = data
    ? [
        { key: "sales", label: "فروش خالص", color: pal.sales, data: num(data.sales) },
        { key: "gross", label: "سود ناخالص", color: pal.gross, data: num(data.gross) },
        { key: "expenses", label: "هزینه‌ها", color: pal.expenses, data: num(data.expenses) },
      ]
    : [];
  const cashSeries: Series[] = data
    ? [
        { key: "in", label: "ورود نقد", color: pal.sales, data: num(data.cashIn) },
        { key: "out", label: "خروج نقد", color: pal.expenses, data: num(data.cashOut) },
      ]
    : [];

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      "trend",
      ["ماه", "فروش خالص", "بهای تمام‌شده", "سود ناخالص", "سایر درآمدها", "هزینه‌ها", "سود خالص", "ورود نقد", "خروج نقد"],
      data.months.map((m, i) => [monthLabel(m.key), data.sales[i], data.cogs[i], data.gross[i], data.otherIncome[i], data.expenses[i], data.net[i], data.cashIn[i], data.cashOut[i]]),
    );
  }

  const keys = data?.months.map((m) => m.key) ?? [];

  return (
    <ReportFrame
      title="روند ماهانه"
      help="accountingTrend"
      desc="فروش، سود، هزینه و جریان نقد ماه به ماه — همان عددهای سود و زیان، فقط در طول زمان."
      printSub={data ? `${monthLabel(keys[0])} تا ${monthLabel(keys[keys.length - 1])}` : undefined}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <Chips
          value={months}
          onChange={setMonths}
          options={[
            { value: "6", label: "۶ ماه" },
            { value: "12", label: "۱۲ ماه" },
            { value: "24", label: "۲۴ ماه" },
          ]}
        />
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="فروش خالص" v={data.totals.sales} />
            <Tile label="سود ناخالص" v={data.totals.gross} />
            <Tile label="هزینه‌ها" v={data.totals.expenses} />
            <Tile label="سود خالص" v={data.totals.net} />
          </div>

          <Card className="p-4 space-y-3">
            <SectionTitle title="فروش، سود و هزینه" actions={<ViewToggle table={tablePl} onToggle={() => setTablePl((x) => !x)} />} />
            {tablePl ? (
              <MonthTable keys={keys} rows={[["فروش خالص", data.sales], ["سود ناخالص", data.gross], ["هزینه‌ها", data.expenses], ["سود خالص", data.net]]} />
            ) : (
              <MultiLineChart id="acc-trend-pl" days={keys} series={plSeries} height={260} label={monthLabel} linear />
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <SectionTitle title="جریان نقد — صندوق‌ها و بانک‌ها" actions={<ViewToggle table={tableCash} onToggle={() => setTableCash((x) => !x)} />} />
            <p className="text-[11px] text-gray-400 -mt-2">انتقال بین حساب‌های خودتان حساب نشده است.</p>
            {tableCash ? (
              <MonthTable
                keys={keys}
                rows={[
                  ["ورود", data.cashIn],
                  ["خروج", data.cashOut],
                  ["خالص", data.cashIn.map((x, i) => String(BigInt(x) - BigInt(data.cashOut[i])))],
                ]}
              />
            ) : (
              <MultiLineChart id="acc-trend-cash" days={keys} series={cashSeries} height={220} label={monthLabel} linear />
            )}
          </Card>
        </>
      )}
    </ReportFrame>
  );
}

function Tile({ label, v }: { label: string; v: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg mt-1">
        <Amt v={v} strong />
      </p>
    </Card>
  );
}

function ViewToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`${btn.small} acc-noprint`}>
      {table ? <ChartLine className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
      {table ? "نمودار" : "نمای جدول"}
    </button>
  );
}

function MonthTable({ keys, rows }: { keys: string[]; rows: [string, string[]][] }) {
  return (
    <Table
      head={
        <tr>
          <th className={th}>ماه</th>
          {rows.map(([l]) => (
            <th key={l} className={thNum}>
              {l}
            </th>
          ))}
        </tr>
      }
    >
      {keys.map((k, i) => (
        <tr key={k}>
          <td className={`${td} whitespace-nowrap`}>{monthLabel(k)}</td>
          {rows.map(([l, xs]) => (
            <td key={l} className={tdNum}>
              <Amt v={xs[i]} />
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}
