"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Category {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
}

interface Props {
  categoryIds?: string[];
}

export default function CategoriesSection({ categoryIds }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryIds || categoryIds.length === 0) {
      setLoading(false);
      return;
    }
    fetch(`/api/store/widget-categories?ids=${categoryIds.join(",")}`)
      .then(r => r.json())
      .then(data => { setCategories(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [categoryIds?.join(",")]);

  if (loading) {
    return (
      <section className="relative overflow-hidden">
        <div className="container py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <div className="w-full aspect-square max-w-[160px] bg-white/60 dark:bg-white/5 rounded-[3rem] animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-white/10 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="relative overflow-hidden transition-colors duration-500">
      <div className="container py-4 relative z-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-primary-500/10 text-primary-500 text-[10px] font-black rounded-full tracking-widest uppercase">
                دسترسی سریع
              </span>
              <div className="h-[1px] w-12 bg-primary-500/30" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
              دسته‌بندی‌های{" "}
              <span className="relative">
                <span className="relative z-10">محبوب</span>
                <span className="absolute bottom-2 inset-x-0 h-3 bg-primary-500/20 -z-10 rounded-full" />
              </span>
            </h2>
          </div>

          <Link
            href="/categories"
            className="group/link relative overflow-hidden px-8 py-3.5 rounded-2xl transition-all duration-500 flex items-center gap-3 bg-white/40 backdrop-blur-md border border-gray-200 text-gray-800 hover:border-primary-500/50 hover:text-white dark:bg-white/[0.03] dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
          >
            <span className="absolute inset-0 bg-primary-600 translate-y-full group-hover/link:translate-y-0 transition-transform duration-500 ease-out" />
            <span className="relative z-10 text-[13px] font-black tracking-tight">مشاهده تمامی دسته‌ها</span>
            <div className="relative z-10 w-5 h-5 flex items-center justify-center bg-primary-600/10 dark:bg-white/5 rounded-lg group-hover/link:bg-white/20 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group relative flex flex-col items-center"
            >
              <div className="relative w-full aspect-square max-w-[160px] flex items-center justify-center mb-6">
                <div className="absolute inset-0 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl rounded-[3rem] border border-white dark:border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] transition-all duration-700 group-hover:-translate-y-4 group-hover:bg-white/80 dark:group-hover:bg-white/[0.07] group-hover:shadow-2xl group-hover:shadow-primary-500/20 group-hover:border-primary-500/30" />
                <div className="relative z-10 p-6 flex flex-col items-center transition-transform duration-700 group-hover:scale-110">
                  <div className="absolute inset-0 bg-primary-500/20 blur-[30px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  {cat.imageUrl ? (
                    <Image src={cat.imageUrl} alt={cat.title} width={64} height={64} className="relative z-10 object-contain drop-shadow-2xl" />
                  ) : (
                    <div className="relative z-10 w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[13px] font-black text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300 text-center">
                {cat.title}
              </span>
              <div className="mt-4 w-1.5 h-1.5 bg-primary-500 rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-[3] transition-all duration-500" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
