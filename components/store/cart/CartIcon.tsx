"use client";

import Link from "next/link";
import { useCart } from "@/components/store/cart/CartContext";

export default function CartIcon() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-all">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 bg-primary-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-primary-500/40">
          {count > 99 ? "+۹۹" : count.toLocaleString("fa-IR")}
        </span>
      )}
    </Link>
  );
}