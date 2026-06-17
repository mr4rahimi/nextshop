"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

interface HeroSlide {
  id: string; title: string | null; imageUrl: string; linkUrl: string | null;
}
interface SuggestProduct {
  id: string; title: string; slug: string;
  price: string; salePrice: string | null; mainImage: string | null;
  brand: { title: string; slug: string } | null;
  category: { title: string; slug: string } | null;
}

function fa(n: number) { return n.toLocaleString("fa-IR"); }
function price(v: string | null) { return v ? fa(Number(v)) : "۰"; }
function discount(p: string, s: string | null) {
  if (!s) return null;
  const pct = Math.round(((Number(p) - Number(s)) / Number(p)) * 100);
  return pct > 0 ? pct : null;
}

// ── کارت پیشنهاد ─────────────────────────────────────────────────────────────
function SuggestionCard({ product }: { product: SuggestProduct }) {
  const { has, toggle } = useWishlist();
  const isWished = has(product.id);
  const disc = discount(product.price, product.salePrice);

  return (
    <Link href={`/products/${product.slug}`}
      className="group/card block relative bg-gray-50 dark:bg-[#0c0c0e] p-4 rounded-[2.5rem] border border-gray-100 dark:border-white/5 transition-all duration-500 hover:border-primary-500/30 dark:hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.15)] hover:-translate-y-1">

      {disc && (
        <div className="absolute top-5 right-5 z-20">
          <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-secondary-500/30">
            {fa(disc)}٪-
          </span>
        </div>
      )}

      {/* دکمه علاقه‌مندی */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(product.id); }}
        className={`absolute top-5 left-5 z-20 w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${
          isWished
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-secondary-500"
            : "bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 text-gray-400 hover:text-secondary-500"
        }`}>
        <svg className="w-4 h-4" fill={isWished ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        {/* تصویر */}
        <div className="relative w-24 h-24 bg-white dark:bg-white/5 rounded-[2rem] flex-shrink-0 p-2 transition-transform duration-500 group-hover/card:scale-105">
          {product.mainImage
            ? <img src={product.mainImage} alt={product.title} className="w-full h-full object-contain drop-shadow-lg" />
            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>}
        </div>

        {/* اطلاعات */}
        <div className="flex-1 min-w-0">
          {product.brand && (
            <span className="text-[9px] font-black text-primary-600 bg-primary-500/10 px-2 py-0.5 rounded-lg">
              {product.brand.title}
            </span>
          )}
          <h3 className="text-[13px] font-black text-gray-800 dark:text-gray-100 leading-6 line-clamp-2 mt-1 group-hover/card:text-primary-600 transition-colors">
            {product.title}
          </h3>
          <div className="mt-2">
            {disc && (
              <span className="text-[10px] text-gray-400 line-through">{price(product.price)}</span>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">
                {price(product.salePrice ?? product.price)}
              </span>
              <span className="text-[10px] text-gray-400">تومان</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HeroSection() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestProduct[]>([]);
  const [swiperReady, setSwiperReady] = useState(false);
  const heroRef = useRef<any>(null);
  const suggRef = useRef<any>(null);
  const uid = useRef(`sugg-${Math.random().toString(36).slice(2, 6)}`);

  const defaultSlides: HeroSlide[] = [
    { id: "1", title: null, imageUrl: "/assets/images/slider/slide2-2.jpg", linkUrl: null },
    { id: "2", title: null, imageUrl: "/assets/images/slider/slide3-1.jpg", linkUrl: null },
    { id: "3", title: null, imageUrl: "/assets/images/slider/slide4.jpg", linkUrl: null },
  ];

  useEffect(() => {
    // اسلایدها
    fetch("/api/store/hero-slides").then(r => r.json()).then(setSlides).catch(() => {});
    // پیشنهادات از amazing-products
    fetch("/api/store/amazing-products?count=6").then(r => r.json()).then(setSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!swiperReady) return;
    const win = window as any;
    if (!win.Swiper) return;

    heroRef.current?.destroy?.(true, true);
    suggRef.current?.destroy?.(true, true);

    const displaySlides = slides.length > 0 ? slides : defaultSlides;

    heroRef.current = new win.Swiper(".mainHeroSwiper", {
      rtl: true,
      loop: displaySlides.length > 1,
      speed: 800,
      autoplay: { delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true },
      navigation: { nextEl: ".hero-next", prevEl: ".hero-prev" },
      pagination: {
        el: ".hero-pagination", clickable: true,
        renderBullet: (_: number, cls: string) =>
          `<span class="${cls} !bg-white !w-3 !h-3 !opacity-50 hover:!opacity-100 transition-all"></span>`,
      },
    });

    if (suggestions.length > 1) {
      suggRef.current = new win.Swiper(`.${uid.current}`, {
        rtl: true,
        slidesPerView: 1,
        spaceBetween: 16,
        loop: suggestions.length > 2,
        grabCursor: true,
        speed: 700,
        autoplay: { delay: 3500 },
        breakpoints: {
          0:    { direction: "horizontal", slidesPerView: 1 },
          640:  { direction: "horizontal", slidesPerView: 2 },
          1024: { direction: "vertical",   slidesPerView: 2, spaceBetween: 16, height: 280 },
        },
      });
    }
  }, [swiperReady, slides, suggestions]);

  const displaySlides = slides.length > 0 ? slides : defaultSlides;

  return (
    <>
      <section className="container transition-colors duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── سمت راست: پیشنهادات ── */}
          <div className="lg:col-span-4 relative bg-white dark:bg-[#0a0a0a] lg:bg-white/80 lg:dark:bg-[#0a0a0a]/60 lg:backdrop-blur-3xl rounded-[3rem] p-6 border border-gray-100 dark:border-white/5 flex flex-col shadow-sm overflow-hidden">

            {/* هدر */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
                <h2 className="text-base font-black text-gray-900 dark:text-white">پیشنهادات لحظه‌ای</h2>
              </div>
              <Link href="/products"
                className="text-[10px] font-black text-primary-600 bg-primary-500/10 hover:bg-primary-600 hover:text-white px-3 py-1.5 rounded-xl transition-all border border-primary-500/20">
                مشاهده همه
              </Link>
            </div>

            {/* اسلایدر پیشنهادات */}
            {suggestions.length === 0 ? (
              <div className="flex-1 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-28 bg-gray-100 dark:bg-white/5 rounded-[2rem] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <div className={`swiper ${uid.current}`} style={{ height: 280 }}>
                  <div className="swiper-wrapper">
                    {suggestions.map(p => (
                      <div key={p.id} className="swiper-slide">
                        <SuggestionCard product={p} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* دسترسی سریع */}
            {suggestions.length > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">دسترسی سریع</p>
                <div className="grid grid-cols-5 gap-2">
                  {suggestions.slice(0, 4).map(p => (
                    <Link key={p.id} href={`/products/${p.slug}`}
                      className="aspect-square bg-gray-50 dark:bg-white/5 rounded-2xl p-2 border border-gray-100 dark:border-white/5 hover:border-primary-500/30 transition-all group overflow-hidden">
                      {p.mainImage
                        ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-300">📦</div>}
                    </Link>
                  ))}
                  <Link href="/products"
                    className="aspect-square bg-primary-600 hover:bg-primary-700 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg shadow-primary-500/30 transition-all active:scale-95">
                    <span className="text-xs font-black">+</span>
                    <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── اسلایدر اصلی ── */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-[2.5rem] min-h-[400px]">
            <div className="swiper mainHeroSwiper h-full min-h-[400px]">
              <div className="swiper-wrapper">
                {displaySlides.map(slide => (
                  <div key={slide.id} className="swiper-slide relative">
                    {slide.linkUrl ? (
                      <Link href={slide.linkUrl}>
                        <img src={slide.imageUrl} alt={slide.title || ""}
                          className="w-full h-full object-cover min-h-[400px]" />
                      </Link>
                    ) : (
                      <img src={slide.imageUrl} alt={slide.title || ""}
                        className="w-full h-full object-cover min-h-[400px]" />
                    )}
                    {slide.title && (
                      <div className="absolute bottom-20 right-8 bg-black/50 backdrop-blur-sm text-white px-5 py-2.5 rounded-2xl">
                        <span className="font-black text-sm">{slide.title}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* کنترل‌ها */}
              <div className="absolute bottom-8 left-8 flex gap-3 z-10">
                <button className="hero-prev w-12 h-12 bg-white/20 hover:bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center text-white text-2xl transition-all border border-white/20">‹</button>
                <button className="hero-next w-12 h-12 bg-white/20 hover:bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center text-white text-2xl transition-all border border-white/20">›</button>
              </div>
              <div className="hero-pagination swiper-pagination !bottom-8 !right-8 !left-auto !w-auto z-10" />
            </div>
          </div>

        </div>
      </section>

      <Script src="/assets/js/plugin/swiper/swiper-bundle.min.js"
        strategy="afterInteractive" onReady={() => setSwiperReady(true)} />
    </>
  );
}