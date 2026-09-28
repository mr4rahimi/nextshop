"use client";

/**
 * چاپ صورت‌حساب شخص — ریز حساب یا کل حساب (فاز ۱۰). بیرون از قاب پنل (مسیر
 * `/print`)، A4 و همیشه روشن؛ برای تحویل به مشتری یا تأمین‌کننده و بایگانی.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { todayKey } from "@/lib/accounting/dates";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { SOURCE_LABELS, type StatementData } from "./Statement";
import type { PartySummary } from "./PartyDetailClient";
import { api } from "./ui";

interface Data {
  party: { name: string; code: number; mobile: string | null; nationalId: string | null; address: string | null };
  statement: StatementData;
  summary: PartySummary;
}

const side = (v: string) => {
  const b = BigInt(v);
  return b === 0n ? "تسویه" : b > 0n ? "بدهکار" : "بستانکار";
};
const abs = (v: string) => formatAmount(BigInt(v) < 0n ? -BigInt(v) : BigInt(v));

export default function PartyStatementPrint({ id }: { id: string }) {
  const sp = useSearchParams();
  const [mode, setMode] = useState<"detail" | "summary">(sp.get("mode") === "summary" ? "summary" : "detail");
  const from = sp.get("from");
  const to = sp.get("to");
  const [d, setD] = useState<Data | null>(null);
  const [seller, setSeller] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    api<Data>(`/api/admin/accounting/parties/${id}?${q}`).then(setD).catch((e) => setError(e.message));
    api<{ settings: { sellerName: string | null } }>("/api/admin/accounting/settings/general")
      .then((x) => setSeller(x.settings.sellerName))
      .catch(() => {});
  }, [id, from, to]);
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);
  useEffect(() => {
    if (d) document.title = `صورت‌حساب ${d.party.name}`;
  }, [d]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!d) return <p className="p-6 text-sm text-gray-500">در حال آماده‌سازی…</p>;
  const range = `${from ? `از ${formatJalali(new Date(from))}` : "از ابتدا"} ${to ? `تا ${formatJalali(new Date(to))}` : `تا ${formatJalali(todayKey())}`}`;
  const s = d.summary;
  const open = BigInt(s.opening);
  const cell = "border border-black px-2 py-1";

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-black [color-scheme:light]" dir="rtl">
      <style>{`@page { size: A4; margin: 10mm; } @media print { .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; } }`}</style>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
        {(
          [
            ["detail", "ریز حساب"],
            ["summary", "کل حساب"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${mode === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            {l}
          </button>
        ))}
        <button onClick={() => window.print()} className="mr-auto px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold">
          🖨️ چاپ / PDF
        </button>
        <Link href={`/admin/accounting/parties/${id}`} className="text-xs font-bold text-blue-600">
          بازگشت
        </Link>
      </div>

      <div className="sheet bg-white mx-auto my-6 shadow-lg w-[210mm] min-h-[297mm] p-[10mm] text-[11px] leading-5">
        <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3">
          <div>
            <p className="text-base font-black">{mode === "detail" ? "صورت‌حساب ریز" : "صورت‌حساب کل"} — {d.party.name}</p>
            <p>
              کد {faNum(d.party.code)}
              {d.party.mobile && ` · ${faNum(d.party.mobile)}`}
              {d.party.nationalId && ` · کد ملی ${faNum(d.party.nationalId)}`}
            </p>
            {d.party.address && <p>{d.party.address}</p>}
          </div>
          <div className="text-left">
            {seller && <p className="font-black">{seller}</p>}
            <p>{range}</p>
            <p>تاریخ چاپ: {formatJalali(todayKey())}</p>
          </div>
        </div>

        {mode === "detail" ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className={cell}>تاریخ</th>
                <th className={cell}>سند</th>
                <th className={cell}>شرح</th>
                <th className={cell}>بدهکار</th>
                <th className={cell}>بستانکار</th>
                <th className={cell}>مانده</th>
                <th className={cell}>تشخیص</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={cell} colSpan={5}>
                  مانده از قبل
                </td>
                <td className={`${cell} text-left tabular-nums`}>{abs(d.statement.opening)}</td>
                <td className={cell}>{side(d.statement.opening)}</td>
              </tr>
              {d.statement.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${cell} whitespace-nowrap`}>{formatJalali(new Date(r.date))}</td>
                  <td className={`${cell} text-center`}>{faNum(r.voucherNumber)}</td>
                  <td className={cell}>{r.description}</td>
                  <td className={`${cell} text-left tabular-nums`}>{BigInt(r.debit) ? formatAmount(r.debit) : ""}</td>
                  <td className={`${cell} text-left tabular-nums`}>{BigInt(r.credit) ? formatAmount(r.credit) : ""}</td>
                  <td className={`${cell} text-left tabular-nums`}>{abs(r.running)}</td>
                  <td className={cell}>{side(r.running)}</td>
                </tr>
              ))}
              <tr className="font-black bg-gray-50">
                <td className={cell} colSpan={3}>
                  جمع گردش
                </td>
                <td className={`${cell} text-left tabular-nums`}>{formatAmount(s.debit)}</td>
                <td className={`${cell} text-left tabular-nums`}>{formatAmount(s.credit)}</td>
                <td className={`${cell} text-left tabular-nums`}>{abs(d.statement.closing)}</td>
                <td className={cell}>{side(d.statement.closing)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className={cell}>شرح</th>
                <th className={cell}>تعداد</th>
                <th className={cell}>بدهکار</th>
                <th className={cell}>بستانکار</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={cell}>مانده‌ی ابتدای بازه ({side(s.opening)})</td>
                <td className={cell} />
                <td className={`${cell} text-left tabular-nums`}>{BigInt(s.opening) > 0n ? abs(s.opening) : ""}</td>
                <td className={`${cell} text-left tabular-nums`}>{BigInt(s.opening) < 0n ? abs(s.opening) : ""}</td>
              </tr>
              {s.bySource.map((r) => (
                <tr key={r.source}>
                  <td className={cell}>{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className={`${cell} text-center`}>{faNum(r.count)}</td>
                  <td className={`${cell} text-left tabular-nums`}>{BigInt(r.debit) ? formatAmount(r.debit) : ""}</td>
                  <td className={`${cell} text-left tabular-nums`}>{BigInt(r.credit) ? formatAmount(r.credit) : ""}</td>
                </tr>
              ))}
              <tr className="font-black bg-gray-50">
                <td className={cell} colSpan={2}>
                  جمع
                </td>
                <td className={`${cell} text-left tabular-nums`}>{formatAmount(BigInt(s.debit) + (open > 0n ? open : 0n))}</td>
                <td className={`${cell} text-left tabular-nums`}>{formatAmount(BigInt(s.credit) + (open < 0n ? -open : 0n))}</td>
              </tr>
            </tbody>
          </table>
        )}

        <p className="mt-4 font-black text-[12px]">
          مانده‌ی پایان: {abs(s.closing)} تومان {side(s.closing)}
          {BigInt(s.closing) !== 0n && <span className="font-normal"> ({amountToWords(BigInt(s.closing) < 0n ? -BigInt(s.closing) : BigInt(s.closing))} تومان)</span>}
        </p>
        <p className="mt-1 text-[10px]">
          «بدهکار» یعنی {d.party.name} به {seller ?? "ما"} بدهکار است؛ «بستانکار» یعنی {seller ?? "ما"} به ایشان بدهکاریم.
        </p>
        <div className="grid grid-cols-2 gap-8 mt-10 text-center">
          <p className="font-black">مهر و امضای {seller ?? "فروشگاه"}</p>
          <p className="font-black">امضای {d.party.name}</p>
        </div>
      </div>
    </div>
  );
}
