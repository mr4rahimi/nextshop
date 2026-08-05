"use client";

import Link from "next/link";
import Image from "next/image";

interface Props {
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
}

export default function FullBannerSection({ imageUrl, linkUrl, alt = "بنر" }: Props) {
  if (!imageUrl) return null;
  const safeUrl = imageUrl.includes(" ") ? imageUrl.split("/").map(encodeURIComponent).join("/") : imageUrl;

  const inner = (
    <div className="group relative aspect-[1774/426] overflow-hidden rounded-[2rem] shadow-lg ...">
       <Image
        src={safeUrl}
        alt={alt || "بنر"}
        fill
        sizes="(min-width: 1024px) 1200px, 100vw"
        className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
      />

      {}
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
