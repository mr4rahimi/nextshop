"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef } from "react";

type Category = {
  id: string;
  title: string;
  imageSrc: string;
  href: string;
};

export default function CategoryCarousel() {
  const categories: Category[] = useMemo(
    () => [
      { id: "1", title: "شیر ظرفشویی", imageSrc: "/categories/faucet.webp", href: "/categories/faucet" },
      { id: "2", title: "شیر روشویی", imageSrc: "/categories/washbasin.webp", href: "/categories/washbasin" },
      { id: "3", title: "شیر حمام", imageSrc: "/categories/shower.webp", href: "/categories/shower" },
      { id: "4", title: "شیر توالت", imageSrc: "/categories/toilet.webp", href: "/categories/toilet" },
      { id: "5", title: "سینک", imageSrc: "/categories/sink.webp", href: "/categories/sink" },
      { id: "6", title: "لوازم جانبی", imageSrc: "/categories/accessories.webp", href: "/categories/accessories" },
      { id: "7", title: "ست ۴ تایی", imageSrc: "/categories/set.webp", href: "/categories/set" },
      { id: "8", title: "قطعات", imageSrc: "/categories/parts.webp", href: "/categories/parts" },
      { id: "9", title: "پیشنهاد ویژه", imageSrc: "/categories/offers.webp", href: "/store/offers" },
    ],
    []
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const drag = useRef({
    down: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

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
    if (!el) return;
    if (!drag.current.down) return;

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
      <div className="container mx-auto pt-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg md:text-xl font-bold">دسته‌بندی‌ها</h2>
          <Link href="/categories" className="text-sm text-gray-600 hover:text-black">
            مشاهده همه
          </Link>
        </div>

        <div
          ref={scrollerRef}
          className="
            no-scrollbar
            mt-4 flex gap-3 md:gap-4
            overflow-x-auto scroll-smooth
            cursor-grab active:cursor-grabbing
            select-none
            pb-1
          "
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="list"
          aria-label="لیست دسته‌بندی‌ها"
        >
          {categories.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              draggable={false}
              className="
                shrink-0
                basis-[28.5%]
                md:basis-[12.5%]
              "
              onClick={(e) => {
               
                if (drag.current.moved) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <div className="group">
                <div
                  className="
                    relative aspect-square w-full overflow-hidden
                    rounded-2xl border bg-zinc-100
                    shadow-sm transition
                    group-hover:shadow
                  "
                >
                  <Image
                    src={c.imageSrc}
                    alt={c.title}
                    fill
                    sizes="(max-width: 767px) 30vw, (min-width: 768px) 12.5vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    draggable={false}
                  />
                </div>

                <div className="mt-2 text-center text-sm md:text-[13px] font-medium text-gray-900 line-clamp-1">
                  {c.title}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
