"use client";

import Link from "next/link";

interface Config {
  imageUrl?: string;
  imageAlt?: string;
  heading?: string;
  content?: string;
  badge?: string;
  btnText?: string;
  btnUrl?: string;
  imagePosition?: "right" | "left";
  bgColor?: string;
  accentColor?: string;
}

export default function ImageContentSection({ config }: { config: Config }) {
  const {
    imageUrl = "",
    imageAlt = "",
    heading = "",
    content = "",
    badge = "",
    btnText = "",
    btnUrl = "",
    imagePosition = "right",
    bgColor = "#f8fafc",
    accentColor = "#4f46e5",
  } = config;

  if (!imageUrl && !heading) return null;

  // mobile: image always first (order-1), content second (order-2)
  // desktop imagePosition="right": image → md:order-2, content → md:order-1
  // desktop imagePosition="left": image → md:order-1, content → md:order-2 (defaults)
  const imgOrder    = imagePosition === "right" ? "order-1 md:order-2" : "order-1";
  const contentOrder = imagePosition === "right" ? "order-2 md:order-1" : "order-2";

  const btn = (
    <span
      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer select-none"
      style={{ background: accentColor, boxShadow: `0 8px 24px ${accentColor}40` }}
    >
      {btnText}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );

  return (
    <section className="py-12 lg:py-20" style={{ background: bgColor }}>
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8 items-stretch">

          {/* Image Box */}
          <div className={imgOrder}>
            <div
              className="relative overflow-hidden rounded-[2rem] h-full min-h-[280px] md:min-h-[400px]"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={imageAlt || heading}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 text-7xl">
                  🖼
                </div>
              )}
              {/* subtle gradient overlay at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

              {/* decorative corner accent */}
              <div
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at top left, ${accentColor}30, transparent 70%)`,
                }}
              />
            </div>
          </div>

          {/* Content Box */}
          <div className={`${contentOrder} flex`}>
            <div
              className="flex-1 rounded-[2rem] p-8 lg:p-10 xl:p-12 flex flex-col justify-center relative overflow-hidden bg-white dark:bg-gray-900"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}
            >
              {/* decorative blobs */}
              <div
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: `${accentColor}12` }}
              />
              <div
                className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
                style={{ background: `${accentColor}0a` }}
              />

              {/* vertical accent bar */}
              <div
                className="absolute right-0 top-12 bottom-12 w-1 rounded-full pointer-events-none"
                style={{ background: `linear-gradient(to bottom, transparent, ${accentColor}60, transparent)` }}
              />

              <div className="relative z-10 space-y-5">
                {badge && (
                  <span
                    className="inline-block text-xs font-black px-4 py-1.5 rounded-full"
                    style={{ background: `${accentColor}15`, color: accentColor }}
                  >
                    {badge}
                  </span>
                )}

                {heading && (
                  <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black leading-tight text-gray-900 dark:text-white">
                    {heading}
                  </h2>
                )}

                {/* accent underline */}
                {heading && (
                  <div className="flex gap-2 items-center">
                    <div className="h-1 w-10 rounded-full" style={{ background: accentColor }} />
                    <div className="h-1 w-4 rounded-full" style={{ background: `${accentColor}50` }} />
                    <div className="h-1 w-2 rounded-full" style={{ background: `${accentColor}25` }} />
                  </div>
                )}

                {content && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm lg:text-base leading-loose whitespace-pre-wrap">
                    {content}
                  </p>
                )}

                {btnText && (
                  <div>
                    {btnUrl ? (
                      <Link href={btnUrl}>{btn}</Link>
                    ) : (
                      btn
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
