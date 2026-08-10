"use client";

import Link from "next/link";

/* ────────────────────────────────────────────────────────────────────────────
 * ویجت «کارت‌های سه‌بعدی» (Dimensional Cards)
 *
 * تبدیل‌شده از CodePen به React خالص و راست‌چین:
 *  - آیکن‌های شبکه‌های اجتماعی حذف شده‌اند
 *  - آیکن SVG داخل کوچک‌ترین دایره با تصویر PNG قابل آپلود جایگزین شده
 *  - دکمه‌ی Open به دکمه‌ی قابل ویرایش با لینک تبدیل شده
 *  - چیدمان با ویژگی‌های منطقی (inline-start/end) آینه شده تا در RTL درست بنشیند
 *
 * تمام کلاس‌ها با پیشوند dcards- هستند تا با CSS سایت تداخل نکنند.
 * ──────────────────────────────────────────────────────────────────────────── */

export type DCardTheme = "mint" | "violet" | "solar" | "ocean" | "prism" | "void";
export type DCardShape = "rounded" | "chamfer";

export interface DCard {
  title?: string;
  text?: string;
  imageUrl?: string;
  btnText?: string;
  btnUrl?: string;
  theme?: DCardTheme;
  shape?: DCardShape;
}

export interface DimensionalCardsConfig {
  heading?: string;
  subheading?: string;
  cards?: DCard[];
}

export const DCARD_THEMES: { value: DCardTheme; label: string; swatch: string }[] = [
  { value: "mint",   label: "سبز نعنایی", swatch: "linear-gradient(135deg,#00ffd6,#08e260)" },
  { value: "violet", label: "بنفش",       swatch: "linear-gradient(145deg,#a855f7,#6366f1 40%,#ec4899)" },
  { value: "solar",  label: "نارنجی",     swatch: "linear-gradient(135deg,#fbbf24,#f97316 45%,#dc2626)" },
  { value: "ocean",  label: "آبی",        swatch: "linear-gradient(155deg,#22d3ee,#0284c7 50%,#1e3a8a)" },
  { value: "prism",  label: "رنگین‌کمان", swatch: "conic-gradient(from 200deg at 65% 35%,#22d3ee,#818cf8,#f472b6,#facc15,#22d3ee)" },
  { value: "void",   label: "تیره",       swatch: "linear-gradient(160deg,#0f172a,#1e1b4b 50%,#312e81)" },
];

export const DCARD_SHAPES: { value: DCardShape; label: string }[] = [
  { value: "rounded", label: "گوشه گرد" },
  { value: "chamfer", label: "گوشه پخ" },
];

const DEFAULT_CARDS: DCard[] = [
  { title: "کیفیت شیشه‌ای", text: "بدنه‌ی نرم با لایه‌های شیشه‌ای و عمق حلقوی.", btnText: "مشاهده محصولات", btnUrl: "/products", theme: "mint",   shape: "rounded" },
  { title: "برش دقیق",     text: "گوشه‌های پخ‌دار — روی زمینه‌ی تیره تیز و شفاف دیده می‌شود.", btnText: "مشاهده محصولات", btnUrl: "/products", theme: "violet", shape: "chamfer" },
  { title: "سطح مدرن",     text: "کنتراست بالا، سایه‌ی سخت و ریل رنگی برجسته.", btnText: "مشاهده محصولات", btnUrl: "/products", theme: "solar",  shape: "rounded" },
];

function isInternal(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

function CardButton({ href, children }: { href: string; children: React.ReactNode }) {
  const inner = (
    <>
      <span>{children}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="dcards-chev">
        <path d="m15 6-6 6 6 6" />
      </svg>
    </>
  );
  if (!href || href === "#") return <span className="dcards-btn">{inner}</span>;
  if (isInternal(href)) return <Link href={href} className="dcards-btn">{inner}</Link>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className="dcards-btn">{inner}</a>;
}

const CSS = `
.dcards-root{width:100%;font-family:inherit}
.dcards-head{text-align:center;margin-bottom:clamp(1.5rem,4vw,2.5rem);padding-inline:1rem}
.dcards-head h2{margin:0 0 .5rem;font-size:clamp(1.4rem,3vw,1.85rem);font-weight:900;letter-spacing:-.02em}
.dcards-head p{margin:0 auto;max-width:38rem;font-size:1rem;line-height:1.8;opacity:.7}

.dcards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,288px),1fr));gap:clamp(1.1rem,2.8vw,1.65rem);align-items:stretch}
@media (min-width:900px){.dcards-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}

.dcards-parent{width:100%;max-width:400px;height:300px;margin-inline:auto;perspective:1000px;perspective-origin:50% 50%;filter:drop-shadow(0 22px 40px rgba(0,0,0,.28))}
.dcards-card{position:relative;height:100%;border-radius:50px;background:var(--dc-grad);transform-style:preserve-3d;transition:transform .55s cubic-bezier(.22,1,.36,1),box-shadow .55s ease;box-shadow:rgba(5,71,17,0) 40px 50px 25px -40px,rgba(5,71,17,.28) 0 25px 25px -5px}
.dcards-parent:hover .dcards-card{transform:rotate3d(1,1,0,28deg);box-shadow:rgba(5,71,17,.45) 28px 48px 28px -38px,rgba(0,0,0,.12) 0 0 60px -10px}

.dcards-parent.is-cut .dcards-card{border-radius:36px;clip-path:polygon(16px 0,calc(100% - 16px) 0,100% 16px,100% calc(100% - 16px),calc(100% - 16px) 100%,16px 100%,0 calc(100% - 16px),0 16px)}
.dcards-parent.is-cut .dcards-glass{border-radius:32px !important;clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px),0 14px)}

.dcards-glass{position:absolute;inset:8px;border-radius:55px;border-start-start-radius:100%;transform-style:preserve-3d;background:linear-gradient(0deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,.82) 100%);transform:translate3d(0,0,25px);border-inline-end:1px solid rgba(255,255,255,.85);border-bottom:1px solid rgba(255,255,255,.75);transition:all .5s ease-in-out;pointer-events:none}

.dcards-logo{position:absolute;inset-inline-end:0;top:0;transform-style:preserve-3d;pointer-events:none;z-index:2}
.dcards-circle{display:block;position:absolute;aspect-ratio:1;border-radius:50%;top:0;inset-inline-end:0;background:var(--dc-orbit);box-shadow:rgba(100,100,111,.25) -10px 10px 24px 0;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:all .5s ease-in-out}
.dcards-circle:nth-child(1){width:170px;transform:translate3d(0,0,20px);top:8px;inset-inline-end:8px}
.dcards-circle:nth-child(2){width:140px;transform:translate3d(0,0,40px);top:10px;inset-inline-end:10px;backdrop-filter:blur(4px);transition-delay:.05s}
.dcards-circle:nth-child(3){width:110px;transform:translate3d(0,0,60px);top:17px;inset-inline-end:17px;transition-delay:.1s}
.dcards-circle:nth-child(4){width:80px;transform:translate3d(0,0,80px);top:23px;inset-inline-end:23px;transition-delay:.15s}
.dcards-circle:nth-child(5){width:50px;transform:translate3d(0,0,100px);top:30px;inset-inline-end:30px;display:grid;place-content:center;transition-delay:.2s;overflow:hidden}
.dcards-circle--img img{width:30px;height:30px;object-fit:contain;display:block}
.dcards-parent:hover .dcards-circle:nth-child(2){transform:translate3d(0,0,60px)}
.dcards-parent:hover .dcards-circle:nth-child(3){transform:translate3d(0,0,80px)}
.dcards-parent:hover .dcards-circle:nth-child(4){transform:translate3d(0,0,100px)}
.dcards-parent:hover .dcards-circle:nth-child(5){transform:translate3d(0,0,120px)}

.dcards-content{padding-block-start:100px;padding-inline-end:3.75rem;padding-inline-start:1.85rem;transform:translate3d(0,0,26px);position:relative;z-index:3;text-align:start}
.dcards-title{display:block;color:var(--dc-title);font-weight:900;font-size:1.25rem;letter-spacing:-.02em;line-height:1.7}
.dcards-text{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:.85rem;color:var(--dc-body);font-size:.95rem;line-height:1.9;font-weight:600}

.dcards-bottom{position:absolute;bottom:20px;inset-inline-start:20px;inset-inline-end:20px;display:flex;align-items:center;justify-content:flex-start;padding:10px 12px;transform-style:preserve-3d;transform:translate3d(0,0,26px);z-index:4}
.dcards-btn{display:inline-flex;align-items:center;gap:4px;color:var(--dc-cta);font-weight:800;font-size:.78rem;text-decoration:none;transition:transform .2s ease;font-family:inherit}
.dcards-btn:hover{transform:translate3d(0,0,10px)}
.dcards-chev{width:18px;max-height:15px;fill:none;stroke:var(--dc-cta);stroke-width:3px;stroke-linecap:round;stroke-linejoin:round}

.dcards-t-mint{--dc-grad:linear-gradient(135deg,rgb(0,255,214) 0%,rgb(8,226,96) 100%);--dc-title:#00894d;--dc-body:rgba(0,137,78,.82);--dc-cta:#00a566;--dc-orbit:rgba(0,249,203,.22)}
.dcards-t-violet{--dc-grad:linear-gradient(145deg,#a855f7 0%,#6366f1 40%,#ec4899 100%);--dc-title:#3b0764;--dc-body:rgba(59,7,100,.85);--dc-cta:#6d28d9;--dc-orbit:rgba(216,180,254,.35)}
.dcards-t-solar{--dc-grad:linear-gradient(135deg,#fbbf24 0%,#f97316 45%,#dc2626 100%);--dc-title:#7c2d12;--dc-body:rgba(124,45,18,.88);--dc-cta:#9a3412;--dc-orbit:rgba(254,243,199,.4)}
.dcards-t-ocean{--dc-grad:linear-gradient(155deg,#22d3ee 0%,#0284c7 50%,#1e3a8a 100%);--dc-title:#0c4a6e;--dc-body:rgba(12,74,110,.88);--dc-cta:#0369a1;--dc-orbit:rgba(125,211,252,.35)}
.dcards-t-prism{--dc-grad:conic-gradient(from 200deg at 65% 35%,#22d3ee,#818cf8,#f472b6,#facc15,#22d3ee);--dc-title:#0f172a;--dc-body:rgba(15,23,42,.88);--dc-cta:#4338ca;--dc-orbit:rgba(255,255,255,.35)}
.dcards-t-void{--dc-grad:linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%);--dc-title:#5eead4;--dc-body:rgba(203,213,225,.82);--dc-cta:#c084fc;--dc-orbit:rgba(167,139,250,.25)}
.dcards-t-void .dcards-glass{background:linear-gradient(180deg,rgba(255,255,255,.12) 0%,rgba(15,23,42,.55) 100%);border-color:rgba(148,163,184,.25)}

@media (prefers-reduced-motion:reduce){
  .dcards-root *{transition:none !important}
  .dcards-parent:hover .dcards-card{transform:none}
  .dcards-parent:hover .dcards-circle:nth-child(2),
  .dcards-parent:hover .dcards-circle:nth-child(3),
  .dcards-parent:hover .dcards-circle:nth-child(4),
  .dcards-parent:hover .dcards-circle:nth-child(5){transform:inherit}
}
`;

export default function DimensionalCardsSection({
  config = {},
}: {
  config?: DimensionalCardsConfig;
}) {
  const heading = config.heading ?? "";
  const subheading = config.subheading ?? "";
  const cards = (config.cards?.length ? config.cards : DEFAULT_CARDS).slice(0, 3);

  return (
    <section dir="rtl" className="dcards-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="container">
        {(heading || subheading) && (
          <div className="dcards-head">
            {heading && <h2 className="text-gray-900 dark:text-white">{heading}</h2>}
            {subheading && <p className="text-gray-600 dark:text-gray-400">{subheading}</p>}
          </div>
        )}

        <div className="dcards-grid">
          {cards.map((c, i) => {
            const theme = c.theme ?? DEFAULT_CARDS[i]?.theme ?? "mint";
            const cut = (c.shape ?? DEFAULT_CARDS[i]?.shape ?? "rounded") === "chamfer";
            return (
              <div key={i} className={`dcards-parent dcards-t-${theme}${cut ? " is-cut" : ""}`}>
                <div className="dcards-card">

                  {/* دایره‌های تودرتو — کوچک‌ترین دایره تصویر را نگه می‌دارد */}
                  <div className="dcards-logo" aria-hidden="true">
                    <span className="dcards-circle" />
                    <span className="dcards-circle" />
                    <span className="dcards-circle" />
                    <span className="dcards-circle" />
                    <span className="dcards-circle dcards-circle--img">
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt="" loading="lazy" decoding="async" />
                      )}
                    </span>
                  </div>

                  <div className="dcards-glass" />

                  <div className="dcards-content">
                    {c.title && <span className="dcards-title">{c.title}</span>}
                    {c.text && <span className="dcards-text">{c.text}</span>}
                  </div>

                  <div className="dcards-bottom">
                    <CardButton href={c.btnUrl ?? ""}>
                      {c.btnText || "مشاهده محصولات"}
                    </CardButton>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}