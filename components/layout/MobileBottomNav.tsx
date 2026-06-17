"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/store/cart/CartContext";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

// شماره تلفن از site-settings — فعلاً استاتیک، بعداً داینامیک
const STORE_PHONE = "02100000000";

export default function MobileBottomNav({ phone }: { phone?: string | null }) {
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const { ids } = useWishlist();
  const wishCount = ids.size;
  const tel = phone || STORE_PHONE;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-[80] md:hidden">
      <div className="relative bg-white/80 dark:bg-gray-950/90 backdrop-blur-2xl border border-gray-200 dark:border-gray-800 rounded-3xl px-2 py-3 shadow-2xl shadow-black/10 dark:shadow-black/40">
        <ul className="flex items-center justify-around">

          {/* خانه */}
          <li>
            <Link href="/"
              className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${isActive("/") ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}`}>
              <svg className="w-6 h-6" fill={isActive("/") ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive("/") ? 0 : 2} viewBox="0 0 24 24">
                {isActive("/")
                  ? <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                }
              </svg>
              <span className="text-[10px] font-black">خانه</span>
            </Link>
          </li>

          {/* علاقه‌مندی */}
          <li>
            <Link href="/user/wishlist"
              className={`relative flex flex-col items-center gap-1 px-3 py-1 transition-colors ${isActive("/user/wishlist") ? "text-secondary-500" : "text-gray-400 dark:text-gray-500"}`}>
              <div className="relative">
                <svg className="w-6 h-6" fill={isActive("/user/wishlist") ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {wishCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {wishCount > 9 ? "۹+" : wishCount.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black">علاقه‌مندی</span>
            </Link>
          </li>

          {/* سبد خرید — وسط بالاتر */}
          <li className="-mt-8">
            <Link href="/cart"
              className="relative flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl text-white shadow-lg shadow-primary-500/40 transition-all active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow">
                  {cartCount > 9 ? "۹+" : cartCount.toLocaleString("fa-IR")}
                </span>
              )}
            </Link>
          </li>

          {/* پشتیبانی — تماس مستقیم */}
          <li>
            <a href={`tel:${tel}`}
              className="flex flex-col items-center gap-1 px-3 py-1 text-gray-400 dark:text-gray-500 hover:text-emerald-500 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-[10px] font-black">پشتیبانی</span>
            </a>
          </li>

          {/* پروفایل */}
          <li>
            <Link href="/user"
              className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${isActive("/user") && !isActive("/user/wishlist") ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[10px] font-black">پروفایل</span>
            </Link>
          </li>

        </ul>
      </div>
    </div>
  );
}