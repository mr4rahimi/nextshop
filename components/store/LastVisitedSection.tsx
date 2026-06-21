"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getLastVisited } from "@/lib/lastVisited";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  image: string | null;
  stock: number;
  trackStock: boolean;
}

interface Config {
  heading?: string;
  accentColor?: string;
  maxCount?: number;
}

function fa(n: number) {
  return Math.round(n).toLocaleString("fa-IR");
}

function ProductCard({ p, accentColor }: { p: Product; accentColor: string }) {
  const price = Number(p.price);
  const sale = p.salePrice ? Number(p.salePrice) : null;
  const discount = sale && price > sale ? Math.round((1 - sale / price) * 100) : null;
  const display = sale ?? price;
  const outOfStock = p.trackStock && p.stock <= 0;

  return (
    <Link
      href={`/products/${p.slug}`}
      className="group flex-shrink-0 w-[180px] lg:w-[200px] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 hover:border-transparent transition-all duration-300"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "transform .25s ease, box-shadow .25s ease" }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-6px)";
        el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.10), 0 0 0 2px ${accentColor}40`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "";
        el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
      }}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 dark:bg-gray-800 overflow-hidden">
        {p.image ? (
          <img
            src={p.image}
            alt={p.title}
            className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📦</div>
        )}
        {discount && (
          <span
            className="absolute top-2 right-2 text-white text-[11px] font-black px-1.5 py-0.5 rounded-lg"
            style={{ background: accentColor }}
          >
            {fa(discount)}٪
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white text-xs font-black bg-black/50 px-2 py-1 rounded-lg">ناموجود</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-xs font-bold text-gray-800 dark:text-white line-clamp-2 leading-relaxed flex-1">
          {p.title}
        </p>
        <div className="flex flex-col mt-auto">
          {sale && (
            <span className="text-[10px] text-gray-400 line-through">{fa(price)} تومان</span>
          )}
          <span className="text-sm font-black" style={{ color: accentColor }}>
            {fa(display)} <span className="text-[10px] text-gray-400 font-semibold">تومان</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-[180px] lg:w-[200px] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-pulse">
      <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mt-2" />
      </div>
    </div>
  );
}

export default function LastVisitedSection({ config }: { config: Config }) {
  const {
    heading = "آخرین بازدیدهای شما",
    accentColor = "#4f46e5",
    maxCount = 10,
  } = config;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = getLastVisited().slice(0, maxCount);
    if (!ids.length) { setLoading(false); return; }

    fetch(`/api/store/amazing-products?productIds=${ids.join(",")}`)
      .then(r => r.json())
      .then((data: Product[]) => {
        // preserve localStorage order
        const map = new Map(data.map(p => [p.id, p]));
        setProducts(ids.map(id => map.get(id)).filter(Boolean) as Product[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [maxCount]);

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("[data-lv-card]") as HTMLElement | null;
    el.scrollBy({ left: dir * (card ? (card.offsetWidth + 16) * 3 : 600), behavior: "smooth" });
  };

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-8 lg:py-12">
      <div className="container">

        {/* Header */}
        <div className="flex items-center justify-between mb-5" dir="rtl">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}15` }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: accentColor }}>
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-base lg:text-lg font-black text-gray-900 dark:text-white">{heading}</h2>
              <p className="text-xs text-gray-400 mt-0.5">محصولاتی که اخیراً بازدید کردید</p>
            </div>
          </div>

          {/* nav buttons */}
          {products.length > 4 && (
            <div className="flex gap-2">
              <button
                onClick={() => scroll(1)}
                className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-white hover:border-transparent transition-all"
                style={{ '--hover-bg': accentColor } as any}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = accentColor; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => scroll(-1)}
                className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 transition-all"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = accentColor; (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.borderColor = ''; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Scroller */}
        <div
          ref={scrollerRef}
          dir="rtl"
          className="flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
        >
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map(p => (
                <div key={p.id} data-lv-card style={{ scrollSnapAlign: "start" }}>
                  <ProductCard p={p} accentColor={accentColor} />
                </div>
              ))
          }
        </div>

      </div>
    </section>
  );
}
