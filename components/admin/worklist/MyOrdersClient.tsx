"use client";

/**
 * «سفارش‌های من» — سفارش‌های تلفنیِ همین کارمند، بدون گشتن در فهرست سفارش‌های سایت.
 *
 * هر ردیف باز می‌شود و کالاها را با قیمت فروش و قیمت خرید نشان می‌دهد، به‌علاوه‌ی
 * وضعیت سود: «قیمت خرید ثبت‌نشده» یعنی هنوز کاری از کارمند مانده (بخش ۲۲.۱۰).
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatJalaliShort } from "@/lib/club/jalali";
import PhoneOrderForm from "@/components/admin/orders/PhoneOrderForm";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  isReferral: boolean;
  paymentTerm: "CASH" | "CREDIT";
  /** مانده‌ی بدهی اعتباری — `null` یعنی نقدی یا تسویه‌شده */
  creditDue: string | null;
  creditNext: string | null;
  itemsTotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
  note: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string;
  staffName: string | null;
  items: { id: string; title: string; qty: number; unitPrice: string; cost: string | null }[];
  staffDeal: { id: string; status: string; cost: string | null; profit: string | null; commission: string | null; payoutId: string | null } | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", cls: "bg-amber-500/10 text-amber-600" },
  PAID: { label: "پرداخت شده", cls: "bg-blue-500/10 text-blue-600" },
  CONFIRMED: { label: "تأیید شده", cls: "bg-indigo-500/10 text-indigo-600" },
  PROCESSING: { label: "در حال آماده‌سازی", cls: "bg-cyan-500/10 text-cyan-600" },
  PACKAGING: { label: "بسته‌بندی", cls: "bg-violet-500/10 text-violet-600" },
  SHIPPED: { label: "ارسال شده", cls: "bg-purple-500/10 text-purple-600" },
  DELIVERED: { label: "تحویل داده شده", cls: "bg-teal-500/10 text-teal-600" },
  COMPLETED: { label: "تکمیل شده", cls: "bg-emerald-500/10 text-emerald-600" },
  CANCELED: { label: "لغو شده", cls: "bg-red-500/10 text-red-500" },
  REFUNDED: { label: "مسترد شده", cls: "bg-gray-500/10 text-gray-500" },
};

const TABS = [
  { key: "all", label: "همه" },
  { key: "pending", label: "در انتظار پرداخت" },
  { key: "active", label: "در جریان" },
  { key: "done", label: "تحویل‌شده" },
  { key: "canceled", label: "لغو و مرجوعی" },
];

const fa = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("fa-IR");

function profitBadge(o: OrderRow) {
  const d = o.staffDeal;
  if (!d) {
    if (o.status === "PENDING_PAYMENT") return <span className="text-gray-400">بعد از پرداخت</span>;
    if (o.creditDue) return <span className="text-gray-400">بعد از آخرین قسط</span>;
    return <span className="text-gray-400">—</span>;
  }
  if (d.status === "VOID") return <span className="text-gray-400">لغو شد</span>;
  if (d.status === "PENDING")
    return (
      <Link href="/admin/worklist/deals" className="font-bold text-amber-600 hover:underline">
        قیمت خرید ثبت‌نشده
      </Link>
    );
  const neg = d.profit !== null && Number(d.profit) < 0;
  return <span className={`font-bold ${neg ? "text-red-600" : "text-emerald-600"}`}>{fa(d.profit)}</span>;
}

export default function MyOrdersClient() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [staff, setStaff] = useState("me");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: OrderRow[];
    pages: number;
    total: number;
    tabCounts: Record<string, number>;
    staff: { id: string; name: string }[];
    can: { viewAll: boolean; openOrder: boolean };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    const p = new URLSearchParams({ tab, page: String(page), staff });
    if (q.trim()) p.set("q", q.trim());
    fetch(`/api/admin/worklist/my-orders?${p}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری نشد");
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری نشد"));
  }, [tab, page, staff, q]);

  useEffect(() => {
    const h = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  const showStaff = staff !== "me";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFormOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold"
        >
          + سفارش تلفنی تازه
        </button>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="شماره سفارش، نام یا موبایل مشتری"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
        />
        {data?.can.viewAll && (
          <select
            value={staff}
            onChange={(e) => { setStaff(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none"
          >
            <option value="me">سفارش‌های خودم</option>
            <option value="all">همه‌ی کارکنان</option>
            {data.staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              tab === t.key
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
            }`}
          >
            {t.label}
            {data && <span className="mr-1 opacity-60">{fa(data.tabCounts[t.key] ?? 0)}</span>}
          </button>
        ))}
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
            <tr className="text-right">
              <th className="px-4 py-2.5">سفارش</th>
              <th className="px-3 py-2.5">مشتری</th>
              {showStaff && <th className="px-3 py-2.5">ثبت‌کننده</th>}
              <th className="px-3 py-2.5 text-center">مبلغ (تومان)</th>
              <th className="px-3 py-2.5 text-center">وضعیت</th>
              <th className="px-3 py-2.5 text-center">سود</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {data?.items.map((o) => {
              const s = STATUS[o.status] ?? STATUS.PENDING_PAYMENT;
              const expanded = open === o.id;
              return (
                <Fragment key={o.id}>
                  <tr
                    onClick={() => setOpen(expanded ? null : o.id)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-gray-900 dark:text-white" dir="ltr">
                        {o.orderNumber}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {formatJalaliShort(new Date(o.createdAt))} · {fa(o.items.length)} قلم
                        {o.isReferral && (
                          <span className="mr-1.5 text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">ریفری</span>
                        )}
                        {o.paymentTerm === "CREDIT" && (
                          <span className="mr-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">اعتباری</span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-gray-900 dark:text-white">{o.customerName ?? "—"}</p>
                      <p className="text-[11px] text-gray-400" dir="ltr">{o.customerPhone}</p>
                    </td>
                    {showStaff && <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{o.staffName}</td>}
                    <td className="px-3 py-2.5 text-center">
                      <p className="font-bold text-gray-900 dark:text-white">{fa(o.grandTotal)}</p>
                      {o.creditDue && (
                        <p className="text-[10px] font-bold text-amber-600">مانده {fa(o.creditDue)}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">{profitBadge(o)}</td>
                  </tr>
                  {expanded && (
                    <tr className="bg-gray-50/60 dark:bg-white/[0.02]">
                      <td colSpan={showStaff ? 6 : 5} className="px-4 py-3">
                        <table className="w-full text-[11px]">
                          <thead className="text-gray-400">
                            <tr className="text-right">
                              <th className="py-1">کالا</th>
                              <th className="py-1 text-center">تعداد</th>
                              <th className="py-1 text-center">فروش واحد</th>
                              <th className="py-1 text-center">خرید کل ردیف</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.items.map((i) => (
                              <tr key={i.id}>
                                <td className="py-1 text-gray-800 dark:text-gray-200">{i.title}</td>
                                <td className="py-1 text-center">{fa(i.qty)}</td>
                                <td className="py-1 text-center">{fa(i.unitPrice)}</td>
                                <td className="py-1 text-center">
                                  {i.cost !== null ? fa(i.cost) : <span className="text-amber-600">معلوم نیست</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
                          <span>کالاها: {fa(o.itemsTotal)}</span>
                          {Number(o.shippingFee) > 0 && <span>ارسال: {fa(o.shippingFee)}</span>}
                          {Number(o.discountTotal) > 0 && <span>تخفیف: {fa(o.discountTotal)}</span>}
                          {o.staffDeal?.commission != null && (
                            <span className="text-emerald-600 font-bold">پورسانت: {fa(o.staffDeal.commission)}</span>
                          )}
                          {o.staffDeal?.payoutId && <span>تسویه شده</span>}
                        </div>
                        {o.creditDue && (
                          <p className="mt-2 text-[11px] text-amber-600">
                            بدهی اعتباری: {fa(o.creditDue)} تومان
                            {o.creditNext && ` · موعد بعدی ${formatJalaliShort(new Date(o.creditNext))}`}
                            {" · "}
                            <Link href={`/admin/worklist/credit?tab=all&q=${encodeURIComponent(o.orderNumber)}`} className="font-bold underline">
                              موعدها
                            </Link>
                          </p>
                        )}
                        {o.note && <p className="mt-2 text-[11px] text-gray-500">یادداشت: {o.note}</p>}
                        {data.can.openOrder && (
                          <Link href={`/admin/orders/${o.id}`} className="inline-block mt-2 text-[11px] font-bold text-blue-600 hover:underline">
                            باز کردن سفارش ←
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  سفارشی در این بخش نیست.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40">قبلی</button>
          <span className="text-gray-500">{fa(page)} از {fa(data.pages)}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40">بعدی</button>
        </div>
      )}

      <PhoneOrderForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={load} />
    </div>
  );
}
