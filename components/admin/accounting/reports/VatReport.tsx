"use client";

/** ارزش افزوده‌ی فصلی — مالیات فروش منهای مالیات خرید، با فاکتورهای مشمول (بخش ۱۱) */

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatJalali, fromJalali, toJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import { INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import { Card, Chips, SectionTitle } from "../ui";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport, type Cell } from "./kit";

interface Data {
  vatSales: string;
  vatPurchase: string;
  payable: string;
  invoices: { id: string; type: InvoiceTypeKey; number: number | null; date: string; partyName: string; partyNationalId: string | null; partyEconomicCode: string | null; total: string; vatTotal: string }[];
  expenses: { id: string; number: number; date: string; total: string; vatAmount: string; party: { name: string } | null }[];
}

const SEASONS = ["بهار", "تابستان", "پاییز", "زمستان"];

/** فصل‌های امسال و فصل آخر پارسال */
function seasonOptions() {
  const j = toJalali(todayKey());
  const cur = Math.floor((j.month - 1) / 3);
  const opts: { value: string; label: string; from: string; to: string }[] = [];
  const add = (y: number, s: number) => {
    const from = fromJalali(y, s * 3 + 1, 1)!;
    const next = s === 3 ? fromJalali(y + 1, 1, 1)! : fromJalali(y, s * 3 + 4, 1)!;
    opts.push({ value: `${y}-${s}`, label: `${SEASONS[s]} ${faNum(y)}`, from: dayValue(from), to: dayValue(new Date(next.getTime() - 86_400_000)) });
  };
  if (cur < 3) add(j.year - 1, 3);
  for (let s = 0; s <= cur; s++) add(j.year, s);
  return opts.reverse();
}

export default function VatReport() {
  const options = useMemo(seasonOptions, []);
  const [season, setSeason] = useState(options[0].value);
  const sel = options.find((o) => o.value === season)!;
  const { data, error, loading } = useReport<Data>("vat", { from: sel.from, to: sel.to });

  function exportCsv() {
    if (!data) return;
    const rows: Cell[][] = data.invoices.map((i) => [INVOICE_TYPE_LABELS[i.type], i.number, formatJalali(new Date(i.date)), i.partyName, i.partyNationalId, i.partyEconomicCode, i.total, i.vatTotal]);
    for (const e of data.expenses) rows.push(["هزینه", e.number, formatJalali(new Date(e.date)), e.party?.name ?? "", "", "", e.total, e.vatAmount]);
    rows.push(["", "", "", "", "", "", "مالیات فروش", data.vatSales], ["", "", "", "", "", "", "مالیات خرید", data.vatPurchase], ["", "", "", "", "", "", "قابل پرداخت", data.payable]);
    downloadCsv(`vat-${season}`, ["نوع", "شماره", "تاریخ", "طرف حساب", "شناسه/کد ملی", "کد اقتصادی", "مبلغ کل", "مالیات"], rows);
  }

  return (
    <ReportFrame
      title="ارزش افزوده"
      help="accountingVatReport"
      desc="مالیاتی که از مشتریان گرفتید منهای مالیاتی که به فروشندگان دادید — مبنای اظهارنامه‌ی فصلی."
      printSub={`${sel.label} — از ${formatJalali(new Date(sel.from))} تا ${formatJalali(new Date(sel.to))}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={<Chips value={season} onChange={setSeason} options={options.map((o) => ({ value: o.value, label: o.label }))} />}
    >
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">مالیات فروش</p>
              <p className="text-lg mt-1"><Amt v={data.vatSales} strong /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">مالیات خرید (قابل کسر)</p>
              <p className="text-lg mt-1"><Amt v={data.vatPurchase} strong /></p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500">{BigInt(data.payable) < 0n ? "بستانکار از سازمان" : "قابل پرداخت"}</p>
              <p className="text-lg mt-1"><Amt v={data.payable} strong /></p>
            </Card>
          </div>
          <SectionTitle title={`فاکتورهای مشمول (${faNum(data.invoices.length)})`} />
          <Table
            head={
              <tr>
                <th className={th}>فاکتور</th>
                <th className={th}>تاریخ</th>
                <th className={th}>طرف حساب</th>
                <th className={thNum}>مبلغ کل</th>
                <th className={thNum}>مالیات</th>
              </tr>
            }
          >
            {data.invoices.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/admin/accounting/invoices/${i.id}`} className="hover:text-blue-600">
                    {INVOICE_TYPE_LABELS[i.type]} {faNum(i.number ?? 0)}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-gray-500`}>{formatJalali(new Date(i.date))}</td>
                <td className={td}>
                  {i.partyName}
                  {i.partyEconomicCode && <span className="block text-[11px] text-gray-400">کد اقتصادی {i.partyEconomicCode}</span>}
                </td>
                <td className={tdNum}><Amt v={i.total} muted /></td>
                <td className={tdNum}><Amt v={i.type.endsWith("RETURN") ? String(-BigInt(i.vatTotal)) : i.vatTotal} /></td>
              </tr>
            ))}
            {data.expenses.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/admin/accounting/money/${e.id}`} className="hover:text-blue-600">
                    هزینه {faNum(e.number)}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-gray-500`}>{formatJalali(new Date(e.date))}</td>
                <td className={td}>{e.party?.name ?? "—"}</td>
                <td className={tdNum}><Amt v={e.total} muted /></td>
                <td className={tdNum}><Amt v={e.vatAmount} /></td>
              </tr>
            ))}
            {!data.invoices.length && !data.expenses.length && (
              <tr>
                <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={5}>
                  در این فصل فاکتور مالیات‌دار نیست. اگر مشمول ارزش افزوده هستید، در تنظیمات حسابداری روشنش کنید.
                </td>
              </tr>
            )}
          </Table>
        </>
      )}
    </ReportFrame>
  );
}
