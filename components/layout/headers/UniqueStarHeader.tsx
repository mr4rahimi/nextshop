"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/store/cart/CartContext";


const C = {
  text: "#e6dcff",
  hover: "#ff8ac6",
  primary: "#ff5fb0",
  secondary: "#8b5cf6",
  border: "rgba(203,184,255,.25)",
  surface: "rgba(255,255,255,.07)",
};

const STAR_CLIP =
  "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)";

const CSS = `
.ushd-root{position:fixed;top:0;left:0;right:0;z-index:40;font-family:inherit;transition:background-color .3s,backdrop-filter .3s,box-shadow .3s}
.ushd-root.is-scrolled{background:rgba(14,10,26,.82);backdrop-filter:blur(14px);box-shadow:0 6px 24px rgba(0,0,0,.35)}
.ushd-root a{text-decoration:none;color:${C.text}}
.ushd-root a:hover{color:${C.hover}}
.ushd-icon{transition:border-color .2s}
.ushd-icon:hover{border-color:rgba(255,95,176,.7)}
.ushd-search{transition:border-color .2s}
.ushd-search:focus-within{border-color:rgba(255,95,176,.6)}
.ushd-search input::placeholder{color:${C.text};opacity:.55}
@media (max-width:768px){.ushd-search-wrap{display:none}}
`;

export default function UniqueStarHeader({
  logoUrl,
  siteName,
}: {
  logoUrl: string | null;
  siteName: string | null;
}) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");

  // سبد خرید — اگر Provider در دسترس نبود، هدر نباید بشکند
  let cartCount = 0;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    cartCount = useCart().count ?? 0;
  } catch {
    cartCount = 0;
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  const iconBox: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "clamp(36px,4vw,42px)",
    height: "clamp(36px,4vw,42px)",
    borderRadius: "50%",
    background: C.surface,
    border: `1px solid ${C.border}`,
    backdropFilter: "blur(6px)",
  };

  return (
    <header dir="rtl" className={`ushd-root ${scrolled ? "is-scrolled" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(10px,2.5vw,28px)",
          width: "100%",
          padding: "clamp(10px,1.6vw,18px) clamp(14px,3vw,40px)",
          boxSizing: "border-box",
        }}
      >
        {/* منوی موبایل + لوگو */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("toggle-mobile-menu"))}
            aria-label="منو"
            style={{ ...iconBox, cursor: "pointer" }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round">
              <path d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>

          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }} aria-label={siteName ?? "صفحه اصلی"}>
            {logoUrl ? (
              <Image
                src={logoUrl}
                width={112}
                height={40}
                alt={siteName || "فروشگاه"}
                priority
                style={{ height: 40, width: "auto", objectFit: "contain" }}
              />
            ) : (
              <>
                <span
                  aria-hidden
                  style={{
                    width: "clamp(34px,4vw,44px)",
                    height: "clamp(34px,4vw,44px)",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.secondary} 0%, ${C.primary} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 16px ${C.primary}73`,
                  }}
                >
                  <span style={{ width: "55%", height: "55%", background: "#14102a", clipPath: STAR_CLIP, display: "block" }} />
                </span>
                <span style={{ fontSize: "clamp(15px,1.6vw,19px)", fontWeight: 800, whiteSpace: "nowrap", color: C.text }}>
                  {siteName || "فروشگاه"}
                </span>
              </>
            )}
          </Link>
        </div>

        {/* جستجو */}
        <div className="ushd-search-wrap" style={{ flex: "1 1 auto", display: "flex", justifyContent: "center", minWidth: 0 }}>
          <form
            onSubmit={submitSearch}
            className="ushd-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "min(480px,100%)",
              padding: "clamp(8px,1vw,11px) 16px",
              borderRadius: 999,
              background: C.surface,
              border: `1px solid ${C.border}`,
              backdropFilter: "blur(6px)",
            }}
          >
            <button type="submit" aria-label="جستجو" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0, flex: "0 0 auto" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b48cff" strokeWidth={2.2} strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
            </button>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="جستجو..."
              aria-label="جستجوی محصولات"
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                outline: "none",
                color: C.text,
                fontSize: 14,
                fontFamily: "inherit",
              }}
            />
          </form>
        </div>

        {/* حساب کاربری + سبد */}
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px,1.2vw,14px)", flex: "0 0 auto" }}>
          {/* جستجوی موبایل */}
          <Link href="/search" title="جستجو" aria-label="جستجو" className="ushd-icon md:hidden" style={iconBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </Link>

          <Link href="/user" title="حساب کاربری" aria-label="حساب کاربری" className="ushd-icon" style={iconBox}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
          </Link>

          <Link href="/cart" title="سبد خرید" aria-label="سبد خرید" className="ushd-icon" style={{ ...iconBox, position: "relative" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="17" cy="20" r="1.6" />
              <path d="M2.5 3h2.5l2.6 12.5h9.9l2-8.5H6" />
            </svg>
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 999,
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cartCount.toLocaleString("fa-IR")}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}