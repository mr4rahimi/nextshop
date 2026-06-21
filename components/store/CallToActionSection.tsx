"use client";

import Link from "next/link";

interface CTAConfig {
  heading?: string;
  subheading?: string;
  btnText?: string;
  btnUrl?: string;
  bgType?: "solid" | "gradient";
  bgColor?: string;
  bgGradientFrom?: string;
  bgGradientTo?: string;
  bgGradientDir?: string;
  btnBg?: string;
  btnColor?: string;
  textColor?: string;
}

export default function CallToActionSection({ config }: { config: CTAConfig }) {
  const {
    heading = "",
    subheading = "",
    btnText = "شروع کنید",
    btnUrl = "#",
    bgType = "gradient",
    bgColor = "#4f46e5",
    bgGradientFrom = "#4f46e5",
    bgGradientTo = "#7c3aed",
    bgGradientDir = "135deg",
    btnBg = "#ffffff",
    btnColor = "#4f46e5",
    textColor = "#ffffff",
  } = config;

  if (!heading && !btnText) return null;

  const bgStyle: React.CSSProperties =
    bgType === "gradient"
      ? { background: `linear-gradient(${bgGradientDir}, ${bgGradientFrom}, ${bgGradientTo})` }
      : { backgroundColor: bgColor };

  const btn = (
    <span
      className="inline-block px-8 py-3.5 rounded-2xl font-black text-base shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer select-none"
      style={{ background: btnBg, color: btnColor }}>
      {btnText}
    </span>
  );

  return (
    <section>
      <div className="container">
        <div className="relative overflow-hidden rounded-[2rem] px-6 py-16 lg:py-20 text-center" style={bgStyle}>

          {/* decorative blobs */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="pointer-events-none absolute -bottom-28 -left-28 w-96 h-96 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{ background: "rgba(255,255,255,0.03)" }} />

          <div className="relative z-10 max-w-2xl mx-auto">
            {heading && (
              <h2
                className="text-2xl lg:text-4xl font-black leading-tight mb-4"
                style={{ color: textColor }}>
                {heading}
              </h2>
            )}
            {subheading && (
              <p
                className="text-sm lg:text-base leading-relaxed mb-8 max-w-lg mx-auto"
                style={{ color: textColor + "cc" }}>
                {subheading}
              </p>
            )}
            {btnText && (
              btnUrl && btnUrl !== "#"
                ? <Link href={btnUrl}>{btn}</Link>
                : btn
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
