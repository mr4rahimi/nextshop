"use client";

/** چاپ سفارش خرید برای فرستادن به عرضه‌کننده — docs/plans/webhesab-parity.md بخش ۱۳ */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api } from "../ui";
import type { PoData } from "./PurchaseOrderDetail";

type PrintData = PoData & { print: { name: string | null; address: string | null; phone: string | null; logo: string | null } };

export default function PurchaseOrderPrint({ id }: { id: string }) {
  const [d, setD] = useState<PrintData | null>(null);
  const [prices, setPrices] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PrintData>(`/api/admin/accounting/purchase-orders/${id}?print=1`)
      .then((x) => {
        setD(x);
        document.title = `سفارش خرید ${x.order.number} — ${x.order.party.name}`;
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // چاپ همیشه روشن
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
  const o = d.order;
  const showPrice = prices && d.can.price;

  return (
    <div className="min-h-screen bg-gray-100 text-black [color-scheme:light] print:bg-white" dir="rtl">
      <style>{`@page { size: A4; margin: 10mm; } @media print { body { background: #fff !important; } .print-sheet { box-shadow: none !important; margin: 0 !important; } }`}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5 print:hidden">
        {d.can.price && (
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
            <input type="checkbox" checked={prices} onChange={(e) => setPrices(e.target.checked)} />
            با قیمت
          </label>
        )}
        <button onClick={() => window.print()} className="mr-auto rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white">
          🖨️ چاپ / PDF
        </button>
        <Link href={`/admin/accounting/purchases/orders/${id}`} className="text-xs font-bold text-blue-600">
          بازگشت به سفارش
        </Link>
      </div>
      <div className="print-sheet mx-auto my-6 max-w-[210mm] bg-white p-8 text-sm shadow">
        <div className="flex items-start justify-between gap-4 border-b border-gray-300 pb-4">
          <div>
            {d.print.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.print.logo} alt="" className="mb-2 h-12 object-contain" />
            )}
            <p className="font-black">{d.print.name}</p>
            {d.print.address && <p className="text-xs text-gray-600">{d.print.address}</p>}
            {d.print.phone && <p className="text-xs text-gray-600">تلفن {d.print.phone}</p>}
          </div>
          <div className="text-left">
            <p className="text-lg font-black">سفارش خرید</p>
            <p>شماره {faNum(o.number)}</p>
            <p>تاریخ {formatJalali(new Date(o.date))}</p>
            {o.dueDate && <p>موعد تحویل {formatJalali(new Date(o.dueDate))}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 py-3 text-xs">
          <p>
            عرضه‌کننده: <b>{o.party.name}</b>
          </p>
          <p>{[o.party.mobile ?? o.party.phone, [o.party.city, o.party.address].filter(Boolean).join("، ")].filter(Boolean).join(" — ")}</p>
          {d.warehouse && <p>تحویل به: {d.warehouse.name}</p>}
          {o.supplierRef && <p>کد پیگیری شما: {o.supplierRef}</p>}
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1.5">ردیف</th>
              <th className="border border-gray-300 px-2 py-1.5">کد</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">شرح کالا</th>
              <th className="border border-gray-300 px-2 py-1.5">تعداد</th>
              <th className="border border-gray-300 px-2 py-1.5">واحد</th>
              {showPrice && <th className="border border-gray-300 px-2 py-1.5">فی (تومان)</th>}
              {showPrice && <th className="border border-gray-300 px-2 py-1.5">جمع (تومان)</th>}
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="border border-gray-300 px-2 py-1 text-center">{faNum(i + 1)}</td>
                <td className="border border-gray-300 px-2 py-1 text-center" dir="ltr">
                  {l.code}
                </td>
                <td className="border border-gray-300 px-2 py-1">{l.title}</td>
                <td className="border border-gray-300 px-2 py-1 text-center font-bold">{faNum(l.qty)}</td>
                <td className="border border-gray-300 px-2 py-1 text-center">{l.unit ?? ""}</td>
                {showPrice && <td className="border border-gray-300 px-2 py-1 text-center">{l.unitPrice && l.unitPrice !== "0" ? formatAmount(l.unitPrice) : ""}</td>}
                {showPrice && (
                  <td className="border border-gray-300 px-2 py-1 text-center">{l.unitPrice && l.unitPrice !== "0" ? formatAmount(BigInt(l.unitPrice) * BigInt(l.qty)) : ""}</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-left">
                جمع
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">{faNum(o.lines.reduce((s, l) => s + l.qty, 0))}</td>
              <td className="border border-gray-300" />
              {showPrice && <td className="border border-gray-300" />}
              {showPrice && <td className="border border-gray-300 px-2 py-1.5 text-center">{d.total && d.total !== "0" ? formatAmount(d.total) : ""}</td>}
            </tr>
          </tfoot>
        </table>
        {o.note && <p className="mt-3 text-xs">یادداشت: {o.note}</p>}
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-gray-500">
          <p>امضای سفارش‌دهنده</p>
          <p>امضای عرضه‌کننده</p>
        </div>
      </div>
    </div>
  );
}
