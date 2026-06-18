"use client";

import Link from "next/link";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { useMemo, useRef } from "react";
import ProductCard, { ProductCardData } from "./ProductCard";

export default function BestSellersSection() {
  const products: ProductCardData[] = useMemo(
    () => [
      {
        id: "bs1",
        title: "پرفروش: شیر ظرفشویی مونتاژی مدل لوکس - کروم",
        imageSrc: "/products/p1.jpg",
        href: "/products/bs1",
        price: 2590000,
        compareAtPrice: 3190000,
        discountPercent: 19,
        rating: 4.9,
        stock: 18,
      },
      {
        id: "bs2",
        title: "پرفروش: شیر روشویی مینیمال - مشکی مات",
        imageSrc: "/products/p4.jpg",
        href: "/products/bs2",
        price: 1990000,
        compareAtPrice: 2590000,
        discountPercent: 23,
        rating: 4.7,
        stock: 6,
      },
      {
        id: "bs3",
        title: "پرفروش: ست شیرآلات ۴ تایی یکپارچه - مونتاژی",
        imageSrc: "/products/p3.jpg",
        href: "/products/bs3",
        price: 8490000,
        compareAtPrice: 10490000,
        discountPercent: 19,
        rating: 4.8,
        stock: 3,
      },
      {
        id: "bs4",
        title: "پرفروش: شیر توالت مدل کلاسیک - سفید",
        imageSrc: "/products/p5.jpg",
        href: "/products/bs4",
        price: 1690000,
        compareAtPrice: 2190000,
        discountPercent: 23,
        rating: 4.5,
        stock: 9,
      },
      {
        id: "bs5",
        title: "پرفروش: شیر حمام مدرن - طلایی مات",
        imageSrc: "/products/p2.jpg",
        href: "/products/bs5",
        price: 3290000,
        compareAtPrice: 3990000,
        discountPercent: 18,
        rating: 4.6,
        stock: 0,
      },
    ],
    []
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ down: false, startX: 0, startScrollLeft: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current.down = true;
    drag.current.moved = false;
    drag.current.startX = e.clientX;
    drag.current.startScrollLeft = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScrollLeft - dx * 1.1;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current.down = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <section className="w-full">
      <div className="container mx-auto pt-8">
        <div
          className="
            relative overflow-hidden rounded-3xl
            border border-primary-200/45
            bg-gradient-to-br from-primary-50/80 via-sky-50/70 to-slate-50/70
            backdrop-blur-xl
            shadow-[0_18px_55px_-18px_rgba(99,102,241,0.28)]
            p-4 md:p-6
          "
        >
          {/* glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-sky-300/18 blur-3xl" />

          <div className="relative md:flex md:items-stretch md:gap-6">
            {/* Right (desktop) / Top (mobile) */}
            <div className="flex items-center justify-between md:flex-col md:items-start md:justify-center md:w-[260px]">
              <div className="flex flex-col gap-1">
                <div className="inline-flex items-center gap-2 text-primary-700 font-extrabold">
                  <TrendingUp size={18} />
                  پرفروش‌ترین‌ها
                </div>
                <h2 className="text-lg md:text-2xl font-extrabold text-zinc-900">
                  محبوب‌ترین انتخاب‌ها
                </h2>
                <p className="hidden md:block text-sm text-zinc-700">
                  پرفروش‌های این مدت که مشتری‌ها دوست داشتن
                </p>
              </div>

              <Link
                href="/products?sort=best"
                className="
                  inline-flex items-center gap-2
                  rounded-2xl bg-primary-600 px-4 py-2.5
                  text-sm font-extrabold text-white
                  shadow-[0_12px_25px_-12px_rgba(99,102,241,0.5)]
                  hover:bg-primary-700 transition
                "
              >
                نمایش همه
                <ArrowLeft size={18} />
              </Link>
            </div>

            {/* Slider */}
            <div className="mt-4 md:mt-0 flex-1">
              <div
                ref={scrollerRef}
                className="
                  no-scrollbar
                  flex gap-3 md:gap-4
                  overflow-x-auto scroll-smooth
                  cursor-grab active:cursor-grabbing
                  select-none pb-1
                "
                style={{ WebkitOverflowScrolling: "touch" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                aria-label="اسلایدر پرفروش‌ترین‌ها"
              >
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="shrink-0 basis-[44%] md:basis-[240px]"
                    onClick={(e) => {
                      if (drag.current.moved) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              {}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
