"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { ArrowLeft } from "lucide-react";

type Brand = {
  id: string;
  name: string;
  logoSrc: string;
  href: string;
};

export default function PopularBrandsSection() {
  const brands: Brand[] = useMemo(
    () => [
      { id: "b1", name: "Grohe", logoSrc: "/brands/grohe.png", href: "/brands/grohe" },
      { id: "b2", name: "Hansgrohe", logoSrc: "/brands/hansgrohe.png", href: "/brands/hansgrohe" },
      { id: "b3", name: "KWC", logoSrc: "/brands/kwc.png", href: "/brands/kwc" },
      { id: "b4", name: "شودر", logoSrc: "/brands/shouder.png", href: "/brands/shouder" },
      { id: "b5", name: "قهرمان", logoSrc: "/brands/ghahreman.png", href: "/brands/ghahreman" },
      { id: "b6", name: "راسان", logoSrc: "/brands/rassan.png", href: "/brands/rassan" },
      { id: "b7", name: "کلار", logoSrc: "/brands/klar.png", href: "/brands/klar" },
      { id: "b8", name: "Kohler", logoSrc: "/brands/kohler.png", href: "/brands/kohler" },
      { id: "b9", name: "Toto", logoSrc: "/brands/toto.png", href: "/brands/toto" },
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
            rounded-3xl border
            bg-white shadow-sm
            p-4 md:p-6
          "
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-zinc-900">
                برندهای محبوب
              </h2>
              <p className="hidden md:block mt-1 text-sm text-zinc-600">
                انتخاب از برندهای معتبر و پرطرفدار
              </p>
            </div>

            <Link
              href="/brands"
              className="
                inline-flex items-center gap-2
                rounded-2xl border bg-zinc-50 px-4 py-2
                text-sm font-bold text-zinc-900
                hover:bg-zinc-100 transition
              "
            >
              نمایش همه
              <ArrowLeft size={18} />
            </Link>
          </div>

          <div
            ref={scrollerRef}
            className="
              no-scrollbar
              mt-4 flex gap-3 md:gap-4
              overflow-x-auto scroll-smooth
              cursor-grab active:cursor-grabbing
              select-none pb-1
            "
            style={{ WebkitOverflowScrolling: "touch" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="اسلایدر برندهای محبوب"
          >
            {brands.map((b) => (
              <Link
                key={b.id}
                href={b.href}
                className="
                  shrink-0
                  basis-[28.5%]
                  md:basis-[160px]
                "
                onClick={(e) => {
                  if (drag.current.moved) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                draggable={false}
              >
                <div
                  className="
                    group flex flex-col items-center gap-2
                    rounded-2xl border bg-white
                    p-3 md:p-4
                    shadow-sm hover:shadow-md transition
                  "
                >
                  <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-zinc-50 border overflow-hidden">
                    <Image
                      src={b.logoSrc}
                      alt={b.name}
                      fill
                      sizes="(max-width: 767px) 20vw, 80px"
                      className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
                      draggable={false}
                    />
                  </div>

                  <div className="text-xs md:text-sm font-bold text-zinc-900 line-clamp-1">
                    {b.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
