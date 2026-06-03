"use client";

import Link from "next/link";

interface Props {
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
}

export default function FullBannerSection({ imageUrl, linkUrl, alt = "بنر" }: Props) {
  if (!imageUrl) return null;
  const safeUrl = imageUrl.includes(" ") ? imageUrl.split("/").map(encodeURIComponent).join("/") : imageUrl;

  const inner = (
    <div className="group relative overflow-hidden rounded-[2rem] shadow-lg shadow-black/10 dark:shadow-black/40 transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 dark:hover:shadow-black/60 hover:-translate-y-1">
      <img
        src={safeUrl}
        alt={alt}
        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
      />
      {/* overlay خفیف روی هاور */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500 rounded-[2rem]" />
    </div>
  );

  return (
    <section className="transition-colors duration-500">
      <div className="container">
        {linkUrl ? (
          <Link href={linkUrl} className="block">
            {inner}
          </Link>
        ) : (
          inner
        )}
      </div>
    </section>
  );
}