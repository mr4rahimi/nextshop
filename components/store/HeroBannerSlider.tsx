"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide = {
  id: string;
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  href?: string;
};

export default function HeroBannerSlider() {
  const slides: Slide[] = useMemo(
    () => [
      {
        id: "1",
        desktopSrc: "/banners/desktop/01.webp",
        mobileSrc: "/banners/mobile/01.webp",
        alt: "بنر شماره 1",
        href: "/products",
      },
      {
        id: "2",
        desktopSrc: "/banners/desktop/02.webp",
        mobileSrc: "/banners/mobile/02.webp",
        alt: "بنر شماره 2",
        href: "/categories",
      },
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const next = () => setIndex((i) => (i + 1) % slides.length);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const goTo = (i: number) => setIndex(i);

  useEffect(() => {
    const stop = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };

    stop();
    timerRef.current = window.setInterval(next, 4000);

    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  // swipe (mobile)
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX.current;
    const diff = endX - startX.current;
    startX.current = null;

    if (Math.abs(diff) < 40) return;
    if (diff < 0) next();
    else prev();
  };

  const stopLinkClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <section className="w-full pt-4">
      <div
        className="relative w-full overflow-hidden bg-zinc-100"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
        aria-label="بنرهای فروشگاه"
      >
        {}
        {/* slides */}
        <div className="relative w-full h-[500px] md:h-[520px]">
          {slides.map((slide, i) => {
            const isActive = i === index;
            const slideClasses = `absolute inset-0 z-0 transition-opacity duration-500 ${
              isActive ? "opacity-100" : "opacity-0 pointer-events-none"
            }`;
            const content = (
              <>
                {/* Desktop */}
                <div className="relative hidden md:block w-full h-full">
                  <Image
                    src={slide.desktopSrc}
                    alt={slide.alt}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? "eager" : "lazy"}
                    sizes="100vw"
                    unoptimized
                    className="object-cover"
                  />
                </div>

                {/* Mobile */}
                <div className="relative md:hidden w-full h-full">
                  <Image
                    src={slide.mobileSrc}
                    alt={slide.alt}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? "eager" : "lazy"}
                    sizes="100vw"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </>
            );

            return slide.href ? (
              <Link
                key={slide.id}
                href={slide.href}
                className={slideClasses}
                aria-hidden={!isActive}
              >
                {content}
              </Link>
            ) : (
              <div
                key={slide.id}
                className={slideClasses}
                aria-hidden={!isActive}
              >
                {content}
              </div>
            );
          })}
        </div>

        {}
        <button
          type="button"
          onMouseDown={stopLinkClick}
          onClick={(e) => {
            stopLinkClick(e);
            prev();
          }}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white"
          aria-label="بنر قبلی"
        >
          <ChevronRight size={22} />
        </button>

        <button
          type="button"
          onMouseDown={stopLinkClick}
          onClick={(e) => {
            stopLinkClick(e);
            next();
          }}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white"
          aria-label="بنر بعدی"
        >
          <ChevronLeft size={22} />
        </button>

        {}
        <div
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={(e) => {
                stopLinkClick(e);
                goTo(i);
              }}
              className={`h-2.5 rounded-full transition-all ${
                i === index ? "w-8 bg-white" : "w-2.5 bg-white/60 hover:bg-white/80"
              }`}
              aria-label={`رفتن به بنر ${i + 1}`}
              aria-current={i === index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
