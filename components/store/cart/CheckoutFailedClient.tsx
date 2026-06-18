"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  order: {
    id: string;
    orderNumber: string;
    grandTotal: string;
    createdAt: string;
  };
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fa-IR")} — ${d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function CheckoutFailedClient({ order }: Props) {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden py-16 transition-colors duration-700" dir="rtl">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="relative bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[3.5rem] p-8 md:p-12 shadow-2xl overflow-hidden">

          <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px]" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]" />

          <div className="relative flex flex-col items-center text-center">

            {}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.4)] border-4 border-white dark:border-gray-900">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">متأسفانه پرداخت انجام نشد!</h2>
            <p className="text-rose-500 font-bold text-sm mb-10 uppercase tracking-widest">Transaction Failed or Cancelled</p>

            {}
            <div className="w-full bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-[2.5rem] p-6 mb-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-black text-rose-700 dark:text-rose-400">علت احتمالی خطا:</span>
                <p className="text-sm font-bold text-gray-600 dark:text-gray-400 leading-relaxed">
                  موجودی حساب کافی نیست یا تراکنش توسط بانک مبدأ متوقف شده است. مبلغی از حساب شما کسر نشده است.
                </p>
              </div>
            </div>

            {}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
              <div className="p-5 bg-white/60 dark:bg-white/5 rounded-3xl border border-white/60 dark:border-white/10">
                <span className="block text-[10px] font-black text-gray-400 mb-1">شماره سفارش</span>
                <span className="block text-sm font-black text-gray-800 dark:text-white tracking-widest">#{order.orderNumber}</span>
              </div>
              <div className="p-5 bg-white/60 dark:bg-white/5 rounded-3xl border border-white/60 dark:border-white/10">
                <span className="block text-[10px] font-black text-gray-400 mb-1">زمان وقوع خطا</span>
                <span className="block text-sm font-black text-gray-800 dark:text-white">{formatDate(order.createdAt)}</span>
              </div>
            </div>

            {}
            <div className="flex items-center gap-2 mb-10 text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-bold">اگر مبلغی کسر شده، حداکثر تا ۷۲ ساعت آینده به حساب شما بازمی‌گردد.</span>
            </div>

            {}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button
                onClick={() => router.push(`/checkout/payment/${order.id}`)}
                className="px-10 h-16 bg-rose-500 text-white font-black rounded-3xl shadow-xl shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                تلاش مجدد برای پرداخت
              </button>
              <button
                onClick={() => router.push(`/checkout/confirm/${order.id}`)}
                className="px-10 h-16 bg-white dark:bg-white/5 text-gray-700 dark:text-white font-black rounded-3xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center">
                تغییر روش پرداخت
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
