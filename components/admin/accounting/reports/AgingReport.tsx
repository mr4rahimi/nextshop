"use client";

/** سنی بدهی — طلب از مشتریان (یا بدهی به تأمین‌کنندگان) به تفکیک عمر (بخش ۱۱) */

import Link from "next/link";
import { useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import { Chips } from "../ui";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

type Bucket = "notDue" | "d30" | "d60" | "d90" | "d90plus";
interface Row {
  partyId: string;
  name: string;
  mobile: string | null;
  buckets: Record<Bucket, string>;
  invoices: number;
  open: string;
  balance: string;
}
interface Data {
  rows: Row[];
  totals: Record<Bucket | "open", string>;
}

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "notDue", label: "سررسید نشده" },
  { key: "d30", label: "۰ تا ۳۰ روز" },
  { key: "d60", label: "۳۱ تا ۶۰" },
  { key: "d90", label: "۶۱ تا ۹۰" },
  { key: "d90plus", label: "بیش از ۹۰" },
];

export default function AgingReport() {
  const [side, setSide] = useState<"sales" | "purchase">("sales");
  const { data, error, loading } = useReport<Data>("aging", { side });
  const sign = side === "sales" ? 1n : -1n;

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `aging-${side}`,
      ["شخص", "موبایل", "فاکتور باز", ...BUCKETS.map((b) => b.label), "جمع باز", "مانده‌ی کل شخص"],
      [
        ...data.rows.map((r) => [r.name, r.mobile, r.invoices, ...BUCKETS.map((b) => r.buckets[b.key]), r.open, String(BigInt(r.balance) * sign)]),
        ["جمع", "", "", ...BUCKETS.map((b) => data.totals[b.key]), data.totals.open, ""],
      ],
    );
  }

  return (
    <ReportFrame
      title="سنی بدهی"
      help="accountingAging"
      desc={side === "sales" ? "چه کسی چقدر و از کی به شما بدهکار است. عمر از سررسید فاکتور (یا تاریخش) تا امروز." : "به چه کسی چقدر و از کی بدهکارید."}
      printSub={`${side === "sales" ? "طلب از مشتریان" : "بدهی به تأمین‌کنندگان"} — ${formatJalali(todayKey())}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <Chips
          value={side}
          onChange={setSide}
          options={[
            { value: "sales", label: "طلب از مشتریان" },
            { value: "purchase", label: "بدهی به تأمین‌کنندگان" },
          ]}
        />
      }
    >
      {data && (
        <Table
          head={
            <tr>
              <th className={th}>شخص</th>
              {BUCKETS.map((b) => (
                <th key={b.key} className={thNum}>
                  {b.label}
                </th>
              ))}
              <th className={thNum}>جمع باز</th>
              <th className={thNum}>مانده‌ی کل شخص</th>
            </tr>
          }
          foot={
            <tr>
              <td className={td}>جمع</td>
              {BUCKETS.map((b) => (
                <td key={b.key} className={tdNum}>
                  <Amt v={data.totals[b.key]} strong />
                </td>
              ))}
              <td className={tdNum}>
                <Amt v={data.totals.open} strong />
              </td>
              <td />
            </tr>
          }
        >
          {data.rows.map((r) => (
            <tr key={r.partyId} className="hover:bg-gray-50 dark:hover:bg-white/5">
              <td className={`${td} whitespace-nowrap`}>
                <Link href={`/admin/accounting/parties/${r.partyId}`} className="font-bold hover:text-blue-600">
                  {r.name}
                </Link>
                <span className="block text-[11px] text-gray-400">{faNum(r.invoices)} فاکتور باز</span>
              </td>
              {BUCKETS.map((b) => (
                <td key={b.key} className={`${tdNum} ${b.key === "d90plus" && BigInt(r.buckets[b.key]) > 0n ? "bg-red-500/5" : ""}`}>
                  <Amt v={r.buckets[b.key]} />
                </td>
              ))}
              <td className={tdNum}>
                <Amt v={r.open} strong />
              </td>
              <td className={tdNum}>
                <Amt v={String(BigInt(r.balance) * sign)} muted />
              </td>
            </tr>
          ))}
          {!data.rows.length && (
            <tr>
              <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={8}>
                فاکتور باز ندارید.
              </td>
            </tr>
          )}
        </Table>
      )}
    </ReportFrame>
  );
}
