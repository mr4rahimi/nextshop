"use client";
import AddToCartButton from "@/components/store/cart/AddToCartButton";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  shortDescription: string | null;
  ratingAvg: number;
  ratingCount: number;
  brand: { title: string; slug: string } | null;
  category: { id: string; title: string; slug: string } | null;
  image: string | null;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
}

interface Props {
  categoryIds?: string[];
  perCategory?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(val: string | null | undefined): string {
  if (!val) return "۰";
  const n = Number(val);
  return isNaN(n) ? "۰" : n.toLocaleString("fa-IR");
}

function discountPercent(price: string, salePrice: string | null): number | null {
  if (!salePrice) return null;
  const p = Number(price), s = Number(salePrice);
  if (!p) return null;
  const d = Math.round(((p - s) / p) * 100);
  return d > 0 ? d : null;
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function NewestProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.salePrice);
  const displayPrice = product.salePrice || product.price;
  const isOutOfStock = product.trackStock && (product.stock ?? 0) <= 0;

  return (
    <div className={`product-card group relative backdrop-blur-2xl rounded-[2.5rem] border p-2 transition-all duration-500 ${
      isOutOfStock
        ? "bg-gray-100/70 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 opacity-70"
        : "bg-white/70 dark:bg-white/[0.03] border-gray-200 dark:border-white/10 hover:shadow-2xl hover:shadow-primary-600/20 hover:-translate-y-2"
    }`}>
      <div className="flex h-[220px]">

        {/* Image side */}
        <div className="w-2/5 relative bg-gradient-to-br from-gray-100 to-transparent dark:from-white/5 dark:to-transparent rounded-[2rem] overflow-hidden flex items-center justify-center m-1 transition-all duration-500 group-hover:scale-[0.98]">
          {product.image ? (
            <img src={product.image} alt={product.title}
              className="w-32 h-32 object-contain drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-3" />
          ) : (
            <div className="w-32 h-32 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Badge */}
          {isOutOfStock ? (
            <div className="absolute top-3 right-3 bg-gray-400 text-white text-[10px] font-black px-2.5 py-1 rounded-lg">
              ناموجود
            </div>
          ) : discount ? (
            <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-secondary-500/40">
              {discount}٪-
            </div>
          ) : (
            <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg">
              جدید
            </div>
          )}
        </div>

        {/* Content side */}
        <div className="w-3/5 p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 tracking-tighter opacity-80 mb-1 block">
              {product.brand?.title ?? product.category?.title ?? ""}
            </span>
            <h3 className="font-black text-gray-900 dark:text-white text-base leading-tight mb-2 line-clamp-2">
              {product.title}
            </h3>
            {product.shortDescription && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium line-clamp-2 leading-relaxed">
                {product.shortDescription}
              </p>
            )}
          </div>

          <div className="mt-auto">
            {isOutOfStock ? (
              <div className="w-full py-3 bg-gray-100 dark:bg-white/5 text-gray-400 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 cursor-not-allowed">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                ناموجود
              </div>
            ) : (
              <>
                <div className="mb-3 text-left">
                  {discount && (
                    <p className="text-[10px] text-gray-400 line-through mb-0.5">{formatPrice(product.price)}</p>
                  )}
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">تومان</span>
                  </div>
                </div>
                <Link href={`/products/${product.slug}`}
                  className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-[11px] font-black shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center gap-2 group/btn">
                  <span>خرید سریع</span>
                  <svg className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewestProductsSection({ categoryIds = [], perCategory = 3 }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    if (categoryIds.length === 0) { setLoading(false); return; }

    setLoading(true);
    fetch(`/api/store/newest-products?categoryIds=${categoryIds.join(",")}&perCategory=${perCategory}`)
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [categoryIds.join(","), perCategory]);

  if (!loading && products.length === 0) return null;

  // ساخت تب‌ها از دسته‌بندی‌های منحصربه‌فرد
  const uniqueCategories = Array.from(
    new Map(
      products
        .filter(p => p.category)
        .map(p => [p.category!.id, p.category!])
    ).values()
  );

  const filtered = activeFilter === "all"
    ? products
    : products.filter(p => p.category?.id === activeFilter);

  return (
    <section className="relative transition-colors duration-500 overflow-hidden">
      <div className="container mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6 border-r-4 border-primary-600 pr-6">
          <div>
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white">
              جدیدترین <span className="text-primary-600">محصولات</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-bold text-sm">
              برترین تکنولوژی‌های روز دنیا در دستان شما
            </p>
          </div>

          {/* Filter tabs */}
          {!loading && uniqueCategories.length > 1 && (
            <div className="flex items-center gap-2 p-1.5 bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white dark:border-white/10 shadow-sm overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all duration-300 whitespace-nowrap ${
                  activeFilter === "all"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                    : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/10"
                }`}
              >
                همه
              </button>
              {uniqueCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveFilter(cat.id)}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all duration-300 whitespace-nowrap ${
                    activeFilter === cat.id
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                      : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/10"
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid pb-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[220px] bg-white/60 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid pb-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filtered.map(p => (
              <NewestProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Link to all */}
        <div className="flex justify-center mt-4 mb-8">
          <Link
            href="/products"
            className="group/link relative overflow-hidden px-8 py-3.5 rounded-2xl transition-all duration-500 flex items-center gap-3 bg-white/40 dark:bg-white/[0.03] backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-300 hover:text-white"
          >
            <span className="absolute inset-0 bg-primary-600 translate-y-full group-hover/link:translate-y-0 transition-transform duration-500 ease-out" />
            <span className="relative z-10 text-[13px] font-black tracking-tight">مشاهده همه محصولات</span>
            <div className="relative z-10 w-5 h-5 flex items-center justify-center bg-primary-600/10 dark:bg-white/5 rounded-lg group-hover/link:bg-white/20 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        </div>

      </div>
    </section>
  );
}