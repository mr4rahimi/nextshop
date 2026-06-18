"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  order: {
    id: string;
    orderNumber: string;
    grandTotal: string;
    status: string;
  };
  cardInfo: {
    cardNumber: string | null;
    cardHolder: string | null;
    cardBank: string | null;
    cardReceiptInfo: string | null;
  };
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

export default function CheckoutPendingClient({ order, cardInfo }: Props) {
  const [copied, setCopied] = useState(false);

  function copyCard() {
    if (cardInfo.cardNumber) {
      navigator.clipboard.writeText(cardInfo.cardNumber.replace(/-/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="relative py-16 min-h-screen transition-colors duration-700" dir="rtl">
      <div className="max-w-2xl mx-auto px-4">

        {}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="relative mb-8">
            <div className="absolute inset-0 scale-150 border border-amber-500/10 rounded-full animate-[ping_2s_linear_infinite]" />
            <div className="absolute inset-0 scale-125 border border-amber-500/20 rounded-full animate-[ping_3s_linear_infinite]" />
            <div className="relative w-32 h-32 bg-white/40 dark:bg-white/[0.03] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[3rem] flex items-center justify-center shadow-2xl">
              <svg className="w-16 h-16 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
            در انتظار تأیید پرداخت
          </h1>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
            سفارش شما با موفقیت ثبت شد. لطفاً مبلغ زیر را به کارت بانکی واریز کرده و رسید را ارسال کنید.
          </p>
          <div className="mt-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <p className="text-xs font-black text-amber-600 dark:text-amber-400">شماره سفارش: #{order.orderNumber}</p>
          </div>
        </div>

        <div className="space-y-6">

          {}
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-[2.5rem] p-8 text-center text-white shadow-2xl shadow-primary-500/30">
            <p className="text-sm font-black text-primary-100/80 uppercase tracking-widest mb-2">مبلغ قابل پرداخت</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-5xl font-black tracking-tighter tabular-nums">{toFa(order.grandTotal)}</span>
              <span className="text-sm font-bold text-primary-200">تومان</span>
            </div>
          </div>

          {}
          {cardInfo.cardNumber && (
            <div className="bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 space-y-5">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">اطلاعات کارت بانکی</h3>

              <div className="space-y-4">
                {}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">شماره کارت</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-[0.3em] tabular-nums" dir="ltr">
                      {cardInfo.cardNumber}
                    </p>
                  </div>
                  <button onClick={copyCard}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${copied ? "bg-emerald-500 text-white" : "bg-primary-50 dark:bg-primary-900/20 text-primary-600 hover:bg-primary-100"}`}>
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        کپی شد
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        کپی کارت
                      </>
                    )}
                  </button>
                </div>

                {}
                <div className="grid grid-cols-2 gap-4">
                  {cardInfo.cardHolder && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">نام صاحب کارت</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{cardInfo.cardHolder}</p>
                    </div>
                  )}
                  {cardInfo.cardBank && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">بانک</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{cardInfo.cardBank}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {}
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-[2.5rem] p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-black text-amber-800 dark:text-amber-300">مراحل بعدی</h3>
            </div>

            <ul className="space-y-3">
              {[
                "مبلغ فوق را به کارت بانکی اعلام‌شده واریز کنید",
                cardInfo.cardReceiptInfo ?? "تصویر رسید پرداخت را ارسال کنید",
                "پس از بررسی رسید (کمتر از ۲ ساعت)، سفارش شما تأیید خواهد شد",
                "پیامک تأیید سفارش برای شما ارسال می‌شود",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300 leading-relaxed">{step}</p>
                </li>
              ))}
            </ul>
          </div>

          {}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/user/orders"
              className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-sm text-center shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all hover:scale-[1.01] active:scale-95">
              مشاهده سفارش‌هایم
            </Link>
            <Link href="/products"
              className="flex-1 py-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-2xl font-black text-sm text-center hover:bg-white dark:hover:bg-white/10 transition-all">
              ادامه خرید
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
