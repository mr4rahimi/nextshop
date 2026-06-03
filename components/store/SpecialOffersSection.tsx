"use client";

import Link from "next/link";
import { Flame, ArrowLeft } from "lucide-react";
import { useMemo, useRef } from "react";
import ProductCard, { ProductCardData } from "./ProductCard";

export default function SpecialOffersSection() {
  const products: ProductCardData[] = useMemo(
    () => [
      {
        id: "o1",
        title: "پیشنهاد ویژه: شیر ظرفشویی مونتاژی - طلایی براق",
        imageSrc: "/products/p2.jpg",
        href: "/products/o1",
        price: 2490000,
        compareAtPrice: 3490000,
        discountPercent: 29,
        rating: 4.7,
        stock: 7,
      },
      {
        id: "o2",
        title: "پیشنهاد ویژه: شیر روشویی مدرن - مشکی مات",
        imageSrc: "/products/p4.jpg",
        href: "/products/o2",
        price: 1890000,
        compareAtPrice: 2590000,
        discountPercent: 27,
        rating: 4.3,
        stock: 3,
      },
      {
        id: "o3",
        title: "ست شیرآلات ۴ تایی یکپارچه - تخفیف محدود",
        imageSrc: "/products/p3.jpg",
        href: "/products/o3",
        price: 7990000,
        compareAtPrice: 10490000,
        discountPercent: 24,
        rating: 4.8,
        stock: 2,
      },
      {
        id: "o4",
        title: "شیر حمام مدل کلاسیک - کروم",
        imageSrc: "/products/p1.jpg",
        href: "/products/o4",
        price: 2790000,
        compareAtPrice: 3590000,
        discountPercent: 22,
        rating: 4.4,
        stock: 10,
      },
      {
        id: "o5",
        title: "شیر توالت مینیمال - سفید مات",
        imageSrc: "/products/p5.jpg",
        href: "/products/o5",
        price: 1590000,
        compareAtPrice: 2190000,
        discountPercent: 27,
        rating: 4.1,
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
            border border-rose-200/50
            bg-gradient-to-br from-rose-50/85 via-orange-50/70 to-amber-100/60
            backdrop-blur-xl
            shadow-[0_18px_55px_-18px_rgba(244,63,94,0.35)]
            p-4 md:p-6
          "
        >
          {/* soft glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-rose-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />

          <div className="relative md:flex md:items-stretch md:gap-6">
            {/* Right (desktop) / Top (mobile) */}
            <div className="flex items-center justify-between md:flex-col md:items-start md:justify-center md:w-[260px]">
              <div className="flex flex-col gap-1">
                <div className="inline-flex items-center gap-2 text-rose-700 font-extrabold">
                  <Flame size={18} />
                  پیشنهاد ویژه
                </div>
                <h2 className="text-lg md:text-2xl font-extrabold text-zinc-900">
                  تخفیف‌های محدود
                </h2>
                <p className="hidden md:block text-sm text-zinc-700">
                  فرصت‌های ویژه برای خرید سریع‌تر
                </p>
              </div>

              <Link
                href="/store/offers"
                className="
                  inline-flex items-center gap-2
                  rounded-2xl bg-rose-600 px-4 py-2.5
                  text-sm font-extrabold text-white
                  shadow-[0_12px_25px_-12px_rgba(244,63,94,0.55)]
                  hover:bg-rose-700 transition
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
                aria-label="اسلایدر پیشنهاد ویژه"
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

              {/* نکته: هیچ dots/فلش نداریم طبق خواسته */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
