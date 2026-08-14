"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { contrastTextColor } from "@/lib/contrastColor";

/**
 * ویجت «باکس‌های مستطیلی» — کارت‌های افقی با متن سمت راست و تصویر سمت چپ که
 * بخشی از پایین تصویر از کادر بیرون می‌زند.
 *
 * نکته‌ی پیاده‌سازی: تصویر با `position: absolute` پایین‌تر از کف باکس کشیده
 * می‌شود. برای اینکه سوایپر (که `overflow: hidden` دارد) آن را نبُرد، به خود
 * اسلایدر `padding-bottom` به اندازه‌ی همان بیرون‌زدگی داده می‌شود؛ ناحیه‌ی padding
 * داخل کادر clip قرار می‌گیرد، پس تصویر کامل دیده می‌شود بدون اینکه اسلایدهای
 * کناری از دو طرف بیرون بزنند.
 */

export interface RectBoxItem {
  imageUrl: string;
  title: string;
  description: string;
  badge: string;
  linkUrl: string;
  bgType: "solid" | "gradient";
  bgColor: string;
  bgGradientFrom: string;
  bgGradientTo: string;
  bgGradientDir: string;
}

export interface RectBoxesConfig {
  heading: string;
  subheading: string;
  items: RectBoxItem[];
  /** میزان بیرون‌زدگی تصویر از کف باکس، بر حسب پیکسل */
  imageOverflow: number;
  showArrows: boolean;
  autoplay: boolean;
  autoplaySeconds: number;
}

export const RB_EMPTY_ITEM: RectBoxItem = {
  imageUrl: "",
  title: "",
  description: "",
  badge: "",
  linkUrl: "",
  bgType: "solid",
  bgColor: "#0f9b9b",
  bgGradientFrom: "#0f9b9b",
  bgGradientTo: "#0b6e7a",
  bgGradientDir: "135deg",
};

export const RB_OVERFLOW_MIN = 0;
export const RB_OVERFLOW_MAX = 48;
export const RB_SECONDS_MIN = 1;
export const RB_SECONDS_MAX = 15;

export const RB_DEFAULT: RectBoxesConfig = {
  heading: "",
  subheading: "",
  items: [],
  imageOverflow: 20,
  showArrows: true,
  autoplay: false,
  autoplaySeconds: 4,
};

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function safeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;
}

function normalizeItem(raw: unknown): RectBoxItem {
  const it = (raw && typeof raw === "object" ? raw : {}) as Partial<RectBoxItem>;
  return {
    imageUrl: typeof it.imageUrl === "string" ? it.imageUrl : "",
    title: typeof it.title === "string" ? it.title : "",
    description: typeof it.description === "string" ? it.description : "",
    badge: typeof it.badge === "string" ? it.badge : "",
    linkUrl: typeof it.linkUrl === "string" ? it.linkUrl : "",
    bgType: it.bgType === "gradient" ? "gradient" : "solid",
    bgColor: safeColor(it.bgColor, RB_EMPTY_ITEM.bgColor),
    bgGradientFrom: safeColor(it.bgGradientFrom, RB_EMPTY_ITEM.bgGradientFrom),
    bgGradientTo: safeColor(it.bgGradientTo, RB_EMPTY_ITEM.bgGradientTo),
    bgGradientDir: typeof it.bgGradientDir === "string" ? it.bgGradientDir : RB_EMPTY_ITEM.bgGradientDir,
  };
}

export function normalizeRectBoxesConfig(raw: unknown): RectBoxesConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<RectBoxesConfig>;
  return {
    heading: typeof c.heading === "string" ? c.heading : "",
    subheading: typeof c.subheading === "string" ? c.subheading : "",
    // باکسِ بدون عنوان و بدون تصویر عملاً خالی است و رندر نمی‌شود
    items: Array.isArray(c.items)
      ? c.items.map(normalizeItem).filter(it => it.imageUrl || it.title)
      : [],
    imageOverflow: clampNum(c.imageOverflow, RB_OVERFLOW_MIN, RB_OVERFLOW_MAX, RB_DEFAULT.imageOverflow),
    showArrows: c.showArrows ?? RB_DEFAULT.showArrows,
    autoplay: c.autoplay ?? RB_DEFAULT.autoplay,
    autoplaySeconds: clampNum(c.autoplaySeconds, RB_SECONDS_MIN, RB_SECONDS_MAX, RB_DEFAULT.autoplaySeconds),
  };
}

/** پس‌زمینه‌ی یک باکس — در ادمین هم برای پیش‌نمایش استفاده می‌شود */
export function rectBoxBackground(item: RectBoxItem): string {
  return item.bgType === "gradient"
    ? `linear-gradient(${item.bgGradientDir}, ${item.bgGradientFrom}, ${item.bgGradientTo})`
    : item.bgColor;
}

/** رنگ متن هر باکس، خودکار از روی روشنایی پس‌زمینه‌ی همان باکس */
export function rectBoxTextColor(item: RectBoxItem): string {
  return item.bgType === "gradient"
    ? contrastTextColor(item.bgGradientFrom, item.bgGradientTo)
    : contrastTextColor(item.bgColor);
}

export default function RectBoxesSection({ config }: { config?: Record<string, any> }) {
  const cfg = normalizeRectBoxesConfig(config);

  const [swiperReady, setSwiperReady] = useState(false);
  const swiperRef = useRef<any>(null);
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
        // موبایل: دو باکس کامل + بخشی از باکس سوم
        slidesPerView: 2.25,
        spaceBetween: 12,
        speed: 600,
        grabCursor: true,
        watchOverflow: true,
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
        breakpoints: {
          640:  { slidesPerView: 2.4, spaceBetween: 16 },
          1024: { slidesPerView: 3.2, spaceBetween: 20 },
          1280: { slidesPerView: 4,   spaceBetween: 20 },
        },
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

  const ov = cfg.imageOverflow;

  const arrowCls =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white/70 text-gray-600 shadow-sm backdrop-blur-md transition-all hover:border-primary-500/50 hover:bg-primary-600 hover:text-white disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 sm:h-10 sm:w-10";

  return (
    <>
      <section className="transition-colors duration-500">
        <div className="container">

          {/* سربرگ */}
          {(cfg.heading || cfg.subheading || cfg.showArrows) && (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                {cfg.heading && (
                  <h2 className="truncate text-lg font-black tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                    {cfg.heading}
                  </h2>
                )}
                {cfg.subheading && (
                  <p className="mt-1 truncate text-xs font-bold text-gray-500 dark:text-gray-400">
                    {cfg.subheading}
                  </p>
                )}
              </div>

              {cfg.showArrows && (
                <div className="flex flex-shrink-0 items-center gap-2">
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
                </div>
              )}
            </div>
          )}

          {/* اسلایدر — padding پایین به اندازه‌ی بیرون‌زدگی تا تصویر بریده نشود */}
          <div ref={rootRef} className="swiper" style={{ paddingBottom: ov + 4 }}>
            <div className="swiper-wrapper">
              {cfg.items.map((item, i) => {
                const bg = rectBoxBackground(item);
                const color = rectBoxTextColor(item);

                const inner = (
                  <div
                    className="relative h-32 overflow-visible rounded-2xl px-3 py-3 shadow-md transition-transform duration-500 group-hover/rb:-translate-y-1 sm:h-36 sm:rounded-3xl sm:px-4 lg:h-40"
                    style={{ background: bg, color }}
                  >
                    {/* متن‌ها — سمت راست */}
                    <div className="relative z-10 flex h-full w-[58%] flex-col justify-center">
                      {item.title && (
                        <h3 className="line-clamp-2 text-[13px] font-black leading-5 sm:text-base sm:leading-6">
                          {item.title}
                        </h3>
                      )}
                      {item.description && (
                        <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-4 opacity-80 sm:text-xs">
                          {item.description}
                        </p>
                      )}
                      {item.badge && (
                        <span
                          className="mt-2 w-fit rounded-lg px-2 py-0.5 text-[9px] font-black sm:text-[10px]"
                          style={{ backgroundColor: `${color}22` }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* تصویر — سمت چپ، پایینش از کادر بیرون می‌زند */}
                    {item.imageUrl && (
                      <div
                        className="absolute left-2 z-0 w-[42%] sm:left-3"
                        style={{ bottom: -ov, height: `calc(100% + ${ov}px)` }}
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.title || "تصویر"}
                          fill
                          sizes="(max-width: 640px) 20vw, (max-width: 1280px) 14vw, 10vw"
                          className="object-contain object-bottom transition-transform duration-500 group-hover/rb:scale-105"
                        />
                      </div>
                    )}
                  </div>
                );

                return (
                  <div key={i} className="swiper-slide !h-auto">
                    {item.linkUrl ? (
                      <Link href={item.linkUrl} className="group/rb block">{inner}</Link>
                    ) : (
                      <div className="group/rb">{inner}</div>
                    )}
                  </div>
                );
              })}
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
