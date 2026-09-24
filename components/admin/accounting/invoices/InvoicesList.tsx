"use client";

/**
 * فهرست فاکتورها — فروش (فاکتور، پیش‌فاکتور، برگشتی) یا خرید (فاکتور، برگشتی).
 * docs/plans/accounting.md بخش ۱۳.۱. موبایل کارت، دسکتاپ جدول با جمع پایین.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import { CHANNEL_LABELS, INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import { RangeBar, rangeFor, rangeQuery, type Range } from "../Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader } from "../ui";

export interface InvoiceRow {
  id: string;
  type: InvoiceTypeKey;
  number: number | null;
  date: string;
  status: "DRAFT" | "ISSUED" | "VOID";
  proformaState: "OPEN" | "CONVERTED" | "CANCELED" | null;
  validUntil: string | null;
  partyId: string;
  partyName: string;
  channel: keyof typeof CHANNEL_LABELS;
  platformCode: string | null;
  total: string;
  refInvoiceId: string | null;
  _count: { lines: number };
}

type Side = "sales" | "purchases";

const TABS: Record<Side, { value: InvoiceTypeKey; label: string }[]> = {
  sales: [
    { value: "SALES", label: "فاکتور فروش" },
    { value: "PROFORMA", label: "پیش‌فاکتور" },
    { value: "SALES_RETURN", label: "برگشت از فروش" },
  ],
  purchases: [
    { value: "PURCHASE", label: "فاکتور خرید" },
    { value: "PURCHASE_RETURN", label: "برگشت از خرید" },
  ],
};

export function StatusBadge({ inv }: { inv: Pick<InvoiceRow, "status" | "type" | "proformaState" | "validUntil"> }) {
  if (inv.status === "VOID") return <Badge tone="red">باطل</Badge>;
  if (inv.status === "DRAFT") return <Badge tone="amber">پیش‌نویس</Badge>;
  if (inv.type === "PROFORMA") {
    if (inv.proformaState === "CONVERTED") return <Badge tone="green">تبدیل شد</Badge>;
    if (isExpired(inv.validUntil)) return <Badge>منقضی</Badge>;
    return <Badge tone="blue">باز</Badge>;
  }
  return null;
}

/** اعتبار پیش‌فاکتور گذشته؟ مقایسه‌ی روز تهران، نه ساعت */
export function isExpired(validUntil: string | null): boolean {
  return !!validUntil && validUntil.slice(0, 10) < dayValue(todayKey());
}

export function invoiceTitle(inv: Pick<InvoiceRow, "type" | "number" | "status">) {
  return `${INVOICE_TYPE_LABELS[inv.type]} ${inv.number ? faNum(inv.number) : inv.status === "DRAFT" ? "(پیش‌نویس)" : ""}`.trim();
}

export default function InvoicesList({ side }: { side: Side }) {
  const router = useRouter();
  const sp = useSearchParams();
  const tabs = TABS[side];
  const initial = (sp.get("type") as InvoiceTypeKey | null) ?? tabs[0].value;
  const [type, setType] = useState<InvoiceTypeKey>(tabs.some((t) => t.value === initial) ? initial : tabs[0].value);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [data, setData] = useState<{ items: InvoiceRow[]; summary: { count: number; total: string }; can: { sales: boolean; purchase: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(rangeQuery(range));
    p.set("side", side);
    p.set("type", type);
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    api<typeof data & object>(`/api/admin/accounting/invoices?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [side, type, status, q, range]);

  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  // میانبر «N» — فاکتور تازه (بخش ۱۳.۴)
  const canWrite = data ? (side === "sales" ? data.can.sales : data.can.purchase) : false;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.key === "n" || e.key === "د") && canWrite) router.push(`/admin/accounting/invoices/new?type=${type}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canWrite, router, type]);

  const statusOptions = [
    { value: "", label: "همه" },
    ...(type === "PROFORMA" ? [{ value: "OPEN_PROFORMA", label: "باز" }] : [{ value: "ISSUED", label: "صادرشده" }]),
    { value: "DRAFT", label: "پیش‌نویس" },
    { value: "VOID", label: "باطل" },
  ];
  const isReturn = type === "SALES_RETURN" || type === "PURCHASE_RETURN";

  return (
    <div className="space-y-4">
      <PageHeader
        title={side === "sales" ? "فروش" : "خرید"}
        help={side === "sales" ? "accountingSales" : "accountingPurchases"}
        desc={
          side === "sales"
            ? "فاکتور سفارش‌های سایت، تلفنی و بازارگاه خودکار اینجا می‌آید؛ فروش حضوری و عمده را دستی ثبت کنید."
            : "خریدهای «خرید شد» کارتابل خودکار اینجا می‌آید؛ خرید برای انبار را دستی ثبت کنید."
        }
        actions={
          canWrite &&
          !isReturn && (
            <Link href={`/admin/accounting/invoices/new?type=${type}`} className={btn.primary}>
              ➕ {INVOICE_TYPE_LABELS[type]} تازه
            </Link>
          )
        }
      />

      <Chips
        value={type}
        onChange={(t) => {
          setType(t);
          setStatus("");
          router.replace(`?type=${t}`, { scroll: false });
        }}
        options={tabs}
      />

      <div className="grid gap-2 md:grid-cols-[1fr_auto] items-start">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: نام طرف حساب، شماره یا توضیح" className={inputCls} />
        <Chips value={status} onChange={setStatus} options={statusOptions} />
      </div>
      <RangeBar value={range} onChange={setRange} />
      <ErrorText>{error}</ErrorText>

      {isReturn && (
        <p className="text-[11px] text-gray-500 leading-5">
          برگشتی از صفحه‌ی همان فاکتور ثبت می‌شود: فاکتور را باز کنید و «برگشت» را بزنید تا اقلام و مبالغ از خودش بیاید.
        </p>
      )}

      {data && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
          <span>
            {faNum(data.summary.count)} فاکتور معتبر در این بازه
          </span>
          <span>
            جمع: <Money value={data.summary.total} />
          </span>
        </div>
      )}

      <Card className="overflow-hidden">
        {/* موبایل */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
          {data?.items.map((inv) => (
            <Link key={inv.id} href={`/admin/accounting/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${inv.status === "VOID" ? "line-through text-gray-400" : ""}`}>{inv.partyName}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {inv.number ? `شماره‌ی ${faNum(inv.number)}` : "پیش‌نویس"} · {formatJalali(new Date(inv.date))} · {CHANNEL_LABELS[inv.channel]}
                </p>
              </div>
              <div className="text-left shrink-0 space-y-1">
                <Money value={inv.total} className="text-sm" />
                <div>
                  <StatusBadge inv={inv} />
                </div>
              </div>
            </Link>
          ))}
        </div>
        {/* دسکتاپ */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">
            <tr>
              <th className="text-right font-bold px-4 py-2.5 w-20">شماره</th>
              <th className="text-right font-bold px-3 py-2.5 w-28">تاریخ</th>
              <th className="text-right font-bold px-3 py-2.5">{side === "sales" ? "خریدار" : "فروشنده"}</th>
              <th className="text-right font-bold px-3 py-2.5 w-24">منبع</th>
              <th className="text-right font-bold px-3 py-2.5 w-16">اقلام</th>
              <th className="text-left font-bold px-3 py-2.5 w-40">مبلغ</th>
              <th className="px-4 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {data?.items.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => router.push(`/admin/accounting/invoices/${inv.id}`)}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${inv.status === "VOID" ? "text-gray-400" : ""}`}
              >
                <td className="px-4 py-2.5 font-bold tabular-nums">{inv.number ? faNum(inv.number) : "—"}</td>
                <td className="px-3 py-2.5 text-xs">{formatJalali(new Date(inv.date))}</td>
                <td className={`px-3 py-2.5 font-bold ${inv.status === "VOID" ? "line-through" : ""}`}>
                  <Link href={`/admin/accounting/invoices/${inv.id}`} onClick={(e) => e.stopPropagation()}>
                    {inv.partyName}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-xs">{CHANNEL_LABELS[inv.channel]}</td>
                <td className="px-3 py-2.5 text-xs tabular-nums">{faNum(inv._count.lines)}</td>
                <td className="px-3 py-2.5 text-left">
                  <Money value={inv.total} />
                </td>
                <td className="px-4 py-2.5 text-left">
                  <StatusBadge inv={inv} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.items.length && (
          <Empty
            title={`${INVOICE_TYPE_LABELS[type]}ی پیدا نشد`}
            desc={
              isReturn
                ? "برگشتی از صفحه‌ی فاکتور اصلی ثبت می‌شود."
                : side === "sales"
                  ? "فاکتور فروش سفارش‌های سایت خودکار می‌آید. فروش حضوری یا عمده را با دکمه‌ی بالا ثبت کنید."
                  : "خرید کالا برای انبار را اینجا ثبت کنید تا موجودی و بهای تمام‌شده درست حساب شود."
            }
            action={
              canWrite &&
              !isReturn && (
                <Link href={`/admin/accounting/invoices/new?type=${type}`} className={btn.primary}>
                  ➕ {INVOICE_TYPE_LABELS[type]} تازه
                </Link>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
