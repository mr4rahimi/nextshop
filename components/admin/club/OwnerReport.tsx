"use client";

/**
 * گزارش پخش مشتری بین کارکنان — تب «گزارش کارکنان» در اعضای باشگاه.
 *
 * دو ستون زمانی عمداً کنار هم‌اند: «کل عمر» ارزش انباشته‌ی سبد، «بازه» اینکه
 * این دوره چه خبر بوده. با یکی‌شان کارمند قدیمی همیشه جلو می‌افتد یا کارمندِ
 * پُرسابقه یک ماه ساکت به نظر می‌رسد (بخش ۲۱.۶).
 */

import { useEffect, useState } from "react";
import { JALALI_MONTH_OPTIONS, jalaliMonthLength, formatJalaliShort } from "@/lib/club/jalali";

interface Row {
  ownerId: string | null;
  ownerName: string;
  customers: number;
  byCategory: Record<string, number>;
  lifetimeSpent: string;
  lifetimeOrders: number;
  rangeSpent: string;
  rangeOrders: number;
  lastPurchaseAt: string | null;
}

function fa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

function currentJalali(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" })
    .formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

export default function OwnerReport({ onPickOwner }: { onPickOwner: (owner: string) => void }) {
  const [{ year, month }, setYm] = useState(currentJalali);
  const [data, setData] = useState<{ key: string; rows: Row[] } | null>(null);
  const key = `${year}-${month}`;
  // ردیف‌های ماه قبلی تا رسیدن پاسخ تازه نشان داده نمی‌شوند
  const rows = data?.key === key ? data.rows : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mm = String(month).padStart(2, "0");
    const last = jalaliMonthLength(year, month);
    fetch(`/api/admin/club/members/report?from=${year}-${mm}-01&to=${year}-${mm}-${last}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setData({ key: `${year}-${month}`, rows: d.rows });
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"));
  }, [year, month]);

  const categories = Array.from(new Set((rows ?? []).flatMap((r) => Object.keys(r.byCategory))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500">بازه‌ی خرید:</span>
        <select
          value={month}
          onChange={(e) => setYm({ year, month: Number(e.target.value) })}
          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[11px] font-black text-gray-600 dark:text-gray-300"
        >
          {JALALI_MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.title}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYm({ year: Number(e.target.value) || year, month })}
          className="w-24 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[11px] font-black text-gray-600 dark:text-gray-300"
        />
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        {!rows ? (
          <p className="p-10 text-center text-sm font-bold text-gray-400">در حال بارگذاری...</p>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-[11px] font-black text-gray-400">
              <tr>
                <th className="px-4 py-3">کارمند</th>
                <th className="px-3 py-3 text-center">مشتری</th>
                {categories.map((c) => (
                  <th key={c} className="px-3 py-3 text-center">{c}</th>
                ))}
                <th className="px-3 py-3 text-center">خرید کل عمر</th>
                <th className="px-3 py-3 text-center">خرید در بازه</th>
                <th className="px-3 py-3">آخرین خرید</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.ownerId ?? "none"} className={r.ownerId ? "" : "bg-amber-50/50 dark:bg-amber-500/5"}>
                  <td className="px-4 py-3 font-black text-gray-900 dark:text-white">
                    <button
                      onClick={() => onPickOwner(r.ownerId ?? "none")}
                      className={r.ownerId ? "hover:text-primary-600" : "text-amber-600 hover:underline"}
                    >
                      {r.ownerName}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center font-black tabular-nums">{fa(r.customers)}</td>
                  {categories.map((c) => (
                    <td key={c} className="px-3 py-3 text-center tabular-nums text-gray-600 dark:text-gray-300">
                      {r.byCategory[c] ? fa(r.byCategory[c]) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center tabular-nums">
                    <p className="font-black">{fa(r.lifetimeSpent)}</p>
                    <p className="text-[10px] text-gray-400">{fa(r.lifetimeOrders)} سفارش</p>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">
                    <p className="font-black">{fa(r.rangeSpent)}</p>
                    <p className="text-[10px] text-gray-400">{fa(r.rangeOrders)} سفارش</p>
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {r.lastPurchaseAt ? formatJalaliShort(new Date(r.lastPurchaseAt)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        ردیف «بی‌صاحب» مشتریانی است که هنوز به کسی سپرده نشده‌اند. از فهرست، آن‌ها را انتخاب و «تعیین صاحب» بزنید.
      </p>
    </div>
  );
}
