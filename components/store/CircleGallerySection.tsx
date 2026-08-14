"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";

/**
 * ویجت «گالری دایره‌ای» — مجموعه‌ای از تصاویر گرد لینک‌دار در یک اسلایدر.
 *
 * تعداد دایره‌های نمایش‌داده‌شده تنظیم جداگانه ندارد و **خودکار** از روی قطر
 * دایره و عرض صفحه حساب می‌شود: اسلایدر با `slidesPerView: "auto"` کار می‌کند و
 * عرض هر اسلاید برابر قطر دایره است، پس مرورگر خودش هرچند تا که جا می‌شود نشان
 * می‌دهد — بدون محاسبه‌ی دستی و بدون پرش هنگام تغییر اندازه‌ی صفحه.
 *
 * در موبایل اگر قطر انتخابی از عرض صفحه بزرگ‌تر باشد، با `min(قطر, ۳۸vw)` کمی
 * کوچک می‌شود تا همیشه دست‌کم دو دایره و نیم در دید باشد.
 */

export interface CircleGalleryItem {
  imageUrl: string;
  title: string;
  linkUrl: string;
}

export interface CircleGalleryConfig {
  heading: string;
  subheading: string;
  items: CircleGalleryItem[];
  /** قطر دایره بر حسب پیکسل */
  diameter: number;
  showTitle: boolean;
  showArrows: boolean;
  autoplay: boolean;
  autoplaySeconds: number;
  bgType: "none" | "solid" | "gradient";
  bgColor: string;
  bgGradientFrom: string;
  bgGradientTo: string;
  bgGradientDir: string;
}

export const CG_EMPTY_ITEM: CircleGalleryItem = { imageUrl: "", title: "", linkUrl: "" };

export const CG_DIAMETER_MIN = 48;
export const CG_DIAMETER_MAX = 200;
export const CG_SECONDS_MIN = 1;
export const CG_SECONDS_MAX = 15;

export const CG_DEFAULT: CircleGalleryConfig = {
  heading: "",
  subheading: "",
  items: [],
  diameter: 96,
  showTitle: true,
  showArrows: true,
  autoplay: false,
  autoplaySeconds: 4,
  bgType: "none",
  bgColor: "#f1f5f9",
  bgGradientFrom: "#e0e7ff",
  bgGradientTo: "#fce7f3",
  bgGradientDir: "135deg",
};

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function safeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;
}

export function normalizeCircleGalleryConfig(raw: unknown): CircleGalleryConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<CircleGalleryConfig>;
  return {
    heading: typeof c.heading === "string" ? c.heading : "",
    subheading: typeof c.subheading === "string" ? c.subheading : "",
    items: Array.isArray(c.items)
      ? c.items.map(it => ({ ...CG_EMPTY_ITEM, ...it })).filter(it => !!it.imageUrl)
      : [],
    diameter: clampNum(c.diameter, CG_DIAMETER_MIN, CG_DIAMETER_MAX, CG_DEFAULT.diameter),
    showTitle: c.showTitle ?? CG_DEFAULT.showTitle,
    showArrows: c.showArrows ?? CG_DEFAULT.showArrows,
    autoplay: c.autoplay ?? CG_DEFAULT.autoplay,
    autoplaySeconds: clampNum(c.autoplaySeconds, CG_SECONDS_MIN, CG_SECONDS_MAX, CG_DEFAULT.autoplaySeconds),
    bgType: c.bgType === "solid" || c.bgType === "gradient" ? c.bgType : "none",
    bgColor: safeColor(c.bgColor, CG_DEFAULT.bgColor),
    bgGradientFrom: safeColor(c.bgGradientFrom, CG_DEFAULT.bgGradientFrom),
    bgGradientTo: safeColor(c.bgGradientTo, CG_DEFAULT.bgGradientTo),
    bgGradientDir: typeof c.bgGradientDir === "string" ? c.bgGradientDir : CG_DEFAULT.bgGradientDir,
  };
}

/** پس‌زمینه‌ی جعبه بر اساس تنظیمات — در ادمین هم برای پیش‌نمایش استفاده می‌شود */
export function circleGalleryBackground(cfg: CircleGalleryConfig): string | undefined {
  if (cfg.bgType === "solid") return cfg.bgColor;
  if (cfg.bgType === "gradient") {
    return `linear-gradient(${cfg.bgGradientDir}, ${cfg.bgGradientFrom}, ${cfg.bgGradientTo})`;
  }
  return undefined;
}

/** روشنایی نسبی sRGB — برای انتخاب خودکار رنگ متن */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const ch = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * رنگ متن روی پس‌زمینه‌ی انتخابی ادمین.
 *
 * وقتی ادمین پس‌زمینه‌ی سفارشی می‌گذارد، رنگ متن دیگر نباید از حالت روز/شب سایت
 * پیروی کند: یک پس‌زمینه‌ی روشن در حالت شب باعث می‌شد متنِ روشن روی زمینه‌ی روشن
 * بیفتد و خوانده نشود. اینجا از روی روشناییِ پس‌زمینه، متن تیره یا روشن انتخاب
 * می‌شود. `undefined` یعنی پس‌زمینه‌ای نیست و همان کلاس‌های تم سایت به کار می‌روند.
 */
export function circleGalleryTextColor(cfg: CircleGalleryConfig): string | undefined {
  if (cfg.bgType === "none") return undefined;
  const l =
    cfg.bgType === "solid"
      ? luminance(cfg.bgColor)
      : (luminance(cfg.bgGradientFrom) + luminance(cfg.bgGradientTo)) / 2;
  return l > 0.45 ? "#111827" : "#f9fafb";
}

export default function CircleGallerySection({ config }: { config?: Record<string, any> }) {
  const cfg = normalizeCircleGalleryConfig(config);

  const [swiperReady, setSwiperReady] = useState(false);
  const swiperRef = useRef<any>(null);
  // المان‌ها با ref به Swiper داده می‌شوند (نه کلاس یکتا) تا SSR-safe باشد
  const rootRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!swiperReady || cfg.items.length === 0) return;

    const win = window as any;
    if (!win.Swiper) return;

    const tryInit = () => {
      const el = rootRef.current;
      if (!el) return false;

      swiperRef.current?.destroy?.(true, true);
      swiperRef.current = new win.Swiper(el, {
        rtl: true,
        // تعداد نمایش خودکار: عرض هر اسلاید = قطر دایره
        slidesPerView: "auto",
        spaceBetween: 16,
        speed: 600,
        grabCursor: true,
        watchOverflow: true,
        centerInsufficientSlides: true,
        a11y: {
          prevSlideMessage: "اسلاید قبلی",
          nextSlideMessage: "اسلاید بعدی",
          firstSlideMessage: "اولین اسلاید",
          lastSlideMessage: "آخرین اسلاید",
        },
        ...(cfg.showArrows && prevRef.current && nextRef.current
          ? { navigation: { nextEl: nextRef.current, prevEl: prevRef.current } }
          : {}),
        ...(cfg.autoplay
          ? {
              autoplay: {
                delay: cfg.autoplaySeconds * 1000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              },
              loop: cfg.items.length > 3,
            }
          : {}),
      });
      return true;
    };

    if (!tryInit()) {
      const interval = setInterval(() => { if (tryInit()) clearInterval(interval); }, 100);
      return () => clearInterval(interval);
    }

    return () => { swiperRef.current?.destroy?.(true, true); };
  }, [swiperReady, cfg.items.length, cfg.showArrows, cfg.autoplay, cfg.autoplaySeconds]);

  if (cfg.items.length === 0) return null;

  const background = circleGalleryBackground(cfg);
  const hasBg = cfg.bgType !== "none";
  // با پس‌زمینه‌ی سفارشی، رنگ متن از روی روشناییِ همان پس‌زمینه می‌آید نه از تم سایت
  const textColor = circleGalleryTextColor(cfg);

  /** عرض/ارتفاع هر دایره — در موبایل از ۳۸vw بیشتر نمی‌شود */
  const circleSize = { width: "min(var(--cg-d), 38vw)", height: "min(var(--cg-d), 38vw)" };

  const arrowCls =
    "flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-md backdrop-blur-md transition-all hover:border-primary-500/50 hover:bg-primary-600 hover:text-white disabled:opacity-40 dark:border-white/10 dark:bg-black/40 dark:text-gray-300";

  return (
    <>
      <section className="transition-colors duration-500">
        <div className="container">
          <div
            className={hasBg ? "rounded-[2rem] px-4 py-8 sm:px-8" : ""}
            style={hasBg ? { background } : undefined}
          >
            {/* سربرگ */}
            {(cfg.heading || cfg.subheading) && (
              <div className="mb-6 text-center">
                {cfg.heading && (
                  <h2
                    className={`text-xl font-black tracking-tight sm:text-2xl ${textColor ? "" : "text-gray-900 dark:text-white"}`}
                    style={textColor ? { color: textColor } : undefined}
                  >
                    {cfg.heading}
                  </h2>
                )}
                {cfg.subheading && (
                  <p
                    className={`mt-1.5 text-xs font-bold sm:text-sm ${textColor ? "opacity-75" : "text-gray-500 dark:text-gray-400"}`}
                    style={textColor ? { color: textColor } : undefined}
                  >
                    {cfg.subheading}
                  </p>
                )}
              </div>
            )}

            {/* اسلایدر + فلش‌ها */}
            <div
              className="relative"
              style={{ ["--cg-d" as any]: `${cfg.diameter}px` }}
            >
              <div className={cfg.showArrows ? "md:px-14" : ""}>
                <div ref={rootRef} className="swiper">
                  <div className="swiper-wrapper">
                    {cfg.items.map((item, i) => {
                      const inner = (
                        <>
                          <div
                            className="relative overflow-hidden rounded-full border-2 border-white bg-gray-100 shadow-lg transition-transform duration-500 group-hover/cg:scale-105 dark:border-white/10 dark:bg-white/5"
                            style={circleSize}
                          >
                            <Image
                              src={item.imageUrl}
                              alt={item.title || "تصویر"}
                              fill
                              sizes="(max-width: 768px) 38vw, 200px"
                              className="object-cover"
                            />
                          </div>
                          {cfg.showTitle && item.title && (
                            <span
                              className={`mt-2.5 block truncate text-center text-[11px] font-black transition-colors sm:text-xs ${
                                textColor
                                  ? "opacity-85 group-hover/cg:opacity-100"
                                  : "text-gray-700 group-hover/cg:text-primary-600 dark:text-gray-300 dark:group-hover/cg:text-primary-400"
                              }`}
                              style={{ maxWidth: "min(var(--cg-d), 38vw)", ...(textColor ? { color: textColor } : {}) }}
                            >
                              {item.title}
                            </span>
                          )}
                        </>
                      );

                      return (
                        <div
                          key={i}
                          className="swiper-slide !w-auto"
                          style={{ width: "auto" }}
                        >
                          {item.linkUrl ? (
                            <Link href={item.linkUrl} className="group/cg flex flex-col items-center">
                              {inner}
                            </Link>
                          ) : (
                            <div className="group/cg flex flex-col items-center">{inner}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* فلش‌ها — موبایل: پایین وسط | دسکتاپ: دو طرف */}
              {cfg.showArrows && (
                <div className="mt-5 flex justify-center gap-3 md:mt-0 md:block">
                  <button
                    type="button"
                    ref={prevRef}
                    aria-label="اسلاید قبلی"
                    className={`${arrowCls} md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    ref={nextRef}
                    aria-label="اسلاید بعدی"
                    className={`${arrowCls} md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
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
