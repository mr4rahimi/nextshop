"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCart } from "@/components/store/cart/CartContext";
import { contrastTextColor } from "@/lib/contrastColor";
import {
  AUTOPLAY_MIN, AUTOPLAY_MAX,
  normalizeShowcaseConfig, type ProductShowcaseConfig,
} from "@/components/store/ProductShowcaseSection";

/**
 * ویجت «اسلایدر محصول کرافت» — الهام‌گرفته از بخش معرفی بازی‌ها: یک باکس
 * مشخصات کنار اسلایدری از کارت‌های مربعِ گوشه‌بریده.
 *
 *  - دسکتاپ: باکس مشخصات راست، اسلایدر چپ. ارتفاع باکس مشخصات دقیقاً برابر
 *    ضلع تصویر مربع است؛ عنوان، قیمت و دکمه‌ها همیشه دیده می‌شوند و توضیحات
 *    فقط تا جایی که جا باشد (با محو شدن انتها).
 *  - موبایل: اسلایدر بالا و باکس مشخصات زیرش.
 *  - باکس مشخصات همیشه محصولِ اسلاید فعال را نشان می‌دهد.
 *
 * منبع محصولات: انتخاب دستی از کل فروشگاه (source=manual)، یا مثل ویجت «نمایش
 * محصولات» یک دسته/برند با جدیدترین / پرفروش‌ترین / دستی.
 */

export interface CraftSliderConfig extends Omit<ProductShowcaseConfig, "source"> {
  /** manual: محصولات از کل فروشگاه دستی انتخاب می‌شوند (بدون دسته و برند) */
  source: "category" | "brand" | "manual";
  /** متن کوچک بالای عنوان */
  eyebrow?: string;
  bgFrom?: string;
  bgTo?: string;
  /** رنگ دکمه‌ی خرید و جزئیات تاکیدی */
  accentColor?: string;
  /** cover: تصویر کل مربع را پر می‌کند — contain: کل تصویر روی زمینه‌ی رنگی */
  imageFit?: "cover" | "contain";
}

export const CRAFT_DEFAULT = {
  source: "category" as const,
  count: 8,
  sortMode: "newest",
  showBrandBadge: true,
  showArrows: true,
  autoplay: false,
  autoplayDelay: 5000,
  eyebrow: "معرفی ویژه",
  heading: "",
  bgFrom: "#0b1220",
  bgTo: "#12264a",
  accentColor: "#38bdf8",
  imageFit: "cover" as const,
};

/** زمینه‌ی کارت‌ها به نوبت — پشت تصویرهای شفاف (حالت contain) دیده می‌شود */
const CARD_GRADIENTS = [
  "linear-gradient(160deg,#fb923c 0%,#ec4899 100%)",
  "linear-gradient(160deg,#22d3ee 0%,#0f766e 100%)",
  "linear-gradient(160deg,#a78bfa 0%,#4338ca 100%)",
  "linear-gradient(160deg,#facc15 0%,#ea580c 100%)",
  "linear-gradient(160deg,#34d399 0%,#047857 100%)",
];

/** گوشه‌ی بالا-راست و پایین-چپ بریده — نسخه‌ی راست‌به‌چپِ کارت‌های طرح */
const CUT = 26;
const CARD_CLIP = `polygon(0 0, calc(100% - ${CUT}px) 0, 100% ${CUT}px, 100% 100%, ${CUT}px 100%, 0 calc(100% - ${CUT}px))`;
const BTN_CLIP = "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))";

function safeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;
}

export function normalizeCraftConfig(raw: unknown): CraftSliderConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as CraftSliderConfig;
  const base = normalizeShowcaseConfig({
    count: CRAFT_DEFAULT.count,
    autoplayDelay: CRAFT_DEFAULT.autoplayDelay,
    ...r,
    source: r.source === "brand" ? "brand" : "category",
  });
  return {
    ...base,
    source: r.source === "manual" ? "manual" : base.source,
    eyebrow: typeof r.eyebrow === "string" ? r.eyebrow : CRAFT_DEFAULT.eyebrow,
    heading: typeof r.heading === "string" ? r.heading : "",
    bgFrom: safeColor(r.bgFrom, CRAFT_DEFAULT.bgFrom),
    bgTo: safeColor(r.bgTo, CRAFT_DEFAULT.bgTo),
    accentColor: safeColor(r.accentColor, CRAFT_DEFAULT.accentColor),
    imageFit: r.imageFit === "contain" ? "contain" : "cover",
  };
}

interface CraftProduct {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  image: string | null;
  excerpt?: string | null;
  brand?: { title: string; slug: string } | null;
  stock?: number;
  trackStock?: boolean;
}

function formatPrice(val: string | null | undefined): string {
  const n = Number(val);
  return val && !isNaN(n) ? n.toLocaleString("fa-IR") : "۰";
}

function discountPercent(price: string, salePrice: string | null): number | null {
  if (!salePrice) return null;
  const p = Number(price), s = Number(salePrice);
  if (!p) return null;
  const d = Math.round(((p - s) / p) * 100);
  return d > 0 ? d : null;
}

// ─── دکمه‌ی خرید باکس مشخصات ─────────────────────────────────────────────────
function BuyControl({ product, accent, accentText }: { product: CraftProduct; accent: string; accentText: string }) {
  const { items, addItem, updateQty, removeItem } = useCart();
  const qty = items.find(i => i.productId === product.id)?.qty ?? 0;
  const outOfStock = product.trackStock && (product.stock ?? 0) <= 0;

  const style = { background: accent, color: accentText, clipPath: BTN_CLIP };
  const cls = "flex h-11 items-center justify-center gap-2 px-5 text-[13px] font-black transition-all sm:h-12";

  if (outOfStock) {
    return (
      <span className={`${cls} cursor-not-allowed opacity-50`} style={style}>ناموجود</span>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => addItem({
          id: product.id, title: product.title, slug: product.slug,
          price: product.price, salePrice: product.salePrice,
          mainImage: product.image, images: [],
        })}
        className={`${cls} hover:brightness-110 active:scale-95`}
        style={style}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
        </svg>
        افزودن به سبد
      </button>
    );
  }

  return (
    <div className={`${cls} gap-3 !px-2`} style={style}>
      <button type="button" aria-label="افزایش تعداد" onClick={() => updateQty(product.id, qty + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/15 transition-transform active:scale-90">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M12 6v12M6 12h12" /></svg>
      </button>
      <span className="min-w-[4.5rem] text-center tabular-nums">{qty.toLocaleString("fa-IR")} در سبد</span>
      <button type="button" aria-label={qty === 1 ? "حذف از سبد خرید" : "کاهش تعداد"}
        onClick={() => (qty === 1 ? removeItem(product.id) : updateQty(product.id, qty - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/15 transition-transform active:scale-90">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M18 12H6" /></svg>
      </button>
    </div>
  );
}

// ─── ویجت ────────────────────────────────────────────────────────────────────
export default function CraftProductSliderSection({ config }: { config?: Record<string, any> }) {
  const cfg = normalizeCraftConfig(config);
  const isBrand = cfg.source === "brand";

  const [products, setProducts] = useState<CraftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [swiperReady, setSwiperReady] = useState(false);
  const swiperRef = useRef<any>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const sourceId = isBrand ? cfg.brandId : cfg.categoryId;
  const endpoint = isBrand ? "products-by-brand" : "products-by-category";
  const idParam = isBrand ? "brandId" : "categoryId";
  const productIdsKey = (cfg.productIds ?? []).join(",");
  const loop = !!cfg.autoplay && products.length >= 4;

  // ── واکشی محصولات ──
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    if (cfg.source === "manual" || cfg.sortMode === "manual") {
      if (productIdsKey) url = `/api/store/${endpoint}?productIds=${productIdsKey}&withDesc=1`;
    } else if (sourceId) {
      const sort = cfg.sortMode === "best_sellers" ? "best_sellers" : "newest";
      url = `/api/store/${endpoint}?${idParam}=${sourceId}&count=${cfg.count}&sort=${sort}&withDesc=1`;
    }
    if (!url) { setProducts([]); setLoading(false); return; }

    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setProducts(Array.isArray(d) ? d : []); setActive(0); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint, idParam, sourceId, cfg.source, cfg.count, cfg.sortMode, productIdsKey]);

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
        // کارت فعال کامل + بخشی از کارت بعدی، تا معلوم باشد اسلایدر ادامه دارد
        slidesPerView: 1.3,
        spaceBetween: 14,
        speed: 650,
        grabCursor: true,
        watchOverflow: true,
        loop,
        a11y: {
          prevSlideMessage: "محصول قبلی",
          nextSlideMessage: "محصول بعدی",
          firstSlideMessage: "اولین محصول",
          lastSlideMessage: "آخرین محصول",
        },
        ...(cfg.autoplay
          ? { autoplay: { delay: cfg.autoplayDelay, disableOnInteraction: false, pauseOnMouseEnter: true } }
          : {}),
        breakpoints: {
          640:  { slidesPerView: 1.6, spaceBetween: 18 },
          1024: { slidesPerView: 1.75, spaceBetween: 22 },
        },
        on: {
          slideChange: (s: any) => setActive(s.realIndex ?? s.activeIndex ?? 0),
        },
      });
      return true;
    };

    if (!tryInit()) {
      const interval = setInterval(() => { if (tryInit()) clearInterval(interval); }, 100);
      return () => clearInterval(interval);
    }
    return () => { swiperRef.current?.destroy?.(true, true); };
  }, [swiperReady, loading, products, loop, cfg.autoplay, cfg.autoplayDelay]);

  if (!loading && products.length === 0) return null;

  const textColor = contrastTextColor(cfg.bgFrom!, cfg.bgTo!);
  const accentText = contrastTextColor(cfg.accentColor!);
  const current = products[Math.min(active, products.length - 1)];
  const goTo = (i: number) => {
    const s = swiperRef.current;
    if (!s) return;
    if (loop) s.slideToLoop(i); else s.slideTo(i);
  };
  const discount = current ? discountPercent(current.price, current.salePrice) : null;
  const brandTitle = current?.brand?.title ?? (isBrand ? cfg.brandTitle : null);

  const header = (cfg.eyebrow || cfg.heading) ? (
    <>
      {cfg.eyebrow && (
        <p className="mb-1 text-[11px] font-black tracking-[0.3em] opacity-70 sm:text-xs">{cfg.eyebrow}</p>
      )}
      {cfg.heading && (
        <h2 className="mb-4 text-xl font-black leading-tight sm:text-2xl lg:text-[1.75rem]">{cfg.heading}</h2>
      )}
    </>
  ) : null;

  const arrowCls =
    "flex h-9 w-9 items-center justify-center border border-current/20 bg-white/5 transition-all hover:bg-white/15 disabled:opacity-30";

  return (
    <>
      <section className="container">
        <div
          className="craft-slider relative overflow-hidden rounded-[2rem] px-4 py-6 sm:px-8 sm:py-10 lg:px-10"
          style={{ background: `linear-gradient(135deg, ${cfg.bgFrom} 0%, ${cfg.bgTo} 100%)`, color: textColor }}
        >
          {/* هاله‌ی رنگ تاکیدی پشت اسلایدر */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-1/2 h-[28rem] w-[28rem] -translate-y-1/2 rounded-full opacity-25 blur-3xl"
            style={{ background: cfg.accentColor }}
          />

          {/* موبایل: عنوان بخش بالای اسلایدر — دسکتاپ: داخل باکس مشخصات */}
          <div className="relative lg:hidden">{header}</div>

          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">

            {/* ── باکس مشخصات: در دسکتاپ هم‌قدِ مربع اسلاید، در موبایل زیر اسلایدر ── */}
            <div className="relative min-w-0 lg:col-span-5">
              <div className="flex flex-col lg:absolute lg:inset-0">
                <div className="hidden lg:block">{header}</div>

                {loading || !current ? (
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-3/4 animate-pulse rounded-lg bg-white/10" />
                    <div className="h-5 w-1/3 animate-pulse rounded-lg bg-white/10" />
                    <div className="h-16 animate-pulse rounded-lg bg-white/10" />
                  </div>
                ) : (
                  <div key={current.id} className="craft-fade flex min-h-0 flex-1 flex-col">
                    {brandTitle && cfg.showBrandBadge && (
                      <span className="mb-1.5 inline-block self-start text-[11px] font-black" style={{ color: cfg.accentColor }}>
                        {brandTitle}
                      </span>
                    )}
                    <Link href={`/products/${current.slug}`} className="hover:opacity-80">
                      <h3 className="line-clamp-2 text-lg font-black leading-8 sm:text-xl">{current.title}</h3>
                    </Link>

                    {/* قیمت */}
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-xl font-black tabular-nums sm:text-2xl">
                        {formatPrice(current.salePrice || current.price)}
                      </span>
                      <span className="text-[11px] font-bold opacity-60">تومان</span>
                      {discount && (
                        <>
                          <span className="text-xs tabular-nums line-through opacity-50">{formatPrice(current.price)}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-black" style={{ background: cfg.accentColor, color: accentText, clipPath: BTN_CLIP }}>
                            {discount.toLocaleString("fa-IR")}٪
                          </span>
                        </>
                      )}
                    </div>

                    {/* توضیحات — فقط تا جایی که جا باشد؛ انتها محو می‌شود */}
                    {current.excerpt ? (
                      <p
                        className="craft-excerpt mt-3 line-clamp-4 min-h-0 flex-1 overflow-hidden text-[13px] leading-7 opacity-75 lg:line-clamp-none"
                      >
                        {current.excerpt}
                      </p>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {/* دکمه‌ها */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <BuyControl product={current} accent={cfg.accentColor!} accentText={accentText} />
                      <Link
                        href={`/products/${current.slug}`}
                        className="flex h-11 items-center justify-center border px-5 text-[13px] font-black transition-all hover:bg-white/10 sm:h-12"
                        style={{ borderColor: cfg.accentColor, color: cfg.accentColor, clipPath: BTN_CLIP }}
                      >
                        مشاهده محصول
                      </Link>
                    </div>
                  </div>
                )}

                {/* ناوبری: فلش‌ها + شمارنده */}
                {cfg.showArrows && products.length > 1 && (
                  <div className="mt-4 flex items-center gap-2">
                    <button type="button" aria-label="محصول قبلی" className={arrowCls} style={{ clipPath: BTN_CLIP }}
                      onClick={() => swiperRef.current?.slidePrev()}>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button type="button" aria-label="محصول بعدی" className={arrowCls} style={{ clipPath: BTN_CLIP }}
                      onClick={() => swiperRef.current?.slideNext()}>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="mr-2 text-xs font-black tabular-nums opacity-60">
                      {(active + 1).toLocaleString("fa-IR")} / {products.length.toLocaleString("fa-IR")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── اسلایدر: موبایل بالا، دسکتاپ چپ ── */}
            <div className="order-first min-w-0 lg:order-none lg:col-span-7">
              {loading ? (
                <div className="flex gap-4">
                  <div className="aspect-square w-[76%] animate-pulse bg-white/10 sm:w-[62%] lg:w-[57%]" style={{ clipPath: CARD_CLIP }} />
                  <div className="aspect-square flex-1 animate-pulse bg-white/5" style={{ clipPath: CARD_CLIP }} />
                </div>
              ) : (
                <div ref={rootRef} className="swiper">
                  <div className="swiper-wrapper">
                    {products.map((p, i) => {
                      const isActive = i === active;
                      return (
                        <div key={p.id} className="swiper-slide">
                          <div
                            className="transition-all duration-500"
                            style={{
                              transform: isActive ? "scale(1)" : "scale(0.86)",
                              opacity: isActive ? 1 : 0.6,
                              filter: isActive ? "drop-shadow(0 22px 28px rgba(0,0,0,.45))" : "none",
                            }}
                          >
                            <Link
                              href={`/products/${p.slug}`}
                              onClick={e => { if (!isActive) { e.preventDefault(); goTo(i); } }}
                              aria-label={p.title}
                              className="group/craft relative block aspect-square p-[2px]"
                              style={{
                                clipPath: CARD_CLIP,
                                background: isActive
                                  ? `linear-gradient(160deg, ${cfg.accentColor}, rgba(255,255,255,.15) 45%, ${cfg.accentColor})`
                                  : "rgba(255,255,255,.12)",
                              }}
                            >
                              <div
                                className="relative h-full w-full overflow-hidden"
                                style={{ clipPath: CARD_CLIP, background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}
                              >
                                {p.image && (
                                  <Image
                                    src={p.image}
                                    alt={p.title}
                                    fill
                                    sizes="(max-width: 640px) 78vw, (max-width: 1024px) 60vw, 34vw"
                                    className={`transition-transform duration-700 group-hover/craft:scale-105 ${
                                      cfg.imageFit === "contain" ? "object-contain p-6" : "object-cover"
                                    }`}
                                  />
                                )}
                                {/* برچسب پایین کارت */}
                                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-4 pt-10 text-white sm:px-5">
                                  <span className="truncate text-[12px] font-black sm:text-[13px]">{p.title}</span>
                                  <svg className="h-4 w-4 flex-shrink-0 transition-transform group-hover/craft:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 12H5m6-6l-6 6 6 6" />
                                  </svg>
                                </div>
                              </div>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`
          .craft-slider .craft-fade { animation: craftFade .45s ease both; }
          @keyframes craftFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
          .craft-slider .craft-excerpt {
            -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent);
                    mask-image: linear-gradient(to bottom, #000 60%, transparent);
          }
          @media (prefers-reduced-motion: reduce) { .craft-slider .craft-fade { animation: none; } }
        `}</style>
      </section>

      <Script
        src="/assets/js/plugin/swiper/swiper-bundle.min.js"
        strategy="afterInteractive"
        onReady={() => setSwiperReady(true)}
      />
    </>
  );
}

export { AUTOPLAY_MIN as CRAFT_AUTOPLAY_MIN, AUTOPLAY_MAX as CRAFT_AUTOPLAY_MAX };
