"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import ShowcaseProductCard, { type ShowcaseProductItem } from "@/components/store/product/ShowcaseProductCard";

/**
 * ویجت «نمایش محصولات (کارت جدید)» — جایگزین مدرن دو ویجت «محصولات بر اساس دسته»
 * و «محصولات بر اساس برند» در یک ویجت واحد.
 *
 * منبع محصولات با `source` انتخاب می‌شود (دسته یا برند) و بقیه‌ی حالت‌ها دقیقاً
 * مثل دو ویجت قبلی است: جدیدترین / پرفروش‌ترین / انتخاب دستی.
 *
 * تفاوت اصلی در رابط کاربری است:
 *  - از ShowcaseProductCard استفاده می‌کند که در موبایل دوتایی جا می‌شود
 *  - در موبایل ۲ کارت کامل + بخشی از کارت سوم دیده می‌شود تا معلوم باشد ادامه دارد
 *  - لینک «مشاهده همه» و فلش‌ها بالا سمت چپ کنار هم قرار می‌گیرند
 *  - اسلاید خودکار با زمان‌بندی قابل تنظیم از ادمین
 */

export interface ProductShowcaseConfig {
  source: "category" | "brand";
  categoryId?: string;
  categoryTitle?: string;
  categorySlug?: string;
  brandId?: string;
  brandTitle?: string;
  brandSlug?: string;
  count?: number;
  sortMode?: string;
  productIds?: string[];
  /** عنوان جایگزین — اگر خالی باشد نام دسته/برند استفاده می‌شود */
  heading?: string;
  showBrandBadge?: boolean;
  showArrows?: boolean;
  autoplay?: boolean;
  /** فاصله‌ی بین اسلایدها بر حسب میلی‌ثانیه */
  autoplayDelay?: number;
}

export const SHOWCASE_DEFAULT: Required<Pick<
  ProductShowcaseConfig,
  "source" | "count" | "sortMode" | "showBrandBadge" | "showArrows" | "autoplay" | "autoplayDelay"
>> = {
  source: "category",
  count: 12,
  sortMode: "newest",
  showBrandBadge: true,
  showArrows: true,
  autoplay: false,
  autoplayDelay: 4000,
};

export const AUTOPLAY_MIN = 1000;
export const AUTOPLAY_MAX = 15000;

export function normalizeShowcaseConfig(raw: unknown): ProductShowcaseConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as ProductShowcaseConfig;
  const delay = Number(c.autoplayDelay);
  return {
    ...c,
    source: c.source === "brand" ? "brand" : "category",
    count: Math.min(20, Math.max(1, Number(c.count) || SHOWCASE_DEFAULT.count)),
    sortMode: c.sortMode ?? SHOWCASE_DEFAULT.sortMode,
    productIds: Array.isArray(c.productIds) ? c.productIds : [],
    showBrandBadge: c.showBrandBadge ?? SHOWCASE_DEFAULT.showBrandBadge,
    showArrows: c.showArrows ?? SHOWCASE_DEFAULT.showArrows,
    autoplay: c.autoplay ?? SHOWCASE_DEFAULT.autoplay,
    autoplayDelay: Number.isFinite(delay)
      ? Math.min(AUTOPLAY_MAX, Math.max(AUTOPLAY_MIN, Math.round(delay)))
      : SHOWCASE_DEFAULT.autoplayDelay,
  };
}

export default function ProductShowcaseSection({ config }: { config?: Record<string, any> }) {
  const cfg = normalizeShowcaseConfig(config);
  const isBrand = cfg.source === "brand";

  const [products, setProducts] = useState<ShowcaseProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiperReady, setSwiperReady] = useState(false);
  const swiperRef = useRef<any>(null);
  // به‌جای ساختن کلاس یکتا (که با Math.random یا useId زیر next/dynamic باعث
  // hydration mismatch می‌شود)، خود المان‌ها با ref به Swiper داده می‌شوند.
  // این روش هم چند نمونه‌ی هم‌زمان از ویجت را پشتیبانی می‌کند و هم SSR-safe است.
  const rootRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const sourceId = isBrand ? cfg.brandId : cfg.categoryId;
  const title = cfg.heading?.trim() || (isBrand ? cfg.brandTitle : cfg.categoryTitle) || "محصولات";
  const allHref = isBrand
    ? (cfg.brandSlug ? `/brands/${cfg.brandSlug}` : null)
    : (cfg.categorySlug ? `/categories/${cfg.categorySlug}` : null);

  const endpoint = isBrand ? "products-by-brand" : "products-by-category";
  const idParam = isBrand ? "brandId" : "categoryId";
  const productIdsKey = (cfg.productIds ?? []).join(",");

  // ── واکشی محصولات ──
  useEffect(() => {
    let cancelled = false;

    if (cfg.sortMode === "manual") {
      if (!productIdsKey) { setLoading(false); setProducts([]); return; }
      setLoading(true);
      fetch(`/api/store/${endpoint}?productIds=${productIdsKey}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) { setProducts(Array.isArray(d) ? d : []); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    } else {
      if (!sourceId) { setLoading(false); setProducts([]); return; }
      setLoading(true);
      const sort = cfg.sortMode === "best_sellers" ? "best_sellers" : "newest";
      fetch(`/api/store/${endpoint}?${idParam}=${sourceId}&count=${cfg.count}&sort=${sort}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) { setProducts(Array.isArray(d) ? d : []); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [endpoint, idParam, sourceId, cfg.count, cfg.sortMode, productIdsKey]);

  // ── راه‌اندازی Swiper ──
  useEffect(() => {
    if (!swiperReady || loading || products.length === 0) return;

    const win = window as any;
    if (!win.Swiper) return;

    const tryInit = () => {
      const el = rootRef.current;
      if (!el) return false;

      swiperRef.current?.destroy?.(true, true);
      swiperRef.current = new win.Swiper(el, {
        rtl: true,
        // ۲ کارت کامل + بخشی از کارت سوم، تا معلوم باشد لیست ادامه دارد
        slidesPerView: 2.25,
        spaceBetween: 12,
        speed: 600,
        grabCursor: true,
        watchOverflow: true,
        // ماژول a11y سوایپر aria-label دکمه‌های ناوبری را بازنویسی می‌کند و
        // پیش‌فرضش انگلیسی است؛ متن‌های فارسی جایگزین می‌شوند.
        a11y: {
          prevSlideMessage: "اسلاید قبلی",
          nextSlideMessage: "اسلاید بعدی",
          firstSlideMessage: "اولین اسلاید",
          lastSlideMessage: "آخرین اسلاید",
          containerMessage: `اسلایدر محصولات ${title}`,
        },
        ...(cfg.showArrows && prevRef.current && nextRef.current
          ? { navigation: { nextEl: nextRef.current, prevEl: prevRef.current } }
          : {}),
        ...(cfg.autoplay
          ? {
              autoplay: {
                delay: cfg.autoplayDelay,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              },
              loop: products.length > 4,
            }
          : {}),
        breakpoints: {
          480:  { slidesPerView: 2.4,  spaceBetween: 14 },
          640:  { slidesPerView: 3.2,  spaceBetween: 16 },
          1024: { slidesPerView: 4.2,  spaceBetween: 20 },
          1280: { slidesPerView: 5.2,  spaceBetween: 20 },
        },
      });
      return true;
    };

    if (!tryInit()) {
      const interval = setInterval(() => { if (tryInit()) clearInterval(interval); }, 100);
      return () => clearInterval(interval);
    }

    return () => { swiperRef.current?.destroy?.(true, true); };
  }, [swiperReady, loading, products, cfg.showArrows, cfg.autoplay, cfg.autoplayDelay]);

  if (!loading && products.length === 0) return null;

  const arrowCls =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white/70 text-gray-600 shadow-sm backdrop-blur-md transition-all hover:border-primary-500/50 hover:bg-primary-600 hover:text-white disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 sm:h-10 sm:w-10";

  return (
    <>
      <section className="relative transition-colors duration-500">
        <div className="container relative z-10">

          {/* ── سربرگ: عنوان راست، «مشاهده همه» و فلش‌ها چپ ── */}
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                {title}
              </h2>
              <p className="mt-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-primary-500 sm:text-[10px]">
                <span className="h-[2px] w-6 bg-primary-500/30" />
                {loading ? "در حال بارگذاری..." : `${products.length.toLocaleString("fa-IR")} محصول`}
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              {allHref && (
                <Link
                  href={allHref}
                  className="group/all flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-[11px] font-black text-gray-700 shadow-sm backdrop-blur-md transition-all hover:border-primary-500/50 hover:bg-primary-600 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-gray-300 sm:px-4 sm:text-xs"
                >
                  مشاهده همه
                  <svg className="h-3 w-3 transition-transform group-hover/all:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
              )}

              {cfg.showArrows && (
                <>
                  <button type="button" ref={prevRef} aria-label="اسلاید قبلی" className={arrowCls}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button type="button" ref={nextRef} aria-label="اسلاید بعدی" className={arrowCls}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── اسلایدر ── */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-64 animate-pulse rounded-3xl bg-white/60 dark:bg-white/5 sm:h-72 ${i > 1 ? "hidden sm:block" : ""} ${i > 2 ? "lg:block" : ""}`} />
              ))}
            </div>
          ) : (
            <div ref={rootRef} className="swiper">
              <div className="swiper-wrapper">
                {products.map(p => (
                  <div key={p.id} className="swiper-slide !h-auto pb-2">
                    <ShowcaseProductCard
                      product={p}
                      showBrand={cfg.showBrandBadge}
                      fallbackBrandTitle={isBrand ? cfg.brandTitle ?? null : null}
                    />
                  </div>
                ))}
              </div>
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
