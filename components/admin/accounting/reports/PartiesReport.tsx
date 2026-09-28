"use client";

/**
 * حساب اشخاص — «کل حساب» همه‌ی اشخاص در یک بازه (فاز ۱۰): مانده‌ی ابتدا،
 * بدهکار، بستانکار، مانده‌ی پایان. لمس هر ردیف ← صورت‌حساب ریز همان شخص.
 */

import Link from "next/link";
import { useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, rangeQuery, type Range } from "../Statement";
import { Chips, inputCls } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

type Role = "all" | "customer" | "supplier" | "employee" | "marketplace";
type Show = "all" | "debtor" | "creditor" | "active";
interface Row {
  partyId: string;
  code: number;
  name: string;
  mobile: string | null;
  opening: string;
  debit: string;
  credit: string;
  closing: string;
}
interface Data {
  rows: Row[];
  totals: Record<"opening" | "debit" | "credit" | "closing" | "receivable" | "payable", string>;
}

export default function PartiesReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [role, setRole] = useState<Role>("all");
  const [show, setShow] = useState<Show>("all");
  const [q, setQ] = useState("");
  const rq = rangeQuery(range);
  const { data, error, loading } = useReport<Data>("parties", { ...Object.fromEntries(new URLSearchParams(rq)), role, show, q: q.trim() || null });

  function exportCsv() {
    if (!data) return;
    downloadCsv("parties", ["کد", "شخص", "موبایل", "مانده‌ی ابتدا", "بدهکار", "بستانکار", "مانده‌ی پایان", "وضعیت"], [
      ...data.rows.map((r) => [r.code, r.name, r.mobile, r.opening, r.debit, r.credit, r.closing, BigInt(r.closing) > 0n ? "بدهکار" : BigInt(r.closing) < 0n ? "بستانکار" : "تسویه"]),
      ["", "جمع", "", data.totals.opening, data.totals.debit, data.totals.credit, data.totals.closing, ""],
    ]);
  }

  return (
    <ReportFrame
      title="حساب اشخاص"
      help="accountingPartiesReport"
      desc="کل حساب همه‌ی اشخاص: هر کس اول بازه چقدر بدهکار یا بستانکار بود، در بازه چه گردشی داشت و الان کجاست."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <RangeBar value={range} onChange={setRange} />
          <div className="flex flex-wrap gap-2 items-center">
            <Chips
              value={role}
              onChange={setRole}
              options={[
                { value: "all", label: "همه" },
                { value: "customer", label: "مشتری‌ها" },
                { value: "supplier", label: "تأمین‌کننده‌ها" },
                { value: "employee", label: "کارکنان" },
                { value: "marketplace", label: "بازارگاه‌ها" },
              ]}
            />
            <Chips
              value={show}
              onChange={setShow}
              options={[
                { value: "all", label: "همه‌ی مانده‌ها" },
                { value: "debtor", label: "بدهکاران" },
                { value: "creditor", label: "بستانکاران" },
                { value: "active", label: "با گردش در بازه" },
              ]}
            />
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: نام یا موبایل" className={inputCls} />
        </>
      }
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>{faNum(data.rows.length)} شخص</span>
            <span>
              جمع طلب ما: <Amt v={data.totals.receivable} strong />
            </span>
            <span>
              جمع بدهی ما: <Amt v={data.totals.payable} strong />
            </span>
          </div>
          <Table
            head={
              <tr>
                <th className={th}>شخص</th>
                <th className={thNum}>مانده‌ی ابتدا</th>
                <th className={thNum}>بدهکار</th>
                <th className={thNum}>بستانکار</th>
                <th className={thNum}>مانده‌ی پایان</th>
                <th className={th}>تشخیص</th>
              </tr>
            }
            foot={
              <tr>
                <td className={td}>جمع</td>
                <td className={tdNum}>
                  <Amt v={data.totals.opening} strong />
                </td>
                <td className={tdNum}>
                  <Amt v={data.totals.debit} strong />
                </td>
                <td className={tdNum}>
                  <Amt v={data.totals.credit} strong />
                </td>
                <td className={tdNum}>
                  <Amt v={data.totals.closing} strong />
                </td>
                <td />
              </tr>
            }
          >
            {data.rows.map((r) => {
              const c = BigInt(r.closing);
              return (
                <tr key={r.partyId} className="hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={`/admin/accounting/parties/${r.partyId}`} className="font-bold hover:text-blue-600">
                      {r.name}
                    </Link>
                    <span className="block text-[11px] text-gray-400">
                      کد {faNum(r.code)}
                      {r.mobile && ` · ${faNum(r.mobile)}`}
                    </span>
                  </td>
                  <td className={tdNum}>
                    <Amt v={r.opening} muted />
                  </td>
                  <td className={tdNum}>
                    <Amt v={r.debit} />
                  </td>
                  <td className={tdNum}>
                    <Amt v={r.credit} />
                  </td>
                  <td className={tdNum}>
                    <Amt v={c < 0n ? String(-c) : r.closing} strong />
                  </td>
                  <td className={`${td} text-xs font-bold ${c > 0n ? "text-emerald-600" : c < 0n ? "text-red-600" : "text-gray-400"}`}>
                    {c > 0n ? "بدهکار" : c < 0n ? "بستانکار" : "تسویه"}
                  </td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
    </ReportFrame>
  );
}
