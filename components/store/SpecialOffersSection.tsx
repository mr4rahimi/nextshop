"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  image: string | null;
  stock: number;
  ratingAvg?: number;
  ratingCount?: number;
}

interface Config {
  productIds?: string[];
  heading?: string;
  subheading?: string;
  endsAt?: string | null;
  bgColor?: string;
  accentColor?: string;
}

function fa(n: number) {
  return Math.round(n).toLocaleString("fa-IR");
}

function Stars({ rating }: { rating: number }) {
  const full = Math.min(5, Math.round(rating));
  return (
    <span className="tracking-wider text-[13px]">
      {"★".repeat(full)}
      <span style={{ opacity: 0.3 }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

function CountdownTimer({ endsAt, accentColor }: { endsAt?: string | null; accentColor: string }) {
  const [vals, setVals] = useState({ h: "--", m: "--", s: "--" });

  useEffect(() => {
    const target = endsAt
      ? new Date(endsAt)
      : (() => { const d = new Date(); d.setHours(d.getHours() + 8); return d; })();

    const tick = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      const pad = (n: number) =>
        String(n).padStart(2, "0").replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
      setVals({
        h: pad(Math.floor(diff / 3600000)),
        m: pad(Math.floor((diff % 3600000) / 60000)),
        s: pad(Math.floor((diff % 60000) / 1000)),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const Cell = ({ val, accent }: { val: string; accent?: boolean }) => (
    <div
      className="min-w-[44px] text-center px-2 py-2 rounded-xl border font-black text-lg tabular-nums"
      style={
        accent
          ? { background: accentColor, borderColor: accentColor, boxShadow: `0 8px 20px ${accentColor}55`, color: "#fff" }
          : { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)", color: "#fff" }
      }
    >
      {val}
    </div>
  );

  return (
    <div className="flex items-center gap-3" dir="ltr">
      <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
        پایان تا
      </span>
      <div className="flex items-center gap-1.5">
        <Cell val={vals.h} />
        <span className="font-black text-lg" style={{ color: accentColor }}>:</span>
        <Cell val={vals.m} />
        <span className="font-black text-lg" style={{ color: accentColor }}>:</span>
        <Cell val={vals.s} accent />
      </div>
    </div>
  );
}

function ProductCard({ p, accentColor }: { p: Product; accentColor: string }) {
  const price = Number(p.price);
  const sale = p.salePrice ? Number(p.salePrice) : null;
  const discount = sale && price > sale ? Math.round((1 - sale / price) * 100) : null;
  const display = sale ?? price;
  const stockPct = Math.max(6, Math.min(100, p.stock * 5));

  return (
    <Link
      href={`/products/${p.slug}`}
      className="group flex-shrink-0 w-[220px] lg:w-[240px] bg-white rounded-[20px] overflow-hidden flex flex-col select-none"
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        transition: "transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s ease",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-8px)";
        el.style.boxShadow = "0 22px 48px rgba(0,0,0,0.45)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "";
        el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.25)";
      }}
    >
      {/* Image */}
      <div
        className="relative flex items-center justify-center p-5 overflow-hidden"
        style={{ height: 220, background: "linear-gradient(160deg,#f7f8fa,#eef0f3)" }}
      >
        {discount && (
          <span
            className="absolute top-3.5 right-3.5 z-10 text-white text-[13px] font-black px-3 py-1.5"
            style={{
              borderRadius: "0 12px 0 14px",
              background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`,
              boxShadow: `0 6px 16px ${accentColor}55`,
            }}
          >
            {fa(discount)}٪
          </span>
        )}
        {p.image ? (
          <img
            src={p.image}
            alt={p.title}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-400 text-3xl">
            📦
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <h3 className="text-[14px] font-bold text-gray-900 leading-relaxed line-clamp-2 min-h-[44px]">
          {p.title}
        </h3>

        {(p.ratingAvg ?? 0) > 0 && (
          <div className="flex items-center gap-1.5" style={{ color: "#ffb400" }}>
            <Stars rating={p.ratingAvg!} />
            <span className="text-[11px] text-gray-400">({fa(p.ratingCount ?? 0)})</span>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            {sale && (
              <span className="text-[11px] text-gray-400 line-through">{fa(price)} تومان</span>
            )}
            <span className="text-[17px] font-black text-gray-900">
              {fa(display)}{" "}
              <span className="text-[11px] text-gray-500 font-semibold">تومان</span>
            </span>
          </div>
          <div
            className="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110"
            style={{ background: "#16181d", color: "#fff" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = accentColor)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#16181d")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 4h2l2.2 11.2a1.5 1.5 0 001.5 1.2h8.1a1.5 1.5 0 001.5-1.2L21 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9.5" cy="20" r="1.4" fill="currentColor"/>
              <circle cx="17.5" cy="20" r="1.4" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* Stock bar */}
        <div>
          <div className="h-[5px] rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${stockPct}%`, background: `linear-gradient(90deg,${accentColor},${accentColor}88)` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">باقیمانده: {fa(p.stock)} عدد</p>
        </div>
      </div>
    </Link>
  );
}

export default function SpecialOffersSection({ config }: { config: Config }) {
  const {
    productIds = [],
    heading = "تخفیف‌های شگفت‌انگیز",
    subheading = "پیشنهادهای ویژه، فقط تا پایان امروز",
    endsAt,
    bgColor = "#0e0f12",
    accentColor = "#ff3b4e",
  } = config;

  const [products, setProducts] = useState<Product[]>([]);
  const [progress, setProgress] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!productIds.length) return;
    fetch(`/api/store/amazing-products?productIds=${productIds.join(",")}`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {});
  }, [productIds.join(",")]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !products.length) return;
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? Math.min(100, Math.abs(el.scrollLeft) / max * 100) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [products]);

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("[data-so-card]") as HTMLElement | null;
    el.scrollBy({ left: dir * (card ? (card.offsetWidth + 20) * 2 : 500), behavior: "smooth" });
  };

  if (!productIds.length || products.length === 0) return null;

  return (
    <section
      style={{ background: bgColor, position: "relative", overflow: "hidden", padding: "64px 0 80px", color: "#fff" }}
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: "absolute", top: -180, left: -120, width: 480, height: 480,
          borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none",
          background: `radial-gradient(circle,${accentColor}2e,transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute", bottom: -160, right: -100, width: 420, height: 420,
          borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none",
          background: `radial-gradient(circle,${accentColor}18,transparent 70%)`,
        }}
      />

      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "0 32px", position: "relative" }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-6 flex-wrap mb-9" dir="rtl">
          <div className="flex items-center gap-5">
            <div
              className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg,${accentColor},${accentColor}bb)`,
                boxShadow: `0 10px 30px ${accentColor}55`,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M13 2 4.5 13.5h6L9 22l9.5-12.5h-6L13 2Z" fill="#fff" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl lg:text-[28px] font-black leading-tight">{heading}</h2>
              <p className="text-[14px] mt-1.5 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                {subheading}
              </p>
            </div>
          </div>
          <CountdownTimer endsAt={endsAt} accentColor={accentColor} />
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Prev button */}
          <button
            onClick={() => scroll(1)}
            aria-label="قبلی"
            className="absolute z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 border-none cursor-pointer"
            style={{ right: -14, top: 110, background: "#fff", color: "#16181d", boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.background = accentColor; el.style.color = "#fff"; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.background = "#fff"; el.style.color = "#16181d"; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Next button */}
          <button
            onClick={() => scroll(-1)}
            aria-label="بعدی"
            className="absolute z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 border-none cursor-pointer"
            style={{ left: -14, top: 110, background: "#fff", color: "#16181d", boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.background = accentColor; el.style.color = "#fff"; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.background = "#fff"; el.style.color = "#16181d"; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Scroller */}
          <div
            ref={scrollerRef}
            dir="rtl"
            className="flex gap-5 overflow-x-auto"
            style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", padding: "6px 2px 14px" }}
          >
            {products.map(p => (
              <div key={p.id} data-so-card style={{ scrollSnapAlign: "start" }}>
                <ProductCard p={p} accentColor={accentColor} />
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg,${accentColor},${accentColor}99)` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
