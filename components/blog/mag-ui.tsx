"use client";

/** اجزای مشترک صفحه‌ی فهرست مجله و صفحه‌ی مقاله */

import Link from "next/link";
import Image from "next/image";
import { Play, BookOpen, Clock, MessageCircle } from "lucide-react";

export interface MagPost {
  id: string; title: string; slug: string; excerpt: string | null;
  coverImage: string | null; publishedAt: string | null; videoUrl?: string | null;
  readingTime: number; viewCount?: number;
  category: { title: string; slug: string } | null;
  tags?: { tag: { title: string; slug: string } }[];
  _count?: { comments: number };
}

export const toFa = (n: number) => n.toLocaleString("fa-IR");

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

/** «امروز»، «۳ روز پیش»، «۲ هفته پیش» — بعد از یک ماه تاریخ کامل */
export function relativeDate(iso: string | null) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "امروز";
  if (days === 1) return "دیروز";
  if (days < 7) return `${toFa(days)} روز پیش`;
  if (days < 30) return `${toFa(Math.floor(days / 7))} هفته پیش`;
  return formatDate(iso);
}

export function isNew(iso: string | null) {
  return !!iso && Date.now() - new Date(iso).getTime() < 7 * 86_400_000;
}

export function Cover({ src, alt, sizes, priority, className = "" }: {
  src: string | null; alt: string; sizes: string; priority?: boolean; className?: string;
}) {
  if (!src) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 ${className}`}>
        <BookOpen className="w-10 h-10 text-white/60" strokeWidth={1.5} />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
}

/**
 * کارت افقی با تصویر بیرون‌زده — طرح مرجع «Latest News».
 * `wide` برای نمای فهرستی تک‌ستونه است.
 */
export function PostCardH({ post, wide = false, index = 0 }: { post: MagPost; wide?: boolean; index?: number }) {
  const fresh = isNew(post.publishedAt);
  return (
    <article className="mag-fade-in group relative pt-6" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
      <Link href={`/mag/${post.slug}`} className="block focus:outline-none" aria-label={post.title}>
        {/* تصویر — بالاتر از کارت و بیرون‌زده از سمت راست */}
        <div className={`absolute top-0 right-0 z-10 overflow-hidden rounded-2xl shadow-xl shadow-black/20 ring-1 ring-black/5
          ${wide ? "w-32 sm:w-56 aspect-square sm:aspect-[4/3]" : "w-28 sm:w-40 aspect-square"}`}>
          <Cover src={post.coverImage} alt={post.title} className="group-hover:scale-110 transition-transform duration-700"
            sizes={wide ? "(max-width: 640px) 128px, 224px" : "(max-width: 640px) 112px, 160px"} />
          {post.videoUrl && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-gray-900 fill-gray-900 -mr-0.5" />
              </span>
            </span>
          )}
          {fresh && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary-600 text-white text-[10px] font-black shadow">جدید</span>
          )}
        </div>

        <div className={`mag-card rounded-[1.4rem] mr-4 sm:mr-6 mt-4 flex flex-col transition-all duration-300 group-hover:-translate-y-1
          ${wide ? "min-h-[10.5rem] sm:min-h-[12.5rem] pr-32 sm:pr-56" : "min-h-[10.5rem] sm:min-h-[12rem] pr-28 sm:pr-40"}`}>
          <div className="p-4 sm:p-5 sm:pr-6 flex-1">
            <h3 className={`font-black leading-[1.8] text-[var(--mag-text)] group-hover:text-[var(--mag-accent)] transition-colors line-clamp-2
              ${wide ? "text-base sm:text-lg" : "text-[15px] sm:text-base"}`}>
              {post.title}
            </h3>
            {post.excerpt && (
              <p className={`hidden sm:block mt-2 text-[13px] leading-7 text-[var(--mag-muted)] ${wide ? "line-clamp-3" : "line-clamp-2"}`}>
                {post.excerpt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 sm:px-6 pb-4 text-[11px] text-[var(--mag-muted)] -mr-28 sm:mr-0 pr-4 sm:pr-6">
            {post.category && <span className="font-bold truncate max-w-[7rem]">{post.category.title}</span>}
            <span suppressHydrationWarning className="whitespace-nowrap">{relativeDate(post.publishedAt)}</span>
            <span className="hidden sm:flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" />{toFa(post.readingTime)} دقیقه</span>
            {(post._count?.comments ?? 0) > 0 && (
              <span className="hidden sm:flex items-center gap-1"><MessageCircle className="w-3 h-3" />{toFa(post._count!.comments)}</span>
            )}
            <span className="mr-auto text-sm font-black text-[var(--mag-text)] group-hover:text-[var(--mag-accent)] transition-colors">
              {post.videoUrl ? "تماشا" : "مطالعه"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
