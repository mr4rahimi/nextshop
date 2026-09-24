"use client";

/**
 * گردش با مانده‌ی جاری — صورت‌حساب شخص، گردش خزانه، دفتر حساب.
 * موبایل کارت، دسکتاپ جدول. هر ردیف به سندش لینک است.
 */

import Link from "next/link";
import { fromJalali, formatJalali, toJalali } from "@/lib/club/jalali";
import { dayValue } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { Card, Chips, Empty } from "./ui";

export interface StatementData {
  opening: string;
  closing: string;
  truncated: boolean;
  rows: {
    id: string;
    date: string;
    voucherId: string;
    voucherNumber: number;
    source: string;
    description: string;
    accountName: string;
    debit: string;
    credit: string;
    running: string;
  }[];
}

export interface Range {
  preset: "all" | "year" | "month" | "3m" | "custom";
  from: string;
  to: string;
}

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "سند دستی",
  SALES_INVOICE: "فاکتور فروش",
  PURCHASE_INVOICE: "فاکتور خرید",
  SALES_RETURN: "برگشت از فروش",
  PURCHASE_RETURN: "برگشت از خرید",
  RECEIPT: "دریافت",
  PAYMENT: "پرداخت",
  EXPENSE: "هزینه",
  TRANSFER: "انتقال وجه",
  CHEQUE: "چک",
  INVENTORY: "انبار",
  PAYOUT: "تسویه‌ی پورسانت",
  OPENING: "اول دوره",
  CLOSING: "اختتامیه",
  IMPORT: "انتقال از نرم‌افزار قبلی",
};

export function rangeFor(preset: Range["preset"]): Range {
  const today = new Date();
  const j = toJalali(today);
  const DAY = 86_400_000;
  const todayKey = new Date(Math.floor((today.getTime() + 3.5 * 3_600_000) / DAY) * DAY);
  if (preset === "year") return { preset, from: dayValue(fromJalali(j.year, 1, 1)!), to: "" };
  if (preset === "month") return { preset, from: dayValue(fromJalali(j.year, j.month, 1)!), to: "" };
  if (preset === "3m") return { preset, from: dayValue(new Date(todayKey.getTime() - 90 * DAY)), to: "" };
  return { preset, from: "", to: "" };
}

export function rangeQuery(r: Range): string {
  const p = new URLSearchParams();
  if (r.from) p.set("from", r.from);
  if (r.to) p.set("to", r.to);
  return p.toString();
}

export function RangeBar({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="space-y-2">
      <Chips
        value={value.preset}
        onChange={(p) => onChange(p === "custom" ? { ...value, preset: "custom" } : rangeFor(p))}
        options={[
          { value: "month", label: "این ماه" },
          { value: "3m", label: "سه ماه اخیر" },
          { value: "year", label: "امسال" },
          { value: "all", label: "همه" },
          { value: "custom", label: "بازه‌ی دلخواه" },
        ]}
      />
      {value.preset === "custom" && (
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <JalaliDatePicker value={value.from} onChange={(v: string) => onChange({ ...value, from: v })} placeholder="از تاریخ" />
          <JalaliDatePicker value={value.to} onChange={(v: string) => onChange({ ...value, to: v })} placeholder="تا تاریخ" />
        </div>
      )}
    </div>
  );
}

function signed(v: string, kind: "party" | "treasury" | "account") {
  const b = BigInt(v);
  if (b === 0n) return <span className="text-gray-400">۰</span>;
  const abs = formatAmount(b < 0n ? -b : b);
  if (kind === "treasury") return <span className={b < 0n ? "text-red-600" : ""}>{formatAmount(b)}</span>;
  const tag = kind === "party" ? (b > 0n ? "طلب" : "بدهی") : b > 0n ? "بد" : "بس";
  return (
    <span className={kind === "party" ? (b > 0n ? "text-emerald-600" : "text-red-600") : ""}>
      {abs} <span className="text-[10px] opacity-70">{tag}</span>
    </span>
  );
}

export default function StatementView({ data, kind }: { data: StatementData; kind: "party" | "treasury" | "account" }) {
  const debitLabel = kind === "treasury" ? "ورود" : "بدهکار";
  const creditLabel = kind === "treasury" ? "خروج" : "بستانکار";

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/5 rounded-t-2xl text-xs">
        <span className="text-gray-500">مانده از قبل</span>
        <span className="font-bold tabular-nums">{signed(data.opening, kind)}</span>
      </div>

      {!data.rows.length && <Empty title="در این بازه گردشی نیست" />}

      {/* موبایل */}
      <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
        {data.rows.map((r) => (
          <Link key={r.id} href={`/admin/accounting/vouchers/${r.voucherId}`} className="block px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.description}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {formatJalali(new Date(r.date))} · {SOURCE_LABELS[r.source] ?? r.source} · سند {faNum(r.voucherNumber)}
                </p>
              </div>
              <div className="text-left shrink-0">
                {BigInt(r.debit) > 0n ? (
                  <p className="text-sm font-black tabular-nums text-gray-900 dark:text-white">+{formatAmount(r.debit)}</p>
                ) : (
                  <p className="text-sm font-black tabular-nums text-gray-500">−{formatAmount(r.credit)}</p>
                )}
                <p className="text-[10px] text-gray-400 tabular-nums">مانده {signed(r.running, kind)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* دسکتاپ */}
      {data.rows.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 border-b border-gray-100 dark:border-white/5">
                <th className="text-right font-bold px-4 py-2">تاریخ</th>
                <th className="text-right font-bold px-2 py-2">سند</th>
                <th className="text-right font-bold px-2 py-2">شرح</th>
                {kind !== "account" && <th className="text-right font-bold px-2 py-2">حساب</th>}
                <th className="text-left font-bold px-2 py-2">{debitLabel}</th>
                <th className="text-left font-bold px-2 py-2">{creditLabel}</th>
                <th className="text-left font-bold px-4 py-2">مانده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-300">{formatJalali(new Date(r.date))}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/admin/accounting/vouchers/${r.voucherId}`} className="text-blue-600 font-bold tabular-nums">
                      {faNum(r.voucherNumber)}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-gray-900 dark:text-white">
                    {r.description}
                    <span className="block text-[10px] text-gray-400">{SOURCE_LABELS[r.source] ?? r.source}</span>
                  </td>
                  {kind !== "account" && <td className="px-2 py-2.5 text-xs text-gray-500">{r.accountName}</td>}
                  <td className="px-2 py-2.5 text-left tabular-nums font-bold">{BigInt(r.debit) > 0n ? formatAmount(r.debit) : ""}</td>
                  <td className="px-2 py-2.5 text-left tabular-nums font-bold">{BigInt(r.credit) > 0n ? formatAmount(r.credit) : ""}</td>
                  <td className="px-4 py-2.5 text-left tabular-nums font-bold whitespace-nowrap">{signed(r.running, kind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.truncated && (
        <p className="px-4 py-2 text-[11px] text-amber-600">فقط ۵۰۰ ردیف اول نشان داده شد؛ بازه را کوتاه‌تر کنید.</p>
      )}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/5 text-sm">
        <span className="font-bold text-gray-600 dark:text-gray-300">مانده‌ی پایان</span>
        <span className="font-black tabular-nums">{signed(data.closing, kind)}</span>
      </div>
    </Card>
  );
}
