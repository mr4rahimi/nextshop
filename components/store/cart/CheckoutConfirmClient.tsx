"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

interface OrderItem {
  qty: number;
  unitPrice: string;
  unitSalePrice: string | null;
  titleSnapshot: string;
  product: { id: string; title: string; mainImage: string | null; images: { url: string }[] };
}

interface Order {
  id: string;
  orderNumber: string;
  grandTotal: string;
  shippingFee: string;
  itemsTotal: string;
  discountTotal: string;
  address: {
    receiver: string;
    phone: string;
    province: string;
    city: string;
    addressLine: string;
  } | null;
  items: OrderItem[];
}

interface CardInfo {
  cardNumber: string | null;
  cardHolder: string | null;
  cardBank: string | null;
  cardReceiptInfo: string | null;
}

interface Props {
  order: Order;
  paymentMethod: "online" | "card" | "wallet";
  cardInfo: CardInfo;
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

function CheckoutSteps() {
  return (
    <div className="max-w-4xl mx-auto mb-16 px-4" dir="rtl">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-primary-500 -translate-y-1/2 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
        {[
          { label: "تکمیل شد", done: true },
          { label: "تکمیل شد", done: true },
          { label: "پرداخت نهایی", done: false },
        ].map((s, i) => (
          <div key={i} className="relative z-10 flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-4 border-white dark:border-[#0f172a] shadow-lg ${s.done ? "bg-emerald-500 text-white" : "bg-primary-500 text-white shadow-xl shadow-primary-500/40"}`}>
              {s.done ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )}
            </div>
            <span className={`text-[11px] font-black uppercase tracking-widest ${s.done ? "text-emerald-500" : "text-primary-600 dark:text-primary-400"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CheckoutConfirmClient({ order, paymentMethod, cardInfo }: Props) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (paymentMethod === "wallet") {
      router.push(`/checkout/success/${order.id}`);
    }
  }, [paymentMethod, order.id]);

  async function handlePay() {
    if (paymentMethod === "wallet") {
      router.push(`/checkout/success/${order.id}`);
      return;
    }
    setPaying(true);
    if (paymentMethod === "online") {
      router.push(`/checkout/payment/${order.id}`);
    } else {
      router.push(`/checkout/pending/${order.id}`);
    }
  }

  const addressText = order.address
    ? `${order.address.province}، ${order.address.city}، ${order.address.addressLine}`
    : "—";

  return (
    <section className="relative py-16 transition-colors duration-700" dir="rtl">
      <CheckoutSteps />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-xl">

          {}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">

              {}
              <div className="flex items-start gap-4 p-4 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">ارسال به آدرس:</span>
                  <p className="text-xs font-black text-gray-700 dark:text-gray-300 leading-relaxed mt-1 line-clamp-2">{addressText}</p>
                  {order.address && (
                    <p className="text-[10px] text-gray-400 mt-1">{order.address.receiver} — {order.address.phone}</p>
                  )}
                </div>
              </div>

              {}
              <div className="flex items-start gap-4 p-4 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">روش پرداخت:</span>
                  <p className="text-xs font-black text-gray-700 dark:text-gray-300 mt-1">
                    {paymentMethod === "online" ? "درگاه پرداخت آنلاین" : paymentMethod === "wallet" ? "کیف پول" : "کارت به کارت"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">شماره سفارش: #{order.orderNumber}</p>
                </div>
              </div>
            </div>

            {}
            <div className="lg:col-span-1">
              <button onClick={handlePay} disabled={paying}
                className="group/pay relative w-full h-20 bg-primary-600 dark:bg-primary-500 rounded-[2.2rem] overflow-hidden transition-all duration-500 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] hover:shadow-[0_25px_50px_-12px_rgba(37,99,235,0.6)] hover:-translate-y-1 active:scale-95 disabled:opacity-60">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/pay:animate-[shimmer_1.5s_infinite]" />
                <div className="relative flex items-center justify-between px-6">
                  <div className="text-right">
                    <span className="block text-[10px] font-black text-primary-100/70 uppercase">
                      {paymentMethod === "wallet" ? "سفارش پرداخت شد" : paymentMethod === "online" ? "تأیید و اتصال به درگاه" : "تأیید کارت به کارت"}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-white tracking-tighter tabular-nums">
                        {paymentMethod === "wallet" ? "از کیف پول" : toFa(order.grandTotal)}
                      </span>
                      {paymentMethod !== "wallet" && <span className="text-[9px] font-bold text-primary-100">تومان</span>}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner transition-all duration-500 group-hover/pay:rotate-[360deg]">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-gray-700 dark:text-gray-300">اقلام سفارش ({toFa(order.items.length)} قلم)</h4>
              <div className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                جمع: {toFa(order.grandTotal)} تومان
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {order.items.slice(0, 5).map((item, i) => {
                const img = item.product.mainImage ?? item.product.images[0]?.url ?? null;
                return (
                  <div key={i} className="relative flex items-center gap-3 bg-white/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100 dark:border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {img ? <img src={img} alt={item.titleSnapshot} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-gray-100 dark:bg-gray-700" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-800 dark:text-gray-200 line-clamp-1">{item.titleSnapshot}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{toFa(item.qty)} عدد</p>
                    </div>
                  </div>
                );
              })}
              {order.items.length > 5 && (
                <div className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 text-xs font-black text-gray-400">
                  +{toFa(order.items.length - 5)}
                </div>
              )}
            </div>
          </div>

          {}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-all">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px] font-bold text-gray-400">پرداخت امن و تضمین شده</span>
            </div>
            <p className="text-[9px] text-gray-400 font-bold leading-relaxed max-w-md text-center">
              با کلیک بر روی دکمه پرداخت، <Link href="#" className="text-primary-500 hover:underline">شرایط و قوانین</Link> فروشگاه را پذیرفته‌اید.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
