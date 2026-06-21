"use client";

import Link from "next/link";

interface ContentBox {
  badge?: string;
  heading?: string;
  content?: string;
  btnText?: string;
  btnUrl?: string;
}

interface Config {
  imageUrl?: string;
  imageAlt?: string;
  bgColor?: string;
  accentColor?: string;
  boxes?: [ContentBox, ContentBox];
}

const DEFAULT_BOX: ContentBox = { badge: "", heading: "", content: "", btnText: "", btnUrl: "" };

export default function ImageContentDoubleSection({ config }: { config: Config }) {
  const {
    imageUrl = "",
    imageAlt = "",
    bgColor = "#f8fafc",
    accentColor = "#4f46e5",
    boxes = [DEFAULT_BOX, DEFAULT_BOX],
  } = config;

  const [box1, box2] = boxes;
  if (!imageUrl && !box1?.heading && !box2?.heading) return null;

  const fa = (n: number) => String(n).replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

  const CardButton = ({ text, url }: { text: string; url?: string }) => {
    const cls =
      "inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl font-black text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95";
    const style = { background: accentColor, boxShadow: `0 6px 20px ${accentColor}40` };
    const inner = (
      <>
        {text}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </>
    );
    return url ? (
      <Link href={url} className={cls} style={style}>{inner}</Link>
    ) : (
      <span className={cls} style={style}>{inner}</span>
    );
  };

  return (
    <section style={{ background: bgColor }} className="pt-12 lg:pt-20 pb-16 lg:pb-24">
      <div className="container">

        {/* ── Hero Image ── */}
        {imageUrl && (
          <div
            className="relative rounded-[2rem] overflow-hidden w-full"
            style={{ height: "clamp(240px, 38vw, 520px)", boxShadow: `0 28px 80px rgba(0,0,0,0.18)` }}
          >
            <img
              src={imageUrl}
              alt={imageAlt}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* gradient overlay — darker at bottom for overlap readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

            {/* decorative accent glow on top-right */}
            <div
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${accentColor}35, transparent 70%)`, filter: "blur(20px)" }}
            />
          </div>
        )}

        {/* ── Two Content Boxes (float up over image) ── */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 relative z-10 px-3 md:px-8 ${imageUrl ? "-mt-12 md:-mt-16 lg:-mt-20" : "mt-0"}`}
        >
          {[box1, box2].map((box, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-[1.5rem] p-6 lg:p-8 relative overflow-hidden flex flex-col"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)" }}
            >
              {/* top accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[1.5rem]"
                style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }}
              />

              {/* number badge */}
              <div
                className="absolute top-4 left-4 w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                style={{ background: accentColor, boxShadow: `0 4px 12px ${accentColor}50` }}
              >
                {fa(i + 1)}
              </div>

              {/* decorative blob */}
              <div
                className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: `${accentColor}0c` }}
              />

              <div className="relative z-10 pt-2">
                {box?.badge && (
                  <span
                    className="inline-block text-[11px] font-black px-3 py-1 rounded-full mb-3"
                    style={{ background: `${accentColor}15`, color: accentColor }}
                  >
                    {box.badge}
                  </span>
                )}

                {box?.heading && (
                  <h3 className="text-lg lg:text-xl xl:text-2xl font-black text-gray-900 dark:text-white leading-tight mb-3">
                    {box.heading}
                  </h3>
                )}

                {box?.heading && (
                  <div className="flex gap-1.5 items-center mb-4">
                    <div className="h-[3px] w-8 rounded-full" style={{ background: accentColor }} />
                    <div className="h-[3px] w-3 rounded-full" style={{ background: `${accentColor}55` }} />
                    <div className="h-[3px] w-1.5 rounded-full" style={{ background: `${accentColor}25` }} />
                  </div>
                )}

                {box?.content && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-loose whitespace-pre-wrap">
                    {box.content}
                  </p>
                )}

                {box?.btnText && (
                  <CardButton text={box.btnText} url={box.btnUrl} />
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
