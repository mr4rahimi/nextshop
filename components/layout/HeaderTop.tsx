"use client";

import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import CartIcon from "@/components/store/cart/CartIcon";
import SearchBox from "@/components/store/SearchBox";
import WishlistIcon from "@/components/store/wishlist/WishlistIcon";

export default function HeaderTop({ logoUrl, siteName }: { logoUrl: string; siteName: string }) {
  const { theme, toggle } = useTheme();

  return (
    <>
      {/* TOP BANNER 
      <div className="bg-primary-900 text-white py-1.5 text-center text-[11px] font-medium tracking-wide hidden md:block">
        🎉 جشنواره زمستانی: تا ۵۰٪ تخفیف | کد:
        <span className="text-secondary-400 mr-1">WINTER2025</span>
      </div> */}

      <div className="container">
        <div className="flex items-center justify-between h-20 gap-8">

           {/* RIGHT: menu + logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.dispatchEvent(new Event("toggle-mobile-menu"))}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="منو"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
 
            <Link href="/" className="flex items-center gap-2">
              <img src={logoUrl} className="w-28 h-auto" alt={siteName} />
            </Link>
          </div>

          {/* CENTER: search */}
          <div className="hidden md:flex flex-1 max-w-4xl relative mx-auto">
            <SearchBox />
          </div>
          {/* LEFT: dark mode + login + cart */}
          <div className="flex items-center gap-3">
            

            {/* DARK MODE TOGGLE */}
            <button
              onClick={toggle}
              aria-label="تغییر حالت نمایش"
              className="p-2.5 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md hover:border-primary-500/50 hover:bg-white/80 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-all duration-300 shadow-sm"
            >
              {/* Sun icon - نمایش در dark mode */}
              <svg
                className="w-5 h-5 hidden dark:block"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
              {/* Moon icon - نمایش در light mode */}
              <svg
                className="w-5 h-5 block dark:hidden"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>

            {/* LOGIN */}
            <Link href="/user" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md hover:border-primary-500/50 hover:bg-primary-50/50 dark:hover:bg-primary-500/10 transition-all duration-300 shadow-sm">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-black text-gray-700 dark:text-gray-200 hidden lg:block uppercase tracking-tighter">
                حساب کاربری
              </span>
            </Link>

            {/* WISHLIST */}
            <div className="hidden md:block">
              <WishlistIcon />
            </div>

            {/* SEARCH MOBILE */}
            <Link href="/search"
              className="md:hidden p-2.5 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5} />
              </svg>
            </Link>

            {/* CART */}
            <CartIcon />

          </div>
        </div>
      </div>
    </>
  );
}