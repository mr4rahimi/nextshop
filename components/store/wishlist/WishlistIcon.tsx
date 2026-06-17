"use client";

import Link from "next/link";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

export default function WishlistIcon() {
  const { ids } = useWishlist();
  const count = ids.size;

  return (
    <Link href="/user/wishlist"
      className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-secondary-500 transition-all">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-secondary-500/40">
          {count > 99 ? "+۹۹" : count.toLocaleString("fa-IR")}
        </span>
      )}
    </Link>
  );
}