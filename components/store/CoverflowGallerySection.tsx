"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
 * ویجت «گالری کاورفلو»
 *
 * بازتولید افکت کدپن با CSS transition خالص (بدون framer-motion).
 *  - هندسه‌ی ریل عمداً LTR نگه داشته شده تا محاسبات جابه‌جایی پایدار بماند؛
 *    متن‌ها و کنترل‌ها راست‌چین هستند.
 *  - هر تصویر می‌تواند لینک و یک دکمه‌ی اختیاری داشته باشد.
 *  - کلیک روی اسلاید غیرفعال → فعالش می‌کند. کلیک روی اسلاید فعال → لینک.
 *  - پشتیبانی از swipe، کیبورد، و اجرای خودکار اختیاری.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CoverflowItem {
  imageUrl: string;
  title?: string;
  linkUrl?: string;
  btnText?: string;
  btnUrl?: string;
}

export interface CoverflowGalleryConfig {
  heading?: string;
  subheading?: string;
  items?: CoverflowItem[];
  size?: "small" | "medium" | "large";
  showCaption?: boolean;
  autoplay?: boolean;
  autoplaySeconds?: number;
}

const SIZES: Record<"small" | "medium" | "large", number> = { small: 160, medium: 200, large: 260 };
const CSS = `
.cfl-root{width:100%;font-family:inherit}
.cfl-head{text-align:center;margin-bottom:clamp(1.25rem,3vw,2rem);padding-inline:1rem}
.cfl-head h2{margin:0 0 .5rem;font-size:clamp(1.4rem,3vw,1.85rem);font-weight:900;letter-spacing:-.02em}
.cfl-head p{margin:0 auto;max-width:38rem;font-size:1rem;line-height:1.8;opacity:.7}

.cfl-viewport{position:relative;overflow:hidden;display:flex;justify-content:center;touch-action:pan-y pinch-zoom;user-select:none}
.cfl-stage{position:relative;flex:0 0 auto}
.cfl-track{display:flex;width:max-content;transition:transform .8s cubic-bezier(.22,1,.36,1);will-change:transform}
.cfl-persp{perspective:384px;flex:0 0 auto}
.cfl-slide{position:relative;display:flex;flex-direction:column;align-items:center;flex-shrink:0;will-change:transform,width;transition:transform .8s cubic-bezier(1,-.03,.413,.965),width .8s cubic-bezier(1,-.03,.413,.965)}
.cfl-img{display:block;background-position:center;background-size:cover;background-color:rgba(0,0,0,.06);border-radius:12px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.cfl-frame{position:absolute;inset:0;margin:auto;border:2px solid currentColor;border-radius:16px;box-sizing:content-box;pointer-events:none;animation:cfl-pop .8s ease-in-out}
@keyframes cfl-pop{0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)}}

.cfl-caption{margin-top:1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:.85rem;min-height:2.5rem}
.cfl-caption-title{font-size:1rem;font-weight:800;line-height:1.8}
.cfl-btn{display:inline-flex;align-items:center;gap:6px;padding:.6rem 1.5rem;border-radius:999px;font-size:.85rem;font-weight:800;text-decoration:none;transition:transform .2s,box-shadow .2s}
.cfl-btn:hover{transform:translateY(-2px)}

.cfl-controls{margin-top:1.25rem;display:flex;align-items:center;justify-content:center;gap:1rem}
.cfl-nav{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;border:none;cursor:pointer;background:rgba(0,0,0,.06);transition:background .2s,opacity .2s}
.cfl-nav:hover:not(:disabled){background:rgba(0,0,0,.12)}
.cfl-nav:disabled{opacity:.35;cursor:default}
.dark .cfl-nav{background:rgba(255,255,255,.1)}
.dark .cfl-nav:hover:not(:disabled){background:rgba(255,255,255,.18)}
.cfl-dots{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;max-width:220px}
.cfl-dot{height:8px;width:8px;padding:0;border:none;border-radius:999px;cursor:pointer;background:currentColor;opacity:.28;transition:width .3s,opacity .3s}
.cfl-dot.is-active{width:28px;opacity:1}

@media (prefers-reduced-motion:reduce){
  .cfl-track,.cfl-slide{transition:none !important}
  .cfl-frame{animation:none}
}
`;

export default function CoverflowGallerySection({
  config = {},
}: {
  config?: CoverflowGalleryConfig;
}) {
  const items = (config.items ?? []).filter(i => i?.imageUrl);
  const n = items.length;

  const base = SIZES[config.size ?? "medium"];
  const showCaption = config.showCaption ?? true;
  const autoplay = config.autoplay ?? false;
  const autoplaySeconds = Math.max(2, config.autoplaySeconds ?? 5);

  const [square, setSquare] = useState(base);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipe = useRef<{ x: number; id: number | null }>({ x: 0, id: null });

  const activeW = Math.round(square * 1.5);
  const idleW = Math.round(square * 0.35);

  // تطبیق اندازه با عرض صفحه — محاسبات جابه‌جایی به عدد پیکسلی نیاز دارند
  useEffect(() => {
    const fit = () => setSquare(Math.min(base, Math.floor(window.innerWidth * 0.55)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [base]);

  const go = useCallback(
    (delta: number) => setActive(p => Math.min(n - 1, Math.max(0, p + delta))),
    [n],
  );

  useEffect(() => {
    if (!autoplay || paused || n < 2) return;
    const t = setInterval(() => setActive(p => (p + 1) % n), autoplaySeconds * 1000);
    return () => clearInterval(t);
  }, [autoplay, paused, n, autoplaySeconds]);

  if (n === 0) return null;

  const current = items[active];

  return (
    <section dir="rtl" className="cfl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="container">
        {(config.heading || config.subheading) && (
          <div className="cfl-head">
            {config.heading && <h2 className="text-gray-900 dark:text-white">{config.heading}</h2>}
            {config.subheading && <p className="text-gray-600 dark:text-gray-400">{config.subheading}</p>}
          </div>
        )}

        <div
          className="cfl-viewport"
          role="region"
          aria-roledescription="carousel"
          aria-label={config.heading || "گالری تصاویر"}
          tabIndex={0}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onKeyDown={e => {
            if (e.key === "ArrowRight") { e.preventDefault(); go(-1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); go(1); }
            else if (e.key === "Home") { e.preventDefault(); setActive(0); }
            else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
          }}
          onPointerDown={e => { swipe.current = { x: e.clientX, id: e.pointerId }; }}
          onPointerUp={e => {
            if (swipe.current.id !== e.pointerId) return;
            const dx = e.clientX - swipe.current.x;
            swipe.current.id = null;
            if (Math.abs(dx) > 45) go(dx > 0 ? -1 : 1);
          }}
          onPointerCancel={() => { swipe.current.id = null; }}
        >
          <div className="cfl-stage" style={{ width: activeW, height: square }} dir="ltr">
            <div className="cfl-track" style={{ transform: `translate3d(${-(idleW * active)}px,0,0)` }}>
              {items.map((item, i) => {
                const dir = i < active ? 1 : i > active ? -1 : 0;
                const isActive = i === active;
                return (
                  <div key={i} className="cfl-persp" style={{ zIndex: n - Math.abs(active - i) }}>
                    <div
                      className="cfl-slide"
                      style={{
                        width: isActive ? activeW : idleW,
                        height: square,
                        transform: `rotateY(${dir * 60}deg) rotateZ(${dir * 90}deg)`,
                      }}
                    >
                      <span
                        role={isActive && item.linkUrl ? undefined : "button"}
                        tabIndex={isActive ? -1 : 0}
                        aria-label={item.title || `تصویر ${i + 1}`}
                        className="cfl-img"
                        style={{ width: square, height: square, backgroundImage: `url(${item.imageUrl})` }}
                        onClick={() => {
                          if (!isActive) { setActive(i); return; }
                          if (item.linkUrl) window.location.href = item.linkUrl;
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(i); }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              key={active}
              className="cfl-frame text-gray-900 dark:text-white"
              style={{ width: square + 16, height: square + 16 }}
              aria-hidden
            />
          </div>
        </div>

        {showCaption && (
          <div className="cfl-caption">
            {current.title && (
              <span className="cfl-caption-title text-gray-900 dark:text-white">{current.title}</span>
            )}
            {current.btnText && current.btnUrl && (
              current.btnUrl.startsWith("/") && !current.btnUrl.startsWith("//") ? (
                <Link href={current.btnUrl} className="cfl-btn bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                  {current.btnText}
                </Link>
              ) : (
                <a href={current.btnUrl} target="_blank" rel="noopener noreferrer"
                   className="cfl-btn bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                  {current.btnText}
                </a>
              )
            )}
          </div>
        )}

        <div className="cfl-controls text-gray-700 dark:text-gray-300">
          <button type="button" className="cfl-nav" onClick={() => go(-1)} disabled={active === 0} aria-label="قبلی">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>

          <div className="cfl-dots">
            {items.map((_, i) => (
              <button key={i} type="button" onClick={() => setActive(i)}
                className={`cfl-dot${i === active ? " is-active" : ""}`}
                aria-label={`تصویر ${i + 1}`} aria-current={i === active} />
            ))}
          </div>

          <button type="button" className="cfl-nav" onClick={() => go(1)} disabled={active === n - 1} aria-label="بعدی">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}