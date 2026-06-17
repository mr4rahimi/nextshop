"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

interface WishlistProduct {
  id: string; productId: string;
  product: {
    id: string; title: string; slug: string;
    price: string; salePrice: string | null;
    mainImage: string | null; ratingAvg: number; ratingCount: number;
    brand: { title: string; slug: string } | null;
    category: { title: string; slug: string } | null;
  };
}

function fa(n: number) { return n.toLocaleString("fa-IR"); }
function formatPrice(v: string | null) {
  if (!v) return "۰";
  return Number(v).toLocaleString("fa-IR");
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { toggle, has } = useWishlist();

  useEffect(() => {
    fetch("/api/user/wishlist")
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // sync با context
  useEffect(() => {
    setItems(prev => prev.filter(i => has(i.productId)));
  }, [has]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] p-6" dir="rtl">
      <div className="container max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] py-8" dir="rtl">
      <div className="container max-w-5xl mx-auto px-4">

        {/* هدر */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">علاقه‌مندی‌ها</h1>
            <p className="text-sm text-gray-500 mt-1">{fa(items.length)} محصول</p>
          </div>
          {items.length > 0 && (
            <Link href="/products"
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
              ادامه خرید
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-gray-700 dark:text-gray-300 mb-2">لیست علاقه‌مندی‌ها خالی است</h2>
            <p className="text-sm text-gray-400 mb-6">محصولات مورد علاقه‌ات رو اینجا ذخیره کن</p>
            <Link href="/products"
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all">
              مشاهده محصولات
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(item => {
              const p = item.product;
              const discount = p.salePrice && Number(p.price) > 0
                ? Math.round(((Number(p.price) - Number(p.salePrice)) / Number(p.price)) * 100)
                : null;
              const isWished = has(p.id);

              return (
                <div key={item.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden group hover:shadow-lg transition-all">
                  {/* تصویر */}
                  <div className="relative aspect-square bg-gray-50 dark:bg-gray-800">
                    <Link href={`/products/${p.slug}`}>
                      {p.mainImage
                        ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>}
                    </Link>
                    {discount && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                        {fa(discount)}٪
                      </span>
                    )}
                    {/* دکمه حذف */}
                    <button
                      onClick={() => toggle(p.id)}
                      className={`absolute top-2 left-2 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isWished
                          ? "bg-red-50 dark:bg-red-900/20 text-secondary-500"
                          : "bg-white dark:bg-gray-800 text-gray-400"
                      }`}>
                      <svg className="w-4 h-4" fill={isWished ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>

                  {/* اطلاعات */}
                  <div className="p-3">
                    {p.brand && (
                      <p className="text-[10px] font-bold text-primary-500 mb-1">{p.brand.title}</p>
                    )}
                    <Link href={`/products/${p.slug}`}>
                      <h3 className="text-xs font-black text-gray-900 dark:text-white line-clamp-2 mb-3 hover:text-primary-600 transition-colors">
                        {p.title}
                      </h3>
                    </Link>
                    <div className="flex items-end justify-between">
                      <div>
                        {discount && (
                          <p className="text-[10px] text-gray-400 line-through">{formatPrice(p.price)}</p>
                        )}
                        <p className="text-sm font-black text-gray-900 dark:text-white">
                          {formatPrice(p.salePrice ?? p.price)}
                          <span className="text-[10px] font-normal text-gray-400 mr-1">تومان</span>
                        </p>
                      </div>
                      <Link href={`/products/${p.slug}`}
                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline">
                        مشاهده →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}