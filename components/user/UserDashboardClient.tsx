"use client";

import Link from "next/link";
import ClubCard from "@/components/club/ClubCard";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  createdAt: string;
}

interface Stats {
  successOrders: number;
  processingOrders: number;
  canceledOrders: number;
  cartItems: number;
  walletBalance: string;
}

interface Props {
  user: { firstName: string | null; lastName: string | null; phone: string };
  stats: Stats;
  recentOrders: Order[];
}

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR");
}

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", color: "bg-amber-500/10 text-amber-500 border-amber-500/10",   dot: "bg-amber-500" },
  PAID:            { label: "پرداخت شده",        color: "bg-primary-500/10 text-primary-500 border-primary-500/10",       dot: "bg-primary-500" },
  PROCESSING:      { label: "در حال پردازش",     color: "bg-primary-500/10 text-primary-500 border-primary-500/10", dot: "bg-primary-500" },
  SHIPPED:         { label: "ارسال شده",          color: "bg-purple-500/10 text-purple-500 border-purple-500/10", dot: "bg-purple-500" },
  DELIVERED:       { label: "تحویل شده",          color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/10", dot: "bg-emerald-500 animate-pulse" },
  CANCELED:        { label: "لغو شده",            color: "bg-red-500/10 text-secondary-500 border-red-500/10",         dot: "bg-red-500" },
  REFUNDED:        { label: "مسترد شده",          color: "bg-gray-500/10 text-gray-500 border-gray-500/10",      dot: "bg-gray-500" },
};

export default function UserDashboardClient({ user, stats, recentOrders }: Props) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone;

  return (
    <div className="space-y-8">

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {}
        <div className="group relative p-8 rounded-[2.5rem] bg-white/40 dark:bg-white/[0.03] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] dark:shadow-none transition-all duration-500 hover:-translate-y-2">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-secondary-500/10 rounded-full blur-3xl group-hover:bg-secondary-500/20 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="w-14 h-14 rounded-[1.5rem] bg-secondary-500/10 dark:bg-secondary-500/20 border border-secondary-500/20 flex items-center justify-center text-secondary-600 dark:text-secondary-400 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-secondary-600 dark:text-secondary-400 bg-secondary-500/10 px-3 py-1 rounded-full uppercase tracking-tighter">Wallet</span>
                <span className="text-[11px] font-bold text-gray-400 mt-1">موجودی کیف پول</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
                {toFa(stats.walletBalance)}
              </span>
              <span className="text-[11px] font-black text-gray-400">تومان</span>
            </div>
            <div className="mt-6 w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="w-2/3 h-full bg-gradient-to-l from-secondary-500 to-secondary-300 rounded-full group-hover:w-full transition-all duration-1000" />
            </div>
          </div>
        </div>
      </div>


        {}
        {/* کارت باشگاه مشتریان */}
        <ClubCard />

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: "سفارش‌های موفق",    value: stats.successOrders,    color: "emerald", icon: "M5 13l4 4L19 7" },
          { label: "در حال پردازش",     value: stats.processingOrders, color: "primary", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
          { label: "سبد خرید باز",     value: stats.cartItems,        color: "amber",   icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
          { label: "سفارش‌های لغو شده", value: stats.canceledOrders,  color: "rose",    icon: "M6 18L18 6M6 6l12 12" },
        ].map((item, i) => (
          <div key={i} className={`group relative overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-7 transition-all duration-500 hover:-translate-y-2`}>
            <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${item.color}-500/10 rounded-full blur-2xl group-hover:bg-${item.color}-500/20 transition-all`} />
            <div className="relative z-10 flex flex-col gap-5">
              <div className={`w-14 h-14 rounded-2xl bg-${item.color}-500/10 flex items-center justify-center text-${item.color}-600 dark:text-${item.color}-400 border border-${item.color}-500/10 shadow-inner group-hover:scale-110 transition-transform`}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-500 dark:text-gray-400 mb-2">{item.label}</p>
                <h4 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter">
                  {toFa(item.value)} <span className="text-sm text-gray-400 font-bold mr-1">مورد</span>
                </h4>
              </div>
            </div>
          </div>
        ))}
      </div>

      {}
      <div className="relative overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-500/5 rounded-full blur-[100px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-primary-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">آخرین سفارش‌ها</h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1">لیست ۵ سفارش اخیر شما</p>
              </div>
            </div>
            <Link href="/user/orders"
              className="px-5 py-2 rounded-xl bg-gray-100/50 dark:bg-white/5 text-[11px] font-black text-gray-600 dark:text-gray-400 hover:bg-primary-500 hover:text-white transition-all duration-300">
              مشاهده همه
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-gray-500 font-bold text-sm">هنوز سفارشی ثبت نکرده‌اید</p>
              <Link href="/products" className="mt-4 inline-block px-6 py-2.5 bg-primary-500 text-white rounded-xl text-xs font-black shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all">
                شروع خرید
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-right border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-gray-400 text-[11px] font-black">
                    <th className="pb-2 pr-6 uppercase tracking-widest">کد سفارش</th>
                    <th className="pb-2">تاریخ</th>
                    <th className="pb-2">وضعیت</th>
                    <th className="pb-2 text-center">مبلغ</th>
                    <th className="pb-2 pl-6 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => {
                    const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
                    return (
                      <tr key={order.id} className="group transition-all duration-300">
                        <td className="py-4 pr-6 rounded-r-[1.5rem] bg-white/50 dark:bg-white/[0.03] border-y border-r border-white/60 dark:border-white/5 group-hover:bg-primary-500/5 group-hover:border-primary-500/20 transition-all">
                          <span className="text-xs font-black text-gray-900 dark:text-white">#{order.orderNumber}</span>
                        </td>
                        <td className="py-4 bg-white/50 dark:bg-white/[0.03] border-y border-white/60 dark:border-white/5 group-hover:bg-primary-500/5 group-hover:border-primary-500/20 transition-all">
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</span>
                        </td>
                        <td className="py-4 bg-white/50 dark:bg-white/[0.03] border-y border-white/60 dark:border-white/5 group-hover:bg-primary-500/5 group-hover:border-primary-500/20 transition-all">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border ${s.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td className="py-4 bg-white/50 dark:bg-white/[0.03] border-y border-white/60 dark:border-white/5 text-center group-hover:bg-primary-500/5 group-hover:border-primary-500/20 transition-all">
                          <span className="text-xs font-black text-gray-900 dark:text-white">{toFa(order.grandTotal)} تومان</span>
                        </td>
                        <td className="py-4 pl-6 rounded-l-[1.5rem] bg-white/50 dark:bg-white/[0.03] border-y border-l border-white/60 dark:border-white/5 group-hover:bg-primary-500/5 group-hover:border-primary-500/20 transition-all">
                          <div className="flex items-center justify-end gap-2">
                            {order.status === "PENDING_PAYMENT" ? (
                              <Link href={`/user/orders/${order.id}/pay`}
                                className="h-9 px-4 flex items-center justify-center rounded-xl bg-primary-500 text-white text-[10px] font-black shadow-lg shadow-primary-500/20 transition-all active:scale-95">
                                پرداخت آنلاین
                              </Link>
                            ) : (
                              <Link href={`/user/orders/${order.id}`}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 text-gray-400 hover:text-primary-500 hover:border-primary-500 transition-all shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {}
      <div className="relative overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]" />
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">تیکت‌های اخیر</h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1">آخرین درخواست‌های پشتیبانی</p>
              </div>
            </div>
            <Link href="/user/tickets/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-[11px] font-black shadow-lg shadow-primary-500/20 hover:scale-105 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              تیکت جدید
            </Link>
          </div>

          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm font-bold">تیکتی ثبت نشده است</p>
          </div>
        </div>
      </div>

    </div>
  );
}
