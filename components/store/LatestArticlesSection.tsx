"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Article {
  id: string; title: string; slug: string; excerpt: string | null;
  coverImage: string | null; publishedAt: string | null; readingTime: number;
  category: { title: string; slug: string } | null;
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/mag/${article.slug}`}
      className="group flex flex-col bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/40 hover:-translate-y-2 transition-all duration-500 h-full">

      {}
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
        {article.coverImage ? (
          <img src={article.coverImage} alt={article.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-gray-900 flex items-center justify-center">
            <svg className="w-12 h-12 text-primary-300 dark:text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}

        {/* overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {}
        {article.category && (
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 bg-primary-500/90 backdrop-blur-sm text-white text-[10px] font-black rounded-xl shadow-lg">
              {article.category.title}
            </span>
          </div>
        )}

        {}
        <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="flex items-center gap-1 px-2.5 py-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {toFa(article.readingTime)} دقیقه
          </span>
        </div>
      </div>

      {}
      <div className="flex flex-col flex-1 p-6 gap-3">
        <h3 className="font-black text-gray-900 dark:text-white leading-relaxed line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm">
          {article.title}
        </h3>

        {article.excerpt && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed flex-1">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-white/5">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(article.publishedAt)}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-black text-primary-600 dark:text-primary-400 group-hover:gap-2 transition-all">
            ادامه مطلب
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function LatestArticlesSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading]   = useState(true);
  const swiperRef = useRef<any>(null);
  const uid = useRef(`la-${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    fetch("/api/store/latest-articles")
      .then(r => r.json())
      .then(data => { setArticles(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (loading || articles.length === 0) return;

    const timer = setTimeout(() => {
      if (typeof window === "undefined" || !(window as any).Swiper) return;

      const sw = new (window as any).Swiper(`.${uid.current}`, {
        slidesPerView: 1.2,
        spaceBetween: 16,
        centeredSlides: false,
        grabCursor: true,
        breakpoints: {
          640:  { slidesPerView: 2.2, spaceBetween: 20 },
          1024: { slidesPerView: 3.2, spaceBetween: 24 },
          1280: { slidesPerView: 4,   spaceBetween: 24 },
        },
        navigation: {
          nextEl: `.${uid.current}-next`,
          prevEl: `.${uid.current}-prev`,
        },
        on: {
          afterInit: (sw: any) => { swiperRef.current = sw; },
        },
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [loading, articles]);

  if (loading) {
    return (
      <section className="py-12">
        <div className="container">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-[2.5rem] overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-gray-100 dark:bg-gray-800" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section className="py-12 overflow-hidden" dir="rtl">
      <div className="container">

        {}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">آخرین مقالات</h2>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Latest Articles</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {}
            <div className="hidden md:flex gap-2">
              <button className={`${uid.current}-prev w-10 h-10 rounded-xl bg-white/50 dark:bg-white/5 dark:text-white border border-white dark:border-white/10 flex items-center justify-center cursor-pointer hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all shadow-sm`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button className={`${uid.current}-next w-10 h-10 rounded-xl bg-white/50 dark:bg-white/5 dark:text-white border border-white dark:border-white/10 flex items-center justify-center cursor-pointer hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all shadow-sm`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <Link href="/mag"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-2xl text-xs font-black hover:bg-primary-500/20 transition-all">
              مشاهده همه
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Swiper */}
        <div className={`swiper ${uid.current}`}>
          <div className="swiper-wrapper pb-4">
            {articles.map(article => (
              <div key={article.id} className="swiper-slide h-auto">
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
