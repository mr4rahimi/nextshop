"use client";

/**
 * چاپ قرارداد اقساط سازمانی برای امضای کارمند — A5، با جدول کسر ماهانه از حقوق.
 * کسر ماهانه = قسط × (مبلغ خرید ÷ مبلغ قسطی)؛ پورسانت سازمان روی برگه‌ی مشتری نمی‌آید.
 * `?auto=1` ← پنجره‌ی چاپ و بستن زبانه. docs/plans/org-installments.md
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { api } from "../ui";
import { B } from "./shared";

interface C {
  number: number;
  customerName: string;
  mobile: string | null;
  nationalId: string | null;
  employeeCode: string | null;
  letterNo: string | null;
  total: string;
  net: string;
  months: number;
  status: string;
  createdAt: string;
  org: { name: string; contractNo: string | null };
  invoice: { number: number | null } | null;
  ticket: { number: number } | null;
  items: { seq: number; dueDate: string; amount: string }[];
}

export default function ContractPrint({ id }: { id: string }) {
  const sp = useSearchParams();
  const [c, setC] = useState<C | null>(null);
  const [store, setStore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ contract: C }>(`/api/admin/accounting/installment-orgs/contracts/${id}`)
      .then((r) => setC(r.contract))
      .catch((e) => setError(e.message));
    api<{ storeName?: string | null }>("/api/store/site-settings")
      .then((r) => setStore(r.storeName ?? null))
      .catch(() => {});
  }, [id]);
  useEffect(() => {
    const html = document.documentElement;
    const dark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (dark) html.classList.add("dark");
    };
  }, []);
  useEffect(() => {
    if (!c || sp.get("auto") !== "1") return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [c, sp]);
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!c) return <p className="p-6 text-sm text-gray-500">…</p>;
  const total = B(c.total);
  const net = B(c.net);
  const gross = (a: string) => (net > 0n ? (B(a) * total + net / 2n) / net : B(a));
  return (
    <div className="min-h-screen bg-gray-100 text-black [color-scheme:light] print:bg-white" dir="rtl">
      <style>{`@page { size: A5; margin: 10mm; } @media print { body { background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; } }`}</style>
      <div className="flex gap-2 border-b border-gray-200 bg-white px-4 py-2.5 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white">
          🖨️ چاپ
        </button>
      </div>
      <div className="sheet mx-auto my-4 max-w-[148mm] bg-white p-6 text-[12px] leading-6 shadow">
        <div className="text-center">
          {store && <p className="text-base font-black">{store}</p>}
          <p className="text-sm font-black">فرم خرید اقساطی — {c.org.name}</p>
          <p className="text-[11px]">
            شماره {faNum(c.number)} · {formatJalali(new Date(c.createdAt))}
            {c.ticket && ` · رسید صندوق ${faNum(c.ticket.number)}`}
            {c.invoice && ` · فاکتور ${faNum(c.invoice.number ?? 0)}`}
            {c.org.contractNo && ` · قرارداد ${c.org.contractNo}`}
          </p>
          {c.status === "VOID" && <p className="mt-1 border-2 border-black font-black">باطل شده</p>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 border-y border-black py-2">
          <p>نام: <b>{c.customerName}</b></p>
          <p>کد ملی: <b>{c.nationalId ? faNum(c.nationalId) : "................"}</b></p>
          <p>کد پرسنلی: <b>{c.employeeCode ? faNum(c.employeeCode) : "................"}</b></p>
          <p>موبایل: <b dir="ltr">{c.mobile ? faNum(c.mobile) : "................"}</b></p>
          {c.letterNo && <p>معرفی‌نامه: <b>{c.letterNo}</b></p>}
        </div>
        <p className="mt-2">
          مبلغ خرید: <b>{formatAmount(total)} تومان</b> ({amountToWords(total)} تومان) در <b>{faNum(c.months)} قسط</b> ماهانه از حقوق کسر و توسط {c.org.name} پرداخت می‌شود.
        </p>
        <table className="mt-2 w-full border-collapse text-center">
          <thead>
            <tr className="border-y border-black">
              <th className="py-1">قسط</th>
              <th className="py-1">ماه کسر</th>
              <th className="py-1">مبلغ کسر از حقوق (تومان)</th>
            </tr>
          </thead>
          <tbody>
            {c.items.map((i) => (
              <tr key={i.seq} className="border-b border-gray-300">
                <td className="py-0.5">{faNum(i.seq)}</td>
                <td className="py-0.5">{formatJalali(new Date(i.dueDate))}</td>
                <td className="py-0.5 tabular-nums">{formatAmount(gross(i.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-5">
          اینجانب با امضای این برگه، خرید فوق و کسر اقساط از حقوقم را تأیید می‌کنم. در صورت قطع همکاری یا عدم کسر، مانده‌ی اقساط را مستقیم به فروشگاه می‌پردازم.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[11px]">
          <p className="border-t border-black pt-1">امضا و اثر انگشت خریدار</p>
          <p className="border-t border-black pt-1">مهر و امضای فروشگاه</p>
        </div>
      </div>
    </div>
  );
}
