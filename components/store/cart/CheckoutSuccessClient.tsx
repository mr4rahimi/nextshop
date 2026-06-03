"use client";

import Link from "next/link";

interface Props {
  order: {
    id: string;
    orderNumber: string;
    grandTotal: string;
    createdAt: string;
    payments: { providerRef: string | null }[];
  };
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fa-IR"); }

export default function CheckoutSuccessClient({ order }: Props) {
  const ref = order.payments[0]?.providerRef;

  return (
    <section className="relative overflow-hidden py-16 transition-colors duration-700" dir="rtl">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="relative bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[3.5rem] p-8 md:p-12 shadow-2xl overflow-hidden">

          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />

          <div className="relative flex flex-col items-center text-center">

            {/* آیکون موفق */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] border-4 border-white dark:border-gray-900">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">پرداخت با موفقیت انجام شد!</h2>
            <p className="text-gray-500 dark:text-gray-400 font-bold text-sm mb-10 uppercase tracking-widest">Order Confirmed Successfully</p>

            {/* اطلاعات سفارش */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <div className="p-6 bg-white/60 dark:bg-white/5 rounded-[2.5rem] border border-white/60 dark:border-white/10">
                <span className="block text-[10px] font-black text-gray-400 mb-2">شماره سفارش</span>
                <span className="block text-lg font-black text-blue-600 tracking-widest">#{order.orderNumber}</span>
              </div>
              <div className="p-6 bg-white/60 dark:bg-white/5 rounded-[2.5rem] border border-white/60 dark:border-white/10">
                <span className="block text-[10px] font-black text-gray-400 mb-2">تاریخ ثبت</span>
                <span className="block text-lg font-black text-gray-800 dark:text-white">{formatDate(order.createdAt)}</span>
              </div>
              <div className="p-6 bg-white/60 dark:bg-white/5 rounded-[2.5rem] border border-white/60 dark:border-white/10">
                <span className="block text-[10px] font-black text-gray-400 mb-2">مبلغ پرداختی</span>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-lg font-black text-emerald-600 tabular-nums">{toFa(order.grandTotal)}</span>
                  <span className="text-[10px] font-bold text-gray-400">تومان</span>
                </div>
              </div>
            </div>

            {/* باکس وضعیت */}
            <div className="w-full bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] p-6 mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-black text-emerald-700 dark:text-emerald-400">آماده‌سازی برای ارسال</span>
                  <p className="text-[10px] font-bold text-emerald-600/70">سفارش شما در حال آماده‌سازی است و به‌زودی ارسال خواهد شد.</p>
                </div>
              </div>
              <Link href={`/user/orders/${order.id}`}
                className="text-xs font-black text-emerald-600 hover:text-emerald-700 underline underline-offset-8 whitespace-nowrap">
                مشاهده جزئیات سفارش
              </Link>
            </div>

            {ref && (
              <p className="text-[11px] text-gray-400 font-bold mb-6">کد پیگیری پرداخت: <span className="text-gray-600 dark:text-gray-300 font-black">{ref}</span></p>
            )}

            {/* دکمه‌ها */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/user/orders"
                className="px-10 h-16 bg-blue-600 text-white font-black rounded-3xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center">
                پیگیری سفارش
              </Link>
              <Link href="/products"
                className="px-10 h-16 bg-white dark:bg-white/5 text-gray-700 dark:text-white font-black rounded-3xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center">
                بازگشت به فروشگاه
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}