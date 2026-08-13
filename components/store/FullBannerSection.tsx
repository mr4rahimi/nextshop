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
    <div className="group relative overflow-hidden rounded-[2rem] shadow-lg shadow-black/10 dark:shadow-black/40 transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 dark:hover:shadow-black/60 hover:-translate-y-1">
      {/* ارتفاع باید از نسبت واقعی تصویر بیاید — بنر ممکن است هر ابعادی داشته
          باشد (از جمله گیف متحرک). width/height=0 به‌علاوه‌ی w-full/h-auto یعنی
          نسبتِ ثابتی تحمیل نمی‌شود و مرورگر ابعاد ذاتی فایل را ملاک می‌گیرد.
          نباید به aspect ثابت + fill برگردد؛ هر بنری با نسبت متفاوت بریده می‌شود. */}
      <Image
        src={safeUrl}
        alt={alt || "بنر"}
        width={0}
        height={0}
        sizes="(min-width: 1024px) 1200px, 100vw"
        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
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
