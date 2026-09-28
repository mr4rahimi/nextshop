"use client";

/**
 * فهرست فاکتورها — فروش (فاکتور، پیش‌فاکتور، برگشتی) یا خرید (فاکتور، برگشتی).
 * docs/plans/accounting.md بخش ۱۳.۱. موبایل کارت، دسکتاپ جدول با جمع پایین.
 *
 * فاز ۱۰: حالت «انتخاب» برای چاپ گروهی؛ `?batch=` فاکتورهای یک صدور گروهی با
 * دکمه‌ی «چاپ همه»؛ دکمه‌ی «صدور گروهی» (یک فاکتور برای چند مشتری).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { CHANNEL_LABELS, INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import { RangeBar, rangeFor, rangeQuery, type Range } from "../Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader } from "../ui";
import { CheckSquare, Plus, Printer, Users } from "lucide-react";

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
  batchId?: string | null;
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
  const batch = sp.get("batch");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((x) => {
      const n = new Set(x);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const printIds = (ids: string[]) =>
    router.push(`/admin/accounting/invoices/batch/print?ids=${ids.join(",")}&back=${encodeURIComponent(side === "sales" ? "/admin/accounting/sales" : "/admin/accounting/purchases")}`);

  const load = useCallback(() => {
    const p = new URLSearchParams(batch ? {} : rangeQuery(range));
    p.set("side", side);
    if (batch) p.set("batch", batch);
    else p.set("type", type);
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    api<typeof data & object>(`/api/admin/accounting/invoices?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [side, type, status, q, range, batch]);

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
          <>
            {data && data.items.length > 0 && (
              <button
                onClick={() => {
                  setPicking((x) => !x);
                  setPicked(new Set());
                }}
                className={picking ? btn.dark : btn.soft}
              >
                <CheckSquare className="h-4 w-4" aria-hidden />
                {picking ? "پایان انتخاب" : "انتخاب"}
              </button>
            )}
            {canWrite && !isReturn && (
              <Link href={`/admin/accounting/invoices/new?type=${type}&batch=1`} className={btn.soft} title="یک فاکتور برای چند مشتری">
                <Users className="h-4 w-4" aria-hidden />
                صدور گروهی
              </Link>
            )}
            {canWrite && !isReturn && (
              <Link href={`/admin/accounting/invoices/new?type=${type}`} className={btn.primary}>
                <Plus className="h-4 w-4" aria-hidden />
                {INVOICE_TYPE_LABELS[type]} تازه
              </Link>
            )}
          </>
        }
      />

      {batch && data && (
        <Card className="p-4 flex flex-wrap items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
          <p className="flex-1 min-w-[12rem] text-sm font-bold text-emerald-700 dark:text-emerald-300">
            ✓ {faNum(data.items.length)} فاکتور در یک صدور گروهی — جمع {formatAmount(data.summary.total)} تومان
          </p>
          <button onClick={() => printIds(data.items.map((i) => i.id))} className={btn.primary}>
            <Printer className="h-4 w-4" aria-hidden />
            چاپ همه
          </button>
          <Link href={side === "sales" ? "/admin/accounting/sales" : "/admin/accounting/purchases"} className={btn.soft}>
            همه‌ی فاکتورها
          </Link>
        </Card>
      )}

      {!batch && (<>
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
      </>)}
      <ErrorText>{error}</ErrorText>

      {picking && data && (
        <div className="sticky top-2 z-20 rounded-2xl bg-gray-900 text-white px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-sm font-bold flex-1">{faNum(picked.size)} انتخاب شده</span>
          <button onClick={() => setPicked(new Set(data.items.filter((i) => i.status !== "DRAFT").map((i) => i.id)))} className="text-xs font-bold px-2 py-1 rounded-lg bg-white/10">
            انتخاب همه
          </button>
          <button onClick={() => setPicked(new Set())} className="text-xs font-bold px-2 py-1 rounded-lg bg-white/10">
            هیچ
          </button>
          <button disabled={!picked.size} onClick={() => printIds([...picked])} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 disabled:opacity-40 inline-flex items-center gap-1">
            <Printer className="h-3.5 w-3.5" aria-hidden />
            چاپ گروهی
          </button>
        </div>
      )}

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
            <Link
              key={inv.id}
              href={`/admin/accounting/invoices/${inv.id}`}
              onClick={(e) => {
                if (!picking) return;
                e.preventDefault();
                toggle(inv.id);
              }}
              className={`flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5 ${picked.has(inv.id) ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}
            >
              {picking && <input type="checkbox" readOnly checked={picked.has(inv.id)} className="accent-blue-600 w-4 h-4 shrink-0" />}
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
              {picking && <th className="w-10 px-3" />}
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
                onClick={() => (picking ? toggle(inv.id) : router.push(`/admin/accounting/invoices/${inv.id}`))}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${inv.status === "VOID" ? "text-gray-400" : ""} ${picked.has(inv.id) ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}
              >
                {picking && (
                  <td className="px-3">
                    <input type="checkbox" readOnly checked={picked.has(inv.id)} className="accent-blue-600 w-4 h-4" />
                  </td>
                )}
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
                  <Plus className="h-4 w-4" aria-hidden />
                  {INVOICE_TYPE_LABELS[type]} تازه
                </Link>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
