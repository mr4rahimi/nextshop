"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  trackingCode: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; phone: string; avatarUrl: string | null };
  address: { province: string; city: string } | null;
  _count: { items: number };
}

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800",    dot: "bg-amber-500" },
  PAID:            { label: "پرداخت شده",        color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800",          dot: "bg-blue-500" },
  CONFIRMED:       { label: "تأیید شده",          color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-800", dot: "bg-indigo-500" },
  PROCESSING:      { label: "در حال آماده‌سازی", color: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 border-cyan-200 dark:border-cyan-800",           dot: "bg-cyan-500 animate-pulse" },
  PACKAGING:       { label: "بسته‌بندی",          color: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 border-violet-200 dark:border-violet-800", dot: "bg-violet-500" },
  SHIPPED:         { label: "ارسال شده",          color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-200 dark:border-purple-800", dot: "bg-purple-500 animate-pulse" },
  DELIVERED:       { label: "تحویل داده شده",     color: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 border-teal-200 dark:border-teal-800",          dot: "bg-teal-500" },
  COMPLETED:       { label: "تکمیل شده",          color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  CANCELED:        { label: "لغو شده",            color: "bg-red-50 dark:bg-red-900/20 text-red-500 border-red-200 dark:border-red-800",               dot: "bg-red-500" },
  REFUNDED:        { label: "مسترد شده",          color: "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700",             dot: "bg-gray-400" },
};

const ALL_STATUSES = Object.entries(STATUS_MAP).map(([k, v]) => ({ key: k, label: v.label }));

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fa-IR"); }

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 20;

  const fetchOrders = useCallback(async (search: string, status: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(q, statusFilter, page); }, [q, statusFilter, page, fetchOrders]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(searchInput);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت سفارشات</h1>
          <p className="text-sm text-gray-500 mt-1">{toFa(total)} سفارش ثبت شده</p>
        </div>

        {/* جستجو */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <input type="text" placeholder="شماره سفارش، نام یا موبایل..."
              className="w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pr-10 pl-4 text-sm outline-none focus:border-blue-500 dark:text-white"
              value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">جستجو</button>
          {(q || statusFilter) && (
            <button type="button" onClick={() => { setQ(""); setSearchInput(""); setStatusFilter(""); setPage(1); }}
              className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              ✕
            </button>
          )}
        </form>
      </div>

      {/* فیلتر وضعیت */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setStatusFilter(""); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${!statusFilter ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
          همه
        </button>
        {ALL_STATUSES.map(s => (
          <button key={s.key} onClick={() => { setStatusFilter(s.key); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${statusFilter === s.key ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* جدول */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-gray-50 dark:bg-gray-800/50 animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="font-bold">سفارشی یافت نشد</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">شماره سفارش</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">کاربر</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">مبلغ</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">آدرس</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">تاریخ</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">وضعیت</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {orders.map(order => {
                    const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
                    const name = [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.phone;
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div>
                            <span className="text-sm font-black text-gray-900 dark:text-white">#{order.orderNumber}</span>
                            <p className="text-[10px] text-gray-400 mt-0.5">{toFa(order._count.items)} قلم</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 text-xs font-black text-blue-600 overflow-hidden">
                              {order.user.avatarUrl
                                ? <img src={order.user.avatarUrl} alt={name} className="w-full h-full object-cover" />
                                : (order.user.firstName ?? order.user.phone).charAt(0)
                              }
                            </div>
                            <div>
                              <p className="text-xs font-black text-gray-900 dark:text-white">{name}</p>
                              <p className="text-[10px] text-gray-400" dir="ltr">{order.user.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{toFa(order.grandTotal)}</span>
                          <span className="text-[10px] text-gray-400 mr-1">ت</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {order.address ? `${order.address.province}، ${order.address.city}` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[11px] text-gray-500">{formatDate(order.createdAt)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border ${s.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link href={`/admin/orders/${order.id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map(order => {
                const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
                const name = [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.phone;
                return (
                  <Link key={order.id} href={`/admin/orders/${order.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-gray-900 dark:text-white">#{order.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${s.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{name}</span>
                      <span className="font-black text-gray-900 dark:text-white tabular-nums">{toFa(order.grandTotal)} ت</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(order.createdAt)}</p>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-500">{toFa((page-1)*PAGE_SIZE+1)}–{toFa(Math.min(page*PAGE_SIZE,total))} از {toFa(total)}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2">{toFa(page)} / {toFa(totalPages)}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}