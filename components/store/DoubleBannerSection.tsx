"use client";

import Link from "next/link";

interface BannerItem {
  imageUrl: string;
  linkUrl?: string | null;
  alt?: string | null;
}

interface Props {
  banners?: BannerItem[];
}

function SingleBanner({ banner }: { banner: BannerItem }) {
  const safeUrl = banner.imageUrl.includes(" ") ? banner.imageUrl.split("/").map(encodeURIComponent).join("/") : banner.imageUrl;
  const inner = (
    <div className="group relative overflow-hidden rounded-[2rem] shadow-lg shadow-black/10 dark:shadow-black/40 transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 dark:hover:shadow-black/60 hover:-translate-y-1">
      <img
        src={safeUrl}
        alt={banner.alt || "بنر"}
        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500 rounded-[2rem]" />
    </div>
  );

  return banner.linkUrl ? (
    <Link href={banner.linkUrl} className="block">
      {inner}
    </Link>
  ) : inner;
}

export default function DoubleBannerSection({ banners = [] }: Props) {
  const first  = banners[0];
  const second = banners[1];

  if (!first?.imageUrl && !second?.imageUrl) return null;

  return (
    <section className="transition-colors duration-500">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {first?.imageUrl  && <SingleBanner banner={first} />}
          {second?.imageUrl && <SingleBanner banner={second} />}
        </div>
      </div>
    </section>
  );
}