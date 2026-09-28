"use client";

/**
 * چاپ جدول اقساط — برای تحویل به مشتری/تأمین‌کننده و امضا. docs/plans/accounting.md بخش ۹.۳.
 * بیرون از قاب پنل (مسیر `/print`) و همیشه روشن، مثل چاپ فاکتور.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { FEE_MODE_LABELS, INSTALLMENT_STATE_LABELS, type FeeMode } from "@/lib/accounting/installments-calc";
import { api } from "../ui";
import type { InstRow } from "./shared";

interface Data {
  invoice: { id: string; type: "SALES" | "PURCHASE"; number: number | null; date: string; total: string; partyName: string };
  party: { name: string; mobile: string | null; nationalId: string | null; address: string | null } | null;
  seller: { sellerName: string | null; sellerPhone: string | null; sellerAddress: string | null } | null;
  plan: {
    plan: { principal: string; feeAmount: string; feeMode: FeeMode; feeRateBp: number; downPayment: string; count: number; note: string | null };
    rows: InstRow[];
  } | null;
}

export default function PlanPrint({ invoiceId }: { invoiceId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Data>(`/api/admin/accounting/invoices/${invoiceId}/installments`).then(setD).catch((e) => setError(e.message));
  }, [invoiceId]);
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!d) return <p className="p-6 text-sm text-gray-500">در حال آماده‌سازی…</p>;
  if (!d.plan) return <p className="p-6 text-sm">این فاکتور برنامه‌ی اقساط ندارد.</p>;
  const { plan, rows } = d.plan;
  const sales = d.invoice.type === "SALES";
  const total = BigInt(plan.principal) + BigInt(plan.feeAmount);
  const us = d.seller?.sellerName ?? "فروشگاه";
  const them = d.party?.name ?? d.invoice.partyName;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-black [color-scheme:light]" dir="rtl">
      <style>{`@page { size: A4; margin: 12mm; } @media print { .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; } }`}</style>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <button onClick={() => window.print()} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold">
          🖨️ چاپ / PDF
        </button>
        <Link href={`/admin/accounting/invoices/${invoiceId}#installments`} className="mr-auto text-xs font-bold text-blue-600">
          بازگشت به فاکتور
        </Link>
      </div>
      <div className="sheet bg-white mx-auto my-6 shadow-lg w-[210mm] min-h-[297mm] p-[12mm] text-[12px] leading-6">
        <div className="text-center border-b-2 border-black pb-3">
          <p className="text-lg font-black">جدول اقساط {sales ? "فروش" : "خرید"}</p>
          <p className="text-[11px]">
            فاکتور شماره‌ی {faNum(d.invoice.number ?? 0)} — {formatJalali(new Date(d.invoice.date))}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="border border-black rounded p-2">
            <p className="font-black mb-1">{sales ? "فروشنده" : "خریدار"}</p>
            <p>{us}</p>
            {d.seller?.sellerPhone && <p>تلفن: {faNum(d.seller.sellerPhone)}</p>}
            {d.seller?.sellerAddress && <p>{d.seller.sellerAddress}</p>}
          </div>
          <div className="border border-black rounded p-2">
            <p className="font-black mb-1">{sales ? "خریدار" : "فروشنده"}</p>
            <p>{them}</p>
            {d.party?.nationalId && <p>کد/شناسه‌ی ملی: {faNum(d.party.nationalId)}</p>}
            {d.party?.mobile && <p>موبایل: {faNum(d.party.mobile)}</p>}
            {d.party?.address && <p>{d.party.address}</p>}
          </div>
        </div>

        <table className="w-full border-collapse mb-4">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 w-1/2">مبلغ فاکتور</td>
              <td className="border border-black px-2 py-1 tabular-nums">{formatAmount(d.invoice.total)} تومان</td>
            </tr>
            {BigInt(plan.downPayment) > 0n && (
              <tr>
                <td className="border border-black px-2 py-1">پیش‌پرداخت</td>
                <td className="border border-black px-2 py-1 tabular-nums">{formatAmount(plan.downPayment)} تومان</td>
              </tr>
            )}
            <tr>
              <td className="border border-black px-2 py-1">مبلغ قسطی</td>
              <td className="border border-black px-2 py-1 tabular-nums">{formatAmount(plan.principal)} تومان</td>
            </tr>
            {BigInt(plan.feeAmount) > 0n && (
              <tr>
                <td className="border border-black px-2 py-1">
                  کارمزد ({FEE_MODE_LABELS[plan.feeMode]}
                  {plan.feeRateBp ? ` ${faNum(plan.feeRateBp / 100)}٪` : ""})
                </td>
                <td className="border border-black px-2 py-1 tabular-nums">{formatAmount(plan.feeAmount)} تومان</td>
              </tr>
            )}
            <tr className="font-black">
              <td className="border border-black px-2 py-1">جمع اقساط ({faNum(rows.length)} قسط)</td>
              <td className="border border-black px-2 py-1 tabular-nums">
                {formatAmount(total)} تومان <span className="font-normal text-[10px]">({amountToWords(total)} تومان)</span>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1 w-10">ردیف</th>
              <th className="border border-black px-2 py-1">سررسید</th>
              <th className="border border-black px-2 py-1">مبلغ (تومان)</th>
              <th className="border border-black px-2 py-1">چک</th>
              <th className="border border-black px-2 py-1">وضعیت</th>
              <th className="border border-black px-2 py-1 w-28">امضای دریافت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border border-black px-2 py-1 text-center">{faNum(r.seq)}</td>
                <td className="border border-black px-2 py-1 text-center">{formatJalali(new Date(r.dueDate))}</td>
                <td className="border border-black px-2 py-1 text-center tabular-nums">{formatAmount(r.amount)}</td>
                <td className="border border-black px-2 py-1 text-center">{r.cheque ? faNum(r.cheque.serialNo) : "—"}</td>
                <td className="border border-black px-2 py-1 text-center">{INSTALLMENT_STATE_LABELS[r.state]}</td>
                <td className="border border-black px-2 py-1" />
              </tr>
            ))}
          </tbody>
        </table>

        {plan.note && <p className="mt-3">توضیح: {plan.note}</p>}
        <p className="mt-3 text-[11px]">
          {sales
            ? `خریدار متعهد است هر قسط را در سررسید آن به ${us} بپردازد.`
            : `${us} متعهد است هر قسط را در سررسید آن به فروشنده بپردازد.`}
        </p>

        <div className="grid grid-cols-2 gap-8 mt-12 text-center">
          <div>
            <p className="font-black">مهر و امضای {sales ? "فروشنده" : "خریدار"}</p>
            <div className="h-20" />
          </div>
          <div>
            <p className="font-black">امضای {sales ? "خریدار" : "فروشنده"}</p>
            <div className="h-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
