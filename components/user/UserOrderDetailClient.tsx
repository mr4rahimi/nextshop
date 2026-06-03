"use client";

import Link from "next/link";

interface OrderItem {
  id: string; qty: number; unitPrice: string; unitSalePrice: string | null;
  titleSnapshot: string;
  product: { id: string; title: string; slug: string; mainImage: string | null; warranty: string | null; images: { url: string }[] };
}
interface Address { receiver: string; phone: string; province: string; city: string; addressLine: string; postalCode: string | null; }
interface Order {
  id: string; orderNumber: string; status: string;
  itemsTotal: string; shippingFee: string; discountTotal: string; grandTotal: string;
  trackingCode: string | null; createdAt: string;
  items: OrderItem[]; address: Address | null;
}
interface Props { order: Order; }

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", color: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",     dot: "bg-amber-500 animate-pulse" },
  PAID:            { label: "پرداخت شده",        color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",         dot: "bg-blue-500" },
  CONFIRMED:       { label: "تأیید شده",          color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  PROCESSING:      { label: "در حال آماده‌سازی", color: "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",         dot: "bg-cyan-500 animate-pulse" },
  PACKAGING:       { label: "بسته‌بندی",          color: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  SHIPPED:         { label: "ارسال شده",          color: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400", dot: "bg-purple-500 animate-pulse" },
  DELIVERED:       { label: "تحویل داده شده",     color: "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400",        dot: "bg-teal-500" },
  COMPLETED:       { label: "تکمیل شده",          color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  CANCELED:        { label: "لغو شده",            color: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",            dot: "bg-red-500" },
  REFUNDED:        { label: "مرجوع شده",          color: "bg-gray-500/10 border-gray-500/20 text-gray-500 dark:text-gray-400",        dot: "bg-gray-400" },
};

const TIMELINE_STEPS = [
  { key: "PENDING_PAYMENT", label: "ثبت سفارش",      icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
  { key: "PAID",            label: "پرداخت موفق",     icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "CONFIRMED",       label: "تأیید فروشگاه",   icon: "M5 13l4 4L19 7" },
  { key: "PROCESSING",      label: "آماده‌سازی",      icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  { key: "PACKAGING",       label: "بسته‌بندی",       icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "SHIPPED",         label: "ارسال شده",        icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
  { key: "DELIVERED",       label: "تحویل داده شده",  icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "COMPLETED",       label: "تکمیل شده",        icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
];

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string)  { return new Date(iso).toLocaleString("fa-IR"); }

export default function UserOrderDetailClient({ order }: Props) {
  const s = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING_PAYMENT;
  const isCanceled = order.status === "CANCELED" || order.status === "REFUNDED";
  const currentIdx = TIMELINE_STEPS.findIndex(st => st.key === order.status);

  return (
    <div className="space-y-8" dir="rtl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8">
        <div className="flex items-center gap-5">
          <Link href="/user/orders"
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-primary-500 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
              سفارش <span className="text-primary-500 tabular-nums">#{order.orderNumber}</span>
            </h2>
            <p className="text-sm font-bold text-gray-400 mt-1">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-sm font-black ${s.color}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>

      {/* Timeline */}
      {!isCanceled && (
        <div className="relative overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl" />
          <h3 className="relative text-lg font-black text-gray-900 dark:text-white mb-8 flex items-center gap-3">
            <span className="w-2 h-6 bg-primary-500 rounded-full" />
            مسیر سفارش
          </h3>

          {/* دسکتاپ — افقی */}
          <div className="hidden md:flex items-start gap-0 overflow-x-auto pb-2 relative z-10">
            {TIMELINE_STEPS.map((step, i) => {
              const done   = currentIdx >= 0 && i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={step.key} className="flex items-start flex-shrink-0">
                  <div className="flex flex-col items-center gap-2 w-[88px]">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all ${
                      active ? "bg-primary-500 border-primary-500 shadow-xl shadow-primary-500/30 scale-110" :
                      done   ? "bg-emerald-500 border-emerald-500 shadow-sm" :
                               "bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                    }`}>
                      {done && !active ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className={`w-5 h-5 ${active ? "text-white" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[9px] font-black text-center leading-tight ${
                      active ? "text-primary-600 dark:text-primary-400" :
                      done   ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                    }`}>{step.label}</span>
                    {active && <span className="text-[8px] font-black text-primary-500 bg-primary-500/10 px-1.5 py-0.5 rounded-lg">فعلی</span>}
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div className={`h-0.5 w-6 mt-5 flex-shrink-0 ${i < currentIdx ? "bg-emerald-500" : "bg-gray-200 dark:bg-white/10"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* موبایل — عمودی */}
          <div className="md:hidden space-y-0 relative before:absolute before:right-[19px] before:top-2 before:w-0.5 before:h-[calc(100%-16px)] before:bg-gray-200/50 dark:before:bg-white/5">
            {TIMELINE_STEPS.map((step, i) => {
              const done   = currentIdx >= 0 && i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={step.key} className={`relative flex items-center gap-4 pr-12 py-3 ${!done ? "opacity-40" : ""}`}>
                  <div className={`absolute right-0 w-10 h-10 rounded-2xl flex items-center justify-center border-2 z-10 ${
                    active ? "bg-primary-500 border-primary-500 shadow-xl shadow-primary-500/30" :
                    done   ? "bg-emerald-500 border-emerald-500" :
                             "bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                  }`}>
                    {done && !active ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className={`w-5 h-5 ${active ? "text-white" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-black ${active ? "text-primary-600 dark:text-primary-400" : done ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                    {step.label}
                  </span>
                  {active && <span className="text-[10px] font-bold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-lg">مرحله فعلی</span>}
                </div>
              );
            })}
          </div>

          {/* کد رهگیری */}
          {order.trackingCode && (
            <div className="mt-6 p-4 bg-primary-500/5 border border-primary-500/20 rounded-2xl flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div>
                  <p className="text-[10px] font-bold text-gray-400">کد رهگیری مرسوله</p>
                  <p className="text-base font-black text-primary-600 dark:text-primary-400 tracking-widest tabular-nums">{order.trackingCode}</p>
                </div>
              </div>
              <button onClick={() => navigator.clipboard.writeText(order.trackingCode!)}
                className="text-xs font-black text-primary-600 bg-primary-500/10 px-3 py-1.5 rounded-xl hover:bg-primary-500/20 transition-all">
                کپی
              </button>
            </div>
          )}
        </div>
      )}

      {/* پیام لغو/مرجوع */}
      {isCanceled && (
        <div className={`flex items-center gap-4 p-6 rounded-[2.5rem] border ${order.status === "CANCELED" ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${order.status === "CANCELED" ? "bg-red-100 dark:bg-red-900/30 text-red-500" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className={`font-black text-sm ${order.status === "CANCELED" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
              {order.status === "CANCELED" ? "این سفارش لغو شده است" : "این سفارش مرجوع شده است"}
            </p>
            <p className="text-xs text-gray-500 mt-1">برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* اقلام سفارش */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden bg-white/40 dark:bg-gray-950/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
            <div className="relative z-10 p-8 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-6 bg-primary-500 rounded-full" />
                اقلام سفارش <span className="text-xs font-bold text-gray-400 mr-2">({toFa(order.items.length)} مورد)</span>
              </h3>
            </div>
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-black uppercase tracking-[0.15em] border-b border-gray-100 dark:border-white/5">
                    <th className="p-6">محصول</th>
                    <th className="p-6 text-center">تعداد</th>
                    <th className="p-6 text-center">قیمت واحد</th>
                    <th className="p-6 text-left">جمع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50 dark:divide-white/5">
                  {order.items.map(item => {
                    const img   = item.product.mainImage ?? item.product.images[0]?.url ?? null;
                    const price = Number(item.unitSalePrice ?? item.unitPrice);
                    return (
                      <tr key={item.id} className="group hover:bg-white/60 dark:hover:bg-white/[0.02] transition-all">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/5 p-1 flex-shrink-0">
                              {img ? <img src={img} alt={item.titleSnapshot} className="w-full h-full object-contain rounded-xl" /> : <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-xl" />}
                            </div>
                            <div>
                              <Link href={`/products/${item.product.slug}`} className="text-[13px] font-black text-gray-800 dark:text-white group-hover:text-primary-500 transition-colors line-clamp-2">{item.titleSnapshot}</Link>
                              {item.product.warranty && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-[10px] font-bold text-gray-400">{item.product.warranty}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-black tabular-nums">{toFa(item.qty)}</span>
                        </td>
                        <td className="p-6 text-center text-sm font-black tabular-nums text-gray-500">{toFa(price)}</td>
                        <td className="p-6 text-left">
                          <span className="text-sm font-black tabular-nums text-gray-900 dark:text-white">{toFa(price * item.qty)}</span>
                          <span className="text-[9px] text-gray-400 mr-1">تومان</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-8 bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
              <div className="flex justify-end">
                <div className="space-y-2 min-w-[220px]">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">جمع اقلام:</span><span className="font-black tabular-nums">{toFa(order.itemsTotal)} تومان</span></div>
                  {Number(order.shippingFee) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">ارسال:</span><span className="font-black tabular-nums">{toFa(order.shippingFee)} تومان</span></div>}
                  {Number(order.discountTotal) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">تخفیف:</span><span className="font-black text-emerald-500 tabular-nums">-{toFa(order.discountTotal)} تومان</span></div>}
                  <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-white/10">
                    <span className="font-black text-gray-900 dark:text-white">مبلغ نهایی:</span>
                    <span className="text-lg font-black text-primary-500 tabular-nums">{toFa(order.grandTotal)} تومان</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* آدرس تحویل */}
        {order.address && (
          <div className="relative overflow-hidden bg-white/40 dark:bg-gray-950/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl" />
            <h3 className="relative text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-2 h-6 bg-primary-500 rounded-full" />
              اطلاعات تحویل
            </h3>
            <div className="space-y-3 relative z-10">
              {[
                { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label: "گیرنده", val: order.address.receiver },
                { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", label: "تماس", val: order.address.phone },
                { icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z", label: "آدرس", val: `${order.address.province}، ${order.address.city}، ${order.address.addressLine}` },
                ...(order.address.postalCode ? [{ icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", label: "کد پستی", val: order.address.postalCode }] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-white/60 dark:border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase">{item.label}</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5 leading-relaxed">{item.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
