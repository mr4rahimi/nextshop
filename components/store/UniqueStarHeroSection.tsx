"use client";

import Link from "next/link";

/* ────────────────────────────────────────────────────────────────────────────
 * ویجت هرو «یونیک استار»
 *
 * تبدیل‌شده از فایل طراحی (dc.html) به React خالص — بدون هیچ runtime خارجی.
 * تمام رنگ‌ها، متن‌ها و لینک‌ها از config پنل ادمین خوانده می‌شوند.
 *
 * نکات پیاده‌سازی:
 *  - انیمیشن‌ها با پیشوند یکتای `ush-` تعریف شده‌اند تا با CSS سایت تداخل نکنند.
 *  - رنگ‌ها از طریق CSS variable روی ریشه تزریق می‌شوند (بدون re-render اضافه).
 *  - فونت از سایت به ارث می‌رسد (font-family: inherit) — بدون Google Fonts.
 *  - با prefers-reduced-motion همه‌ی انیمیشن‌ها خاموش می‌شوند.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface UniqueStarHangingLink {
  text: string;
  url: string;
  /** یکی از: primary | secondary | accent — رنگ نئون تابلو */
  tone?: "primary" | "secondary" | "accent";
}

export interface UniqueStarHeroConfig {
  // ── محتوا
  brandLabel?: string;
  heading?: string;
  subheading?: string;
  description?: string;
  btnText?: string;
  btnUrl?: string;
  hangingLinks?: UniqueStarHangingLink[];

  // ── رنگ‌ها
  bgFrom?: string;
  bgMid?: string;
  bgTo?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  colorAccent?: string;
  colorText?: string;
  colorMuted?: string;

  // ── نمایش/عناصر
  showParticles?: boolean;
  showMoon?: boolean;
  showMeteors?: boolean;
  showClock?: boolean;
  showHangingLinks?: boolean;

  /** ارتفاع بخش */
  height?: "full" | "large" | "medium";
  /** فضای خالی بالا برای هدر شفافی که روی بنر می‌افتد */
  headerOverlay?: boolean;
}

const DEFAULTS: Required<Omit<UniqueStarHeroConfig, "hangingLinks">> & {
  hangingLinks: UniqueStarHangingLink[];
} = {
  brandLabel: "Unique Star",
  heading: "یونیک استار",
  subheading: "انواع تابلو و لگوهای خاص",
  description: "تابلو دکوراتیو، ساعت لگویی و طرح‌های اختصاصی با سلیقه‌ی تو",
  btnText: "مشاهده محصولات",
  btnUrl: "/products",
  hangingLinks: [
    { text: "درباره ما", url: "#", tone: "primary" },
    { text: "پیج اینستاگرام", url: "#", tone: "secondary" },
    { text: "ارتباط با ما", url: "#", tone: "secondary" },
    { text: "تخفیف‌ها ✦", url: "#", tone: "accent" },
  ],
  bgFrom: "#2a1650",
  bgMid: "#17102e",
  bgTo: "#0e0a1a",
  colorPrimary: "#ff5fb0",
  colorSecondary: "#8b5cf6",
  colorAccent: "#ff8ac6",
  colorText: "#e6dcff",
  colorMuted: "#9d8ec4",
  showParticles: true,
  showMoon: true,
  showMeteors: true,
  showClock: true,
  showHangingLinks: true,
  height: "full",
  headerOverlay: true,
};

const HEIGHTS: Record<NonNullable<UniqueStarHeroConfig["height"]>, string> = {
  full: "100svh",
  large: "min(760px, 88svh)",
  medium: "min(560px, 70svh)",
};

/** آیا لینک داخلی است؟ (برای انتخاب بین Link و <a>) */
function isInternal(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

function Anchor({
  href,
  style,
  className,
  children,
}: {
  href: string;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href || href === "#") {
    return (
      <span style={style} className={className}>
        {children}
      </span>
    );
  }
  if (isInternal(href)) {
    return (
      <Link href={href} style={style} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style} className={className}>
      {children}
    </a>
  );
}

const STAR_CLIP =
  "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)";

/* ─── CSS اختصاصی ویجت ────────────────────────────────────────────────────── */
const CSS = `
.ush-root{position:relative;width:100%;overflow:hidden;font-family:inherit;display:flex;align-items:center;justify-content:center;isolation:isolate}
.ush-root a{text-decoration:none}
.ush-cta:hover{transform:scale(1.05)}
.ush-neon:hover{color:#fff !important}
@keyframes ush-spinSlow{to{transform:rotate(360deg)}}
@keyframes ush-spinFast{to{transform:rotate(360deg)}}
@keyframes ush-float{0%,100%{transform:translateY(0) rotate(var(--ush-rot,0deg))}50%{transform:translateY(-18px) rotate(var(--ush-rot,0deg))}}
@keyframes ush-pulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
@keyframes ush-twinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
@keyframes ush-shine{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes ush-glowBtn{0%,100%{box-shadow:0 0 18px 2px var(--ush-glow-a),0 0 40px 6px var(--ush-glow-b)}50%{box-shadow:0 0 30px 6px var(--ush-glow-a),0 0 60px 12px var(--ush-glow-b)}}
@keyframes ush-starPop{0%,100%{transform:rotate(-8deg) scale(1)}50%{transform:rotate(8deg) scale(1.08)}}
@keyframes ush-drift{0%{transform:translateX(0)}50%{transform:translateX(14px)}100%{transform:translateX(0)}}
@keyframes ush-shoot{0%{transform:translate(0,0) rotate(-35deg);opacity:0}5%{opacity:1}22%{transform:translate(-52vw,30vh) rotate(-35deg);opacity:0}100%{transform:translate(-52vw,30vh) rotate(-35deg);opacity:0}}
@keyframes ush-moonBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes ush-orbit{to{transform:rotate(360deg)}}
@keyframes ush-aurora{0%,100%{transform:translateX(-6%) skewX(-8deg);opacity:.5}50%{transform:translateX(6%) skewX(8deg);opacity:.9}}
@keyframes ush-neonFlicker{0%,18%,22%,25%,53%,57%,100%{opacity:1}20%,24%,55%{opacity:.35}}
@keyframes ush-rise{0%{transform:translateY(0) scale(1);opacity:0}10%{opacity:.8}100%{transform:translateY(-58vh) scale(.5);opacity:0}}
@keyframes ush-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@media (prefers-reduced-motion: reduce){
  .ush-root *,.ush-root *::before,.ush-root *::after{animation:none !important;transition:none !important}
}
`;

/* ─── کامپوننت ───────────────────────────────────────────────────────────── */
export default function UniqueStarHeroSection({
  config = {},
}: {
  config?: UniqueStarHeroConfig;
}) {
  const c = { ...DEFAULTS, ...config };
  const links = (config.hangingLinks?.length ? config.hangingLinks : DEFAULTS.hangingLinks).slice(0, 6);

  const toneColor = (t: UniqueStarHangingLink["tone"]) =>
    t === "secondary" ? c.colorSecondary : t === "accent" ? c.colorAccent : c.colorPrimary;

  const rootVars = {
    "--ush-p": c.colorPrimary,
    "--ush-s": c.colorSecondary,
    "--ush-a": c.colorAccent,
    "--ush-t": c.colorText,
    "--ush-m": c.colorMuted,
    "--ush-glow-a": `${c.colorPrimary}73`,
    "--ush-glow-b": `${c.colorSecondary}40`,
    minHeight: HEIGHTS[c.height],
    background: `radial-gradient(1200px 600px at 78% 30%, ${c.bgFrom} 0%, ${c.bgMid} 45%, ${c.bgTo} 100%)`,
  } as React.CSSProperties;

  const padTop = c.headerOverlay ? "clamp(150px,24vh,220px)" : "clamp(56px,10vh,96px)";

  return (
    <section dir="rtl" className="ush-root" style={rootVars} aria-label={c.heading}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── شفق پس‌زمینه ─────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden>
        <div
          style={{
            position: "absolute", top: "-12%", left: "-10%", width: "70%", height: "60%",
            background: `radial-gradient(ellipse at center, ${c.colorSecondary}38, transparent 65%)`,
            filter: "blur(30px)", animation: "ush-aurora 11s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute", bottom: "-15%", right: "-8%", width: "65%", height: "55%",
            background: `radial-gradient(ellipse at center, ${c.colorPrimary}29, transparent 65%)`,
            filter: "blur(30px)", animation: "ush-aurora 13s ease-in-out 2s infinite",
          }}
        />
      </div>

      {/* ── ماه ──────────────────────────────────────────────────────── */}
      {c.showMoon && (
        <div
          aria-hidden
          style={{
            position: "absolute", top: "clamp(76px,13%,120px)", left: "2.5%",
            pointerEvents: "none", animation: "ush-moonBob 8s ease-in-out infinite",
          }}
        >
          <div style={{ position: "relative", width: "clamp(56px,7vw,90px)", aspectRatio: "1" }}>
            <div
              style={{
                position: "absolute", inset: "-35%", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(230,220,255,.35), rgba(180,140,255,.12) 55%, transparent 75%)",
                animation: "ush-pulse 6s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "radial-gradient(circle at 32% 30%, #fdf7ff 0%, #e9dcff 45%, #c3aaf2 100%)",
                boxShadow: "0 0 40px rgba(210,185,255,.55), inset -10px -12px 24px rgba(120,80,200,.35)",
              }}
            >
              <span style={{ position: "absolute", top: "24%", left: "52%", width: "16%", height: "16%", borderRadius: "50%", background: "rgba(150,115,220,.35)", boxShadow: "inset 2px 2px 4px rgba(90,60,160,.4)" }} />
              <span style={{ position: "absolute", top: "56%", left: "28%", width: "11%", height: "11%", borderRadius: "50%", background: "rgba(150,115,220,.3)", boxShadow: "inset 2px 2px 3px rgba(90,60,160,.35)" }} />
              <span style={{ position: "absolute", top: "44%", left: "62%", width: "8%", height: "8%", borderRadius: "50%", background: "rgba(150,115,220,.28)" }} />
            </div>
            <div style={{ position: "absolute", inset: "-28%", animation: "ush-orbit 14s linear infinite" }}>
              <span
                style={{
                  position: "absolute", top: 0, left: "50%", width: 10, height: 10, marginLeft: -5,
                  background: c.colorAccent, clipPath: STAR_CLIP,
                  filter: `drop-shadow(0 0 6px ${c.colorAccent}e6)`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── شهاب‌ها ──────────────────────────────────────────────────── */}
      {c.showMeteors && (
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute", top: "12%", right: "6%", width: 110, height: 2, borderRadius: 2,
              background: `linear-gradient(90deg, #ffffff, ${c.colorAccent}b3, transparent)`,
              boxShadow: "0 0 8px rgba(255,255,255,.7)", animation: "ush-shoot 9s linear 1s infinite",
            }}
          />
          <div
            style={{
              position: "absolute", top: "34%", right: "-4%", width: 80, height: 2, borderRadius: 2,
              background: `linear-gradient(90deg, #ffffff, ${c.colorSecondary}b3, transparent)`,
              boxShadow: "0 0 8px rgba(255,255,255,.6)", animation: "ush-shoot 12s linear 5.5s infinite",
            }}
          />
        </div>
      )}

      {/* ── حباب‌های نور ─────────────────────────────────────────────── */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {[
          { left: "18%", size: 8, color: `${c.colorPrimary}cc`, dur: "9s", delay: "0s" },
          { left: "46%", size: 6, color: `${c.colorSecondary}cc`, dur: "11s", delay: "3s" },
          { left: "72%", size: 9, color: `${c.colorSecondary}cc`, dur: "10s", delay: "6s" },
          { left: "88%", size: 5, color: `${c.colorAccent}cc`, dur: "13s", delay: "1.5s" },
        ].map((b, i) => (
          <span
            key={i}
            style={{
              position: "absolute", bottom: "-3%", left: b.left, width: b.size, height: b.size,
              borderRadius: "50%", background: b.color, filter: "blur(1px)",
              animation: `ush-rise ${b.dur} linear ${b.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* ── ذرات و ستاره‌ها + آجرهای لگویی ──────────────────────────── */}
      {c.showParticles && (
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[
            { top: "9%", right: "28%", size: 12, color: "#ffffff", dur: "3.6s", delay: "0s" },
            { top: "30%", left: "30%", size: 9, color: c.colorAccent, dur: "2.8s", delay: "1s" },
            { top: "64%", right: "34%", size: 10, color: c.colorSecondary, dur: "4.2s", delay: "2s" },
            { top: "84%", right: "40%", size: 8, color: "#ffffff", dur: "3.1s", delay: ".5s" },
          ].map((s, i) => (
            <span
              key={`st${i}`}
              style={{
                position: "absolute", top: s.top, right: s.right, left: s.left,
                width: s.size, height: s.size, background: s.color, clipPath: STAR_CLIP,
                filter: `drop-shadow(0 0 5px ${s.color}e6)`,
                animation: `ush-twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
              }}
            />
          ))}
          {[
            { top: "14%", right: "8%", size: 6, color: c.colorPrimary, dur: "2.6s", delay: "0s" },
            { top: "70%", right: "16%", size: 4, color: c.colorSecondary, dur: "3.4s", delay: ".8s" },
            { top: "22%", left: "12%", size: 5, color: c.colorAccent, dur: "3s", delay: ".4s" },
            { top: "80%", left: "22%", size: 6, color: c.colorSecondary, dur: "2.2s", delay: "1.2s" },
            { top: "48%", right: "44%", size: 4, color: "#ffffff", dur: "4s", delay: ".6s" },
            { top: "10%", left: "40%", size: 4, color: c.colorPrimary, dur: "3.2s", delay: "1.6s" },
          ].map((d, i) => (
            <span
              key={`dt${i}`}
              style={{
                position: "absolute", top: d.top, right: d.right, left: d.left,
                width: d.size, height: d.size, borderRadius: "50%", background: d.color,
                animation: `ush-twinkle ${d.dur} ease-in-out ${d.delay} infinite`,
              }}
            />
          ))}

          {/* آجرهای لگویی شناور */}
          <div style={{ ["--ush-rot" as string]: "-14deg", position: "absolute", bottom: "3%", left: "1%", animation: "ush-float 7s ease-in-out infinite" }}>
            <div style={{ display: "flex", gap: 6, padding: "0 7px" }}>
              <span style={{ width: 12, height: 7, background: c.colorPrimary, borderRadius: "3px 3px 0 0", display: "block" }} />
              <span style={{ width: 12, height: 7, background: c.colorPrimary, borderRadius: "3px 3px 0 0", display: "block" }} />
            </div>
            <div style={{ width: 56, height: 24, background: `linear-gradient(180deg, ${c.colorPrimary}, ${c.colorPrimary}cc)`, borderRadius: 5, boxShadow: `0 6px 16px ${c.colorPrimary}59` }} />
          </div>
          <div style={{ ["--ush-rot" as string]: "10deg", position: "absolute", top: "15%", right: "1%", animation: "ush-float 8.5s ease-in-out 1s infinite" }}>
            <div style={{ display: "flex", gap: 6, padding: "0 7px" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 12, height: 7, background: c.colorSecondary, borderRadius: "3px 3px 0 0", display: "block" }} />
              ))}
            </div>
            <div style={{ width: 80, height: 26, background: `linear-gradient(180deg, ${c.colorSecondary}, ${c.colorSecondary}cc)`, borderRadius: 5, boxShadow: `0 6px 18px ${c.colorSecondary}66` }} />
          </div>
        </div>
      )}

      {/* ── تابلوهای نئون آویزان ─────────────────────────────────────── */}
      {c.showHangingLinks && links.length > 0 && (
        <div
          style={{
            position: "absolute", top: c.headerOverlay ? 72 : 8, left: "50%",
            transform: "translateX(-50%)", display: "flex",
            gap: "clamp(10px,3vw,36px)", zIndex: 5,
          }}
        >
          {links.map((l, i) => {
            const col = toneColor(l.tone);
            const heights = ["clamp(38px,6vh,64px)", "clamp(50px,8vh,84px)", "clamp(44px,7vh,72px)", "clamp(34px,5.5vh,58px)"];
            const durs = ["5.5s", "6.5s", "5s", "6s"];
            const delays = ["0s", ".8s", "1.6s", ".4s"];
            return (
              <div
                key={i}
                style={{
                  transformOrigin: "50% 0",
                  animation: `ush-sway ${durs[i % 4]} ease-in-out ${delays[i % 4]} infinite`,
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}
              >
                <div style={{ width: 2, height: heights[i % 4], background: "linear-gradient(180deg, rgba(203,184,255,0), rgba(203,184,255,.7))" }} />
                <Anchor
                  href={l.url}
                  className="ush-neon"
                  style={{
                    padding: "clamp(6px,1vw,10px) clamp(10px,2vw,22px)",
                    borderRadius: 12,
                    background: "rgba(29,20,53,.85)",
                    border: `2px solid ${col}`,
                    boxShadow: `0 0 18px ${col}99, inset 0 0 14px ${col}40`,
                    color: col,
                    fontSize: "clamp(11px,1.7vw,15px)",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    textShadow: `0 0 10px ${col}e6`,
                    animation: `ush-neonFlicker ${8 + i}s linear ${i}s infinite`,
                    transition: "color .2s",
                  }}
                >
                  {l.text}
                </Anchor>
              </div>
            );
          })}
        </div>
      )}

      {/* ── محتوای اصلی ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative", zIndex: 2, display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: "center", gap: 48,
          width: "100%", maxWidth: 1240,
          padding: `${padTop} 32px 56px`, boxSizing: "border-box",
        }}
      >
        {/* متن */}
        <div style={{ flex: "1 1 380px", minWidth: 300, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
          {c.brandLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 58, height: 58, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${c.colorSecondary} 0%, ${c.colorPrimary} 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 26px ${c.colorPrimary}80`,
                  animation: "ush-pulse 4s ease-in-out infinite",
                }}
              >
                <div style={{ width: 30, height: 30, background: "#14102a", clipPath: STAR_CLIP, animation: "ush-starPop 5s ease-in-out infinite" }} />
              </div>
              <span style={{ color: "var(--ush-t)", opacity: 0.85, fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>
                {c.brandLabel}
              </span>
            </div>
          )}

          {c.heading && (
            <h2
              style={{
                margin: 0, fontSize: "clamp(34px,5vw,60px)", fontWeight: 900, lineHeight: 1.25,
                background: `linear-gradient(90deg, ${c.colorPrimary}, ${c.colorSecondary}, ${c.colorAccent}, ${c.colorPrimary})`,
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text", backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "ush-shine 6s linear infinite",
              }}
            >
              {c.heading}
            </h2>
          )}

          {c.subheading && (
            <p
              style={{
                margin: 0, color: "var(--ush-t)", fontSize: "clamp(18px,2.4vw,26px)",
                fontWeight: 600, lineHeight: 1.8,
                textShadow: `0 0 14px ${c.colorPrimary}8c, 0 0 30px ${c.colorSecondary}59`,
                animation: "ush-neonFlicker 7s linear infinite",
              }}
            >
              {c.subheading}
            </p>
          )}

          {c.description && (
            <p style={{ margin: 0, color: "var(--ush-m)", fontSize: "clamp(14px,1.6vw,17px)", lineHeight: 2 }}>
              {c.description}
            </p>
          )}

          {c.btnText && (
            <Anchor
              href={c.btnUrl}
              className="ush-cta"
              style={{
                display: "inline-block", marginTop: 8, padding: "14px 40px", borderRadius: 999,
                whiteSpace: "nowrap",
                background: `linear-gradient(90deg, ${c.colorSecondary}, ${c.colorPrimary})`,
                color: "#ffffff", fontSize: 18, fontWeight: 800,
                animation: "ush-glowBtn 3s ease-in-out infinite",
                transition: "transform .2s",
              }}
            >
              {c.btnText}
            </Anchor>
          )}
        </div>

        {/* ساعت لگویی */}
        {c.showClock && (
          <div aria-hidden style={{ flex: "0 1 380px", minWidth: 280, display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "clamp(260px,32vw,360px)", aspectRatio: "1", animation: "ush-drift 9s ease-in-out infinite" }}>
              <div
                style={{
                  position: "absolute", inset: "-6%", borderRadius: "50%",
                  background: `radial-gradient(circle, ${c.colorPrimary}47, ${c.colorSecondary}1f 55%, transparent 72%)`,
                  animation: "ush-pulse 4.5s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  position: "absolute", inset: 0, borderRadius: "50%", background: "#1d1435",
                  border: "10px solid #2e2052",
                  boxShadow: `0 20px 60px rgba(0,0,0,.55), 0 0 40px ${c.colorSecondary}59, inset 0 0 30px rgba(0,0,0,.5)`,
                }}
              >
                <div
                  style={{
                    position: "absolute", inset: 14, borderRadius: "50%",
                    backgroundColor: "#241a44",
                    backgroundImage: "radial-gradient(circle at 11px 11px, rgba(255,255,255,.14) 5px, transparent 6px)",
                    backgroundSize: "22px 22px", overflow: "hidden",
                  }}
                >
                  {/* اعداد */}
                  <span style={{ position: "absolute", top: "6%", left: "50%", transform: "translateX(-50%)", color: c.colorAccent, fontSize: 26, fontWeight: 900, textShadow: `0 0 12px ${c.colorPrimary}cc` }}>۱۲</span>
                  <span style={{ position: "absolute", top: "50%", left: "7%", transform: "translateY(-50%)", color: c.colorSecondary, fontSize: 26, fontWeight: 900, textShadow: `0 0 12px ${c.colorSecondary}cc` }}>۹</span>
                  <span style={{ position: "absolute", bottom: "5%", left: "50%", transform: "translateX(-50%)", color: c.colorAccent, fontSize: 26, fontWeight: 900, textShadow: `0 0 12px ${c.colorPrimary}cc` }}>۶</span>
                  <span style={{ position: "absolute", top: "50%", right: "7%", transform: "translateY(-50%)", color: c.colorSecondary, fontSize: 26, fontWeight: 900, textShadow: `0 0 12px ${c.colorSecondary}cc` }}>۳</span>

                  {/* آجرک‌های ساعت */}
                  {[
                    { top: "16%", right: "25%", rot: 30, col: c.colorPrimary },
                    { top: "27%", right: "12%", rot: 60, col: c.colorSecondary },
                    { bottom: "27%", right: "12%", rot: -60, col: c.colorPrimary },
                    { bottom: "16%", right: "25%", rot: -30, col: c.colorSecondary },
                    { bottom: "16%", left: "25%", rot: 30, col: c.colorPrimary },
                    { bottom: "27%", left: "12%", rot: 60, col: c.colorSecondary },
                    { top: "27%", left: "12%", rot: -60, col: c.colorPrimary },
                    { top: "16%", left: "25%", rot: -30, col: c.colorSecondary },
                  ].map((b, i) => (
                    <span
                      key={i}
                      style={{
                        position: "absolute", top: b.top, bottom: b.bottom, left: b.left, right: b.right,
                        width: 20, height: 11, borderRadius: 3, background: b.col,
                        boxShadow: `0 0 8px ${b.col}99`, transform: `rotate(${b.rot}deg)`,
                      }}
                    />
                  ))}

                  {/* عقربه‌ها */}
                  <div style={{ position: "absolute", inset: 0, animation: "ush-spinSlow 60s linear infinite" }}>
                    <div style={{ position: "absolute", left: "50%", bottom: "50%", width: 8, height: "26%", marginLeft: -4, borderRadius: 4, background: `linear-gradient(180deg, ${c.colorPrimary}, ${c.colorPrimary}99)`, boxShadow: `0 0 10px ${c.colorPrimary}b3`, transformOrigin: "50% 100%" }} />
                  </div>
                  <div style={{ position: "absolute", inset: 0, animation: "ush-spinFast 10s linear infinite" }}>
                    <div style={{ position: "absolute", left: "50%", bottom: "50%", width: 5, height: "36%", marginLeft: -2.5, borderRadius: 3, background: `linear-gradient(180deg, ${c.colorText}, ${c.colorSecondary})`, boxShadow: `0 0 10px ${c.colorSecondary}b3`, transformOrigin: "50% 100%" }} />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", width: 16, height: 16, margin: "-8px 0 0 -8px", borderRadius: "50%", background: `linear-gradient(135deg, ${c.colorPrimary}, ${c.colorSecondary})`, boxShadow: `0 0 12px ${c.colorPrimary}e6` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}