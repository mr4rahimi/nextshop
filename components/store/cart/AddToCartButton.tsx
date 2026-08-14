"use client";

import { useCart, CartProduct } from "@/components/store/cart/CartContext";

interface Props {
  product: CartProduct;
  className?: string;
  variant?: "icon" | "full";
  /**
   * اندازه‌ی حالت آیکن. "sm" برای کارت‌های فشرده (مثل ShowcaseProductCard که در
   * موبایل دوتایی کنار هم می‌نشیند) — هم دکمه‌ی + و هم شمارنده کوچک می‌شوند.
   * پیش‌فرض "md" است تا رفتار همه‌ی استفاده‌های قبلی دست‌نخورده بماند.
   */
  size?: "sm" | "md";
}

export default function AddToCartButton({ product, className, variant = "icon", size = "md" }: Props) {
  const { items, addItem, updateQty, removeItem } = useCart();
  const cartItem = items.find(i => i.productId === product.id);
  const qty = cartItem?.qty ?? 0;
  const sm = size === "sm";

  if (variant === "icon") {
    if (qty === 0) {
      const defaultCls = sm
        ? "w-9 h-9 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-primary-500/30 hover:scale-110 active:scale-90 transition-all"
        : "w-14 h-14 bg-primary-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-primary-500/30 hover:scale-110 active:scale-90 transition-all";
      return (
        <button
          onClick={e => { e.preventDefault(); addItem(product); }}
          aria-label="افزودن به سبد خرید"
          className={className ?? defaultCls}
        >
          <svg className={sm ? "w-4 h-4" : "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      );
    }
    return (
      <div className={`flex items-center bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 shadow-inner ${sm ? "p-0.5 rounded-xl" : "p-1.5 rounded-[1.2rem]"}`}>
        <button onClick={e => { e.preventDefault(); updateQty(product.id, qty + 1); }}
          aria-label="افزایش تعداد"
          className={`flex items-center justify-center bg-primary-600 text-white rounded-lg shadow-lg shadow-primary-500/30 hover:scale-105 active:scale-90 transition-all ${sm ? "w-7 h-7" : "w-9 h-9"}`}>
          <svg className={sm ? "w-4 h-4" : "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12M6 12h12" />
          </svg>
        </button>
        <span className={`text-center font-black text-gray-900 dark:text-white ${sm ? "w-6 text-xs" : "w-10 text-sm"}`}>
          {qty.toLocaleString("fa-IR")}
        </span>
        <button onClick={e => { e.preventDefault(); qty === 1 ? removeItem(product.id) : updateQty(product.id, qty - 1); }}
          aria-label={qty === 1 ? "حذف از سبد خرید" : "کاهش تعداد"}
          className={`flex items-center justify-center bg-white dark:bg-white/10 text-gray-400 rounded-lg border border-gray-200/60 dark:border-white/5 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 transition-all active:scale-90 ${sm ? "w-7 h-7" : "w-9 h-9"}`}>
          <svg className={sm ? "w-4 h-4" : "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
          </svg>
        </button>
      </div>
    );
  }

  if (qty === 0) {
    return (
      <button
        onClick={() => addItem(product)}
        className={className ?? "w-full h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 active:scale-95"}
      >
        <span>افزودن به سبد خرید</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-full h-14 flex items-center justify-between bg-primary-50 dark:bg-primary-500/10 border-2 border-primary-500/30 rounded-2xl px-4">
      <button onClick={() => updateQty(product.id, qty + 1)}
        className="w-10 h-10 flex items-center justify-center bg-primary-600 text-white rounded-xl shadow-lg shadow-primary-500/30 hover:scale-105 active:scale-90 transition-all">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12M6 12h12" />
        </svg>
      </button>
      <div className="flex flex-col items-center">
        <span className="text-lg font-black text-primary-600">{qty.toLocaleString("fa-IR")} عدد در سبد</span>
        <span className="text-[10px] text-primary-400 font-bold">در سبد خرید شما</span>
      </div>
      <button onClick={() => qty === 1 ? removeItem(product.id) : updateQty(product.id, qty - 1)}
        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-white/10 text-gray-400 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
        </svg>
      </button>
    </div>
  );
}
