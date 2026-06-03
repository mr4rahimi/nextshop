"use client";
import AddToCartButton from "@/components/store/cart/AddToCartButton";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  brand: { title: string; slug: string } | null;
  image: string | null;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
}

interface Props {
  categoryId?: string;
  categoryTitle?: string;
  categorySlug?: string;
  count?: number;
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

// ─── Product Slide ────────────────────────────────────────────────────────────
function ProductSlide({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.salePrice);
  const isOutOfStock = product.trackStock && (product.stock ?? 0) <= 0;
  const displayPrice = product.salePrice || product.price;
  const { has, toggle } = useWishlist();
  const isWished = has(product.id);

  return (
    <div className="swiper-slide h-auto p-4">
      <div className="group relative h-full pt-12">
        <div className={`absolute inset-0 backdrop-blur-[20px] rounded-[3rem] border shadow-[0_20px_50px_rgba(0,0,0,0.02)] transition-all duration-700 ${
          isOutOfStock
            ? "bg-gray-100/80 dark:bg-[#0a0a0a]/60 border-gray-200 dark:border-white/[0.04] opacity-70"
            : "bg-white/80 dark:bg-[#0a0a0a]/40 border-gray-100 dark:border-white/[0.08] group-hover:border-blue-500/50 dark:group-hover:shadow-[0_0_60px_rgba(37,99,235,0.12)]"
        }`} />

        {discount && (
          <div className="absolute -top-6 -right-2 z-20">
            <div className="bg-red-500 text-white text-[12px] font-black w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-red-500/40 rotate-12 group-hover:rotate-0 transition-all duration-500 border-2 border-white dark:border-white/20">
              {discount}٪
            </div>
          </div>
        )}

        <Link href={`/products/${product.slug}`} className="relative p-7 flex flex-col h-full z-10 transition-transform duration-500 group-hover:-translate-y-4">

          {/* Image */}
          <div className="relative mb-8 flex items-center justify-center min-h-[180px]">
            <div className="absolute w-40 h-40 bg-blue-500/20 dark:bg-indigo-500/20 blur-[70px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-1000" />

            {product.image ? (
              <img src={product.image} alt={product.title}
                className="relative z-10 w-full h-44 object-contain transition-all duration-700 group-hover:scale-110 group-hover:drop-shadow-[0_15px_35px_rgba(37,99,235,0.3)]" />
            ) : (
              <div className="relative z-10 w-full h-44 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl">
                <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            {/* Action buttons */}
            <div className="absolute top-0 -left-2 z-20 flex flex-col gap-3 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500">
              <div className="relative group/tooltip">
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(product.id); }}
                  className="w-10 h-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-sm border border-white dark:border-white/10 transition-all hover:scale-110">
                  <svg className="w-5 h-5" fill={isWished ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"
                    style={{ color: isWished ? "#ef4444" : undefined }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <span className="product-tooltip">علاقه‌مندی</span>
              </div>
            </div>
          </div>

          {/* Brand */}
          {product.brand && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-600/10 px-2 py-0.5 rounded-lg w-fit mb-2">
              {product.brand.title}
            </span>
          )}

          {/* Title */}
          <h3 className="text-[15px] font-black text-gray-800 dark:text-zinc-100 mb-6 line-clamp-2 leading-7 h-14 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {product.title}
          </h3>

          {/* Price + Cart */}

          <div className="flex items-center justify-between mt-auto pt-5 border-t border-gray-100 dark:border-white/5">
            {isOutOfStock ? (
              <div className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-white/5 rounded-xl text-gray-400 font-black text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                ناموجود
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  {discount && (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 line-through tabular-nums leading-none">
                      {formatPrice(product.price)}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums">
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold">تومان</span>
                  </div>
                </div>
                <AddToCartButton
                  variant="icon"
                  product={{
                    id: product.id, title: product.title, slug: product.slug,
                    price: product.price, salePrice: product.salePrice,
                    mainImage: product.image, images: [],
                  }}
                />
              </>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProductsByCategorySection({
  categoryId,
  categoryTitle = "محصولات",
  categorySlug,
  count = 8,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiperReady, setSwiperReady] = useState(false);
  const swiperRef = useRef<any>(null);
  // unique class برای هر instance (چون ممکنه چند ویجت داشته باشیم)
  const uid = useRef(`pbc-${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    if (!categoryId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/store/products-by-category?categoryId=${categoryId}&count=${count}`)
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [categoryId, count]);

  // init swiper
  useEffect(() => {
    if (!swiperReady || loading || products.length === 0) return;

    const win = window as any;
    if (!win.Swiper) return;

    const tryInit = () => {
      const el = document.querySelector(`.${uid.current}`);
      if (!el) return false;

      swiperRef.current?.destroy?.(true, true);
      swiperRef.current = new win.Swiper(`.${uid.current}`, {
        rtl: true,
        slidesPerView: 1.3,
        spaceBetween: 20,
        speed: 600,
        navigation: {
          nextEl: `.${uid.current}-next`,
          prevEl: `.${uid.current}-prev`,
        },
        breakpoints: {
          640:  { slidesPerView: 2.2 },
          1024: { slidesPerView: 3.5 },
          1280: { slidesPerView: 4.5 },
        },
      });
      return true;
    };

    if (!tryInit()) {
      const interval = setInterval(() => { if (tryInit()) clearInterval(interval); }, 100);
      return () => clearInterval(interval);
    }

    return () => { swiperRef.current?.destroy?.(true, true); };
  }, [swiperReady, loading, products]);

  if (!loading && products.length === 0) return null;

  return (
    <>
      <section className="best-sellers-glass relative overflow-hidden transition-colors duration-700">
        <div className="container pb-7 relative z-10">

          {/* Header */}
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center gap-6">
              {/* Icon */}
              <div className="relative w-16 h-16 bg-white dark:bg-black border border-gray-100 dark:border-blue-500/40 rounded-[1.8rem] flex items-center justify-center text-blue-600 shadow-2xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {categoryTitle}
                </h2>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                  <span className="w-8 h-[2px] bg-blue-500/30" />
                  {loading ? "در حال بارگذاری..." : `${products.length} محصول`}
                </p>
              </div>
            </div>

            {categorySlug && (
              <Link
                href={`/categories/${categorySlug}`}
                className="group/link relative overflow-hidden px-8 py-3.5 rounded-2xl transition-all duration-500 flex items-center gap-3 bg-white/40 backdrop-blur-md border border-gray-200 text-gray-800 hover:border-blue-500/50 hover:text-white dark:bg-white/[0.03] dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
              >
                <span className="absolute inset-0 bg-blue-600 translate-y-full group-hover/link:translate-y-0 transition-transform duration-500 ease-out" />
                <span className="relative z-10 text-[13px] font-black tracking-tight">مشاهده همه محصولات</span>
                <div className="relative z-10 w-5 h-5 flex items-center justify-center bg-blue-600/10 dark:bg-white/5 rounded-lg group-hover/link:bg-white/20 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </Link>
            )}
          </div>

          {/* Swiper */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-80 bg-white/60 dark:bg-white/5 rounded-[3rem] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className={`swiper ${uid.current} !overflow-visible`}>
              <div className="swiper-wrapper">
                {products.map(p => <ProductSlide key={p.id} product={p} />)}
              </div>
            </div>
          )}

          {/* Navigation */}
          {!loading && products.length > 0 && (
            <div className="flex justify-center gap-4 mt-10">
              <button className={`${uid.current}-prev w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/5 dark:text-white border border-white dark:border-white/10 flex items-center justify-center cursor-pointer hover:bg-blue-600 hover:text-white transition-all shadow-lg group`}>
                <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth={2.5} d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className={`${uid.current}-next w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/5 dark:text-white border border-white dark:border-white/10 flex items-center justify-center cursor-pointer hover:bg-blue-600 hover:text-white transition-all shadow-lg group`}>
                <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth={2.5} d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

        </div>
      </section>

      <Script
        src="/assets/js/plugin/swiper/swiper-bundle.min.js"
        strategy="afterInteractive"
        onReady={() => setSwiperReady(true)}
      />
    </>
  );
}