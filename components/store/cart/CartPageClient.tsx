"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/store/cart/CartContext";

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

function CheckoutSteps({ current }: { current: number }) {
  const steps = [
    { label: "سبد خرید", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
    { label: "اطلاعات ارسال", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "پرداخت نهایی", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  ];
  return (
    <div className="max-w-4xl mx-auto mb-16 px-4" dir="rtl">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-white/5 -translate-y-1/2 rounded-full" />
        <div className="absolute top-1/2 right-0 h-1 bg-blue-500 -translate-y-1/2 rounded-full transition-all duration-700"
          style={{ width: current === 0 ? "0%" : current === 1 ? "50%" : "100%" }} />
        {steps.map((s, i) => (
          <div key={i} className={`relative z-10 flex flex-col items-center gap-3 ${i > current ? "opacity-50" : ""}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-4 ${i <= current ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40 border-white dark:border-[#0f172a]" : "bg-white/40 dark:bg-white/[0.02] text-gray-400 border-gray-100 dark:border-white/5"}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={s.icon} />
              </svg>
            </div>
            <span className={`text-[11px] font-black uppercase tracking-widest ${i <= current ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CartPageClient() {
  const { items, count, total, updateQty, removeItem, isLoggedIn } = useCart();
  const router = useRouter();

  const discount = items.reduce((s, i) => {
    const orig = Number(i.product.price);
    const sale = Number(i.product.salePrice ?? i.product.price);
    return s + (orig - sale) * i.qty;
  }, 0);

  // سبد خالی
  if (count === 0) {
    return (
      <section className="relative py-16 transition-colors duration-700">
        <div className="flex flex-col items-center justify-center min-h-[600px] px-6 py-12 text-center relative overflow-hidden">
          <div className="absolute -z-10 w-80 h-80 bg-blue-500/10 blur-[120px] rounded-full" />
          <div className="relative mb-10 group">
            <div className="absolute inset-0 scale-150 border border-blue-500/5 rounded-full animate-[ping_3s_linear_infinite]" />
            <div className="absolute inset-0 scale-125 border border-blue-500/10 rounded-full animate-[ping_2s_linear_infinite]" />
            <div className="relative w-44 h-44 bg-white/40 dark:bg-white/[0.03] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[3.5rem] flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-3">
              <svg className="w-20 h-20 text-blue-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <div className="absolute -top-1 -right-1 w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/40 rotate-12 animate-bounce">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
          <div className="max-w-md space-y-4">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">سبد خریدت خالیه!</h2>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed uppercase tracking-wide">
              انگار هنوز چیزی چشمت رو نگرفته. پر از تکنولوژی‌های جدیده که منتظر تست کردن تو هستن.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5 mt-12">
            <Link href="/products"
              className="w-full sm:w-auto px-12 py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-xl shadow-blue-600/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group">
              برو به فروشگاه
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          {!isLoggedIn && (
            <div className="mt-12 p-5 bg-blue-500/5 dark:bg-blue-400/5 rounded-[2rem] border border-blue-500/10 flex items-center gap-3 max-w-md">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                با ورود به حساب، محصولات قبلی در سبد نمایش داده می‌شوند.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function handleCheckout() {
    if (!isLoggedIn) {
      router.push("/auth?redirect=/cart");
      return;
    }
    router.push("/checkout");
  }

  return (
    <section className="relative py-16 transition-colors duration-700" dir="rtl">
      <CheckoutSteps current={0} />

      <div className="px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">

          {/* آیتم‌ها */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-2 h-10 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
                <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">سبد خرید شما</h1>
              </div>
              <span className="px-5 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-black uppercase tracking-widest">
                {toFa(count)} کالا
              </span>
            </div>

            <div className="space-y-6">
              {items.map(item => {
                const img = item.product.mainImage ?? item.product.images[0]?.url ?? null;
                const price = Number(item.product.salePrice ?? item.product.price);
                const origPrice = Number(item.product.price);
                const hasDiscount = item.product.salePrice && Number(item.product.salePrice) < origPrice;

                return (
                  <div key={item.productId}
                    className="group relative bg-white/40 dark:bg-white/[0.03] backdrop-blur-[30px] border border-white/40 dark:border-white/10 rounded-[2.8rem] p-6 md:p-8 transition-all duration-500 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-1">
                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">

                      {/* تصویر */}
                      <Link href={`/products/${item.product.slug}`}
                        className="relative w-40 h-40 flex-shrink-0 bg-gradient-to-br from-white to-gray-100 dark:from-white/10 dark:to-transparent rounded-[2.2rem] p-4 border border-white dark:border-white/5 shadow-inner overflow-hidden flex items-center justify-center">
                        {img
                          ? <img src={img} alt={item.product.title} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" />
                          : <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-2xl" />
                        }
                      </Link>

                      {/* اطلاعات */}
                      <div className="flex-1 space-y-3 text-center md:text-right">
                        <Link href={`/products/${item.product.slug}`}>
                          <h3 className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100 leading-8 hover:text-blue-600 transition-colors line-clamp-2">
                            {item.product.title}
                          </h3>
                        </Link>
                        {hasDiscount && (
                          <span className="inline-block text-xs font-black text-rose-500 bg-rose-500/10 px-3 py-1 rounded-xl">
                            {Math.round(((origPrice - price) / origPrice) * 100)}٪ تخفیف
                          </span>
                        )}
                      </div>

                      {/* قیمت و تعداد */}
                      <div className="flex flex-col items-center md:items-end gap-6 md:min-w-[200px] border-t md:border-t-0 md:border-r border-gray-200/50 dark:border-white/5 pt-6 md:pt-2 md:pr-8">
                        <div className="flex items-center gap-3">
                          <button onClick={() => removeItem(item.productId)}
                            className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-90">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <div className="flex items-center bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-[1.2rem] border border-gray-200/50 dark:border-white/10 shadow-inner">
                            <button onClick={() => updateQty(item.productId, item.qty + 1)}
                              className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-90 transition-all">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12M6 12h12" />
                              </svg>
                            </button>
                            <span className="w-10 text-center text-sm font-black text-gray-900 dark:text-white">{toFa(item.qty)}</span>
                            <button onClick={() => updateQty(item.productId, item.qty - 1)}
                              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/10 text-gray-400 rounded-lg border border-gray-200/60 dark:border-white/5 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 transition-all active:scale-90">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="text-center md:text-left">
                          {hasDiscount && (
                            <span className="block text-[11px] text-gray-400 line-through tabular-nums mb-1">
                              {toFa(origPrice * item.qty)} تومان
                            </span>
                          )}
                          <span className="block text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                            {toFa(price * item.qty)} <span className="text-[10px] font-bold text-gray-500">تومان</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* خلاصه فاکتور */}
          <div className="lg:col-span-1 lg:sticky lg:top-24">
            <div className="relative group max-w-sm mx-auto">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px]" />
              <div className="relative bg-white/20 dark:bg-black/20 backdrop-blur-[60px] border border-white/50 dark:border-white/5 rounded-[3.5rem] p-2 shadow-2xl overflow-hidden">

                <div className="p-8 pb-4 text-center">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">خلاصه فاکتور</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[4px] mt-1">Final Summary</p>
                </div>

                <div className="bg-white/40 dark:bg-white/[0.02] rounded-[3rem] p-8 space-y-6 border border-white/60 dark:border-white/5 shadow-inner">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">مجموع محصولات</span>
                      <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-4 mb-1" />
                      <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{toFa(total + discount)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">سود شما از خرید</span>
                        <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-4 mb-1" />
                        <span className="text-sm font-black text-rose-500 tabular-nums">-{toFa(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">هزینه ارسال</span>
                      <div className="flex-1 border-b border-dashed border-gray-300 dark:border-white/10 mx-4 mb-1" />
                      <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg">در مرحله بعد</span>
                    </div>
                  </div>

                  <div className="relative h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent" />

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[5px]">Net Payable</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums">{toFa(total)}</span>
                      <span className="text-[10px] font-bold text-gray-400">تومان</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <button onClick={handleCheckout}
                    className="group/pay relative w-full h-20 bg-blue-600 dark:bg-blue-500 rounded-[2.2rem] overflow-hidden transition-all duration-500 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_25px_50px_-12px_rgba(37,99,235,0.7)] hover:-translate-y-1 active:scale-95">
                    <div className="relative flex items-center justify-between px-8">
                      <span className="text-white font-black text-lg tracking-tight">
                        {isLoggedIn ? "تأیید و ادامه" : "ورود و ادامه"}
                      </span>
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 shadow-inner">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}