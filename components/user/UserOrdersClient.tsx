"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface OrderItem {
  product: { mainImage: string | null; images: { url: string }[] };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  items: OrderItem[];
  _count: { items: number };
}

interface Props {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  currentStatus?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; dot?: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", color: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",     dot: "bg-amber-500 animate-pulse" },
  PAID:            { label: "پرداخت شده",        color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",         dot: "bg-blue-500" },
  CONFIRMED:       { label: "تأیید شده",          color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  PROCESSING:      { label: "در حال آماده‌سازی", color: "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",         dot: "bg-cyan-500 animate-pulse" },
  PACKAGING:       { label: "بسته‌بندی",          color: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  SHIPPED:         { label: "ارسال شده",          color: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400", dot: "bg-purple-500 animate-pulse" },
  DELIVERED:       { label: "تحویل داده شده",     color: "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400",        dot: "bg-teal-500" },
  COMPLETED:       { label: "تکمیل شده",          color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  CANCELED:        { label: "لغو شده",            color: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400" },
  REFUNDED:        { label: "مرجوع شده",          color: "bg-gray-500/10 border-gray-500/20 text-gray-500 dark:text-gray-400" },
};

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fa-IR"); }

const FILTERS = [
  { key: undefined, label: "همه" },
  { key: "active",    label: "جاری" },
  { key: "delivered", label: "تحویل شده" },
  { key: "canceled",  label: "لغو / مرجوع" },
];

export default function UserOrdersClient({ orders, total, page, pageSize, currentStatus }: Props) {
  const router = useRouter();
  const totalPages = Math.ceil(total / pageSize);

  function goFilter(key?: string) {
    router.push(key ? `/user/orders?status=${key}` : "/user/orders");
  }

  function goPage(p: number) {
    const url = currentStatus ? `/user/orders?status=${currentStatus}&page=${p}` : `/user/orders?page=${p}`;
    router.push(url);
  }

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">سفارش‌های من</h2>
          <p className="text-[11px] font-bold text-gray-400 mt-1">مدیریت و پیگیری خریدهای انجام شده</p>
        </div>
        <div className="flex items-center gap-2 p-1.5 bg-white/40 dark:bg-gray-950/40 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl">
          {FILTERS.map(f => (
            <button key={f.label} onClick={() => goFilter(f.key)}
              className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all ${
                currentStatus === f.key
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem]">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <p className="text-gray-500 font-black text-lg">سفارشی یافت نشد</p>
          <Link href="/products" className="mt-4 inline-block px-6 py-3 bg-primary-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-primary-500/20">
            شروع خرید
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => {
            const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
            const images = order.items.slice(0, 3).map(i => i.product.mainImage ?? i.product.images[0]?.url ?? null);
            const extraCount = order._count.items - 3;
            const isCanceled = order.status === "CANCELED" || order.status === "REFUNDED";
            const isPending = order.status === "PENDING_PAYMENT";

            return (
              <div key={order.id}
                className={`relative overflow-hidden bg-white/40 dark:bg-gray-950/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-none group transition-all hover:border-primary-500/30 ${isCanceled ? "opacity-70 hover:opacity-100" : ""}`}>

                <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/15 transition-colors" />

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase">شماره سفارش</span>
                        <span className="text-[13px] font-black text-gray-900 dark:text-white tabular-nums">#{order.orderNumber}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase">تاریخ ثبت</span>
                        <span className="text-[13px] font-bold text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</span>
                      </div>
                      {!isCanceled && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase">مبلغ کل</span>
                          <span className="text-[13px] font-black text-primary-500 tabular-nums">{toFa(order.grandTotal)} تومان</span>
                        </div>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-black ${s.color}`}>
                      {s.dot ? (
                        <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      ) : order.status === "CANCELED" ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                      {s.label}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="py-6 flex flex-wrap items-center justify-between gap-6">
                    {/* Product images */}
                    <div className={`flex items-center -space-x-4 space-x-reverse ${isCanceled ? "grayscale" : ""}`}>
                      {images.map((img, i) => (
                        <div key={i} className="w-14 h-14 rounded-full border-4 border-white/50 dark:border-gray-900/50 bg-white/30 dark:bg-white/10 backdrop-blur-md overflow-hidden shadow-xl">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div className="w-14 h-14 rounded-full border-4 border-white/50 dark:border-gray-900/50 bg-primary-500/20 dark:bg-primary-500/10 backdrop-blur-md flex items-center justify-center shadow-xl">
                          <span className="text-[10px] font-black text-primary-600 dark:text-primary-400">+{toFa(extraCount)}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {isPending ? (
                        <Link href={`/checkout/confirm/${order.id}`}
                          className="px-6 py-3 rounded-2xl bg-primary-500 text-white text-[11px] font-black shadow-lg shadow-primary-500/25">
                          پرداخت آنلاین
                        </Link>
                      ) : order.status === "SHIPPED" ? (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[11px] font-black">
                          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                          در مسیر تحویل
                        </div>
                      ) : order.status === "REFUNDED" ? (
                        <button className="px-6 py-3 rounded-2xl bg-amber-500 text-white text-[11px] font-black shadow-lg shadow-amber-500/20">
                          جزئیات استرداد
                        </button>
                      ) : order.status === "CANCELED" ? (
                        <button className="px-6 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 text-[11px] font-black">
                          مشاهده علت لغو
                        </button>
                      ) : null}

                      <Link href={`/user/orders/${order.id}`}
                        className="px-6 py-3 rounded-2xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 text-[11px] font-black hover:border-primary-500/30 hover:text-primary-500 transition-all">
                        مشاهده جزئیات
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center py-6" dir="rtl">
          <nav className="flex items-center gap-2 p-2 bg-white/40 dark:bg-gray-950/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2rem] shadow-[0_15px_35px_rgba(0,0,0,0.05)]">
            <button onClick={() => page > 1 && goPage(page - 1)} disabled={page <= 1}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-primary-500 hover:text-white transition-all disabled:opacity-30 group">
              <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5 px-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => goPage(i + 1)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-[13px] font-black transition-all active:scale-95 ${
                    page === i + 1
                      ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                      : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5"
                  }`}>
                  {(i + 1).toLocaleString("fa-IR")}
                </button>
              ))}
            </div>
            <button onClick={() => page < totalPages && goPage(page + 1)} disabled={page >= totalPages}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-primary-500 hover:text-white transition-all disabled:opacity-30 group">
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}