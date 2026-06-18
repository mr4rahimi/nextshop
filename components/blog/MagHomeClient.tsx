"use client";

import { useState } from "react";
import Link from "next/link";

interface Post {
  id: string; title: string; slug: string; excerpt: string | null;
  coverImage: string | null; publishedAt: string | null;
  readingTime: number; viewCount: number;
  category: { title: string; slug: string } | null;
  tags: { tag: { title: string; slug: string } }[];
  _count: { comments: number };
}
interface Category {
  id: string; title: string; slug: string;
  _count: { posts: number };
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  if (featured) {
    return (
      <Link href={`/mag/${post.slug}`}
        className="group relative overflow-hidden rounded-[2.5rem] aspect-[16/9] block bg-gray-900">
        {post.coverImage ? (
          <img src={post.coverImage} alt={post.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-60 group-hover:scale-105 transition-all duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-900 to-gray-900" />
        )}
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        {}
        <div className="absolute bottom-0 right-0 left-0 p-8">
          {post.category && (
            <span className="inline-block px-3 py-1 bg-primary-500 text-white text-[10px] font-black rounded-xl mb-3 uppercase tracking-wider">
              {post.category.title}
            </span>
          )}
          <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3 group-hover:text-primary-300 transition-colors line-clamp-2">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-sm text-gray-300 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {toFa(post.readingTime)} دقیقه مطالعه
            </span>
            <span>{formatDate(post.publishedAt)}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/mag/${post.slug}`}
      className="group bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-[2rem] border border-gray-100 dark:border-white/5 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {}
      <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {post.coverImage ? (
          <img src={post.coverImage} alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" />
            </svg>
          </div>
        )}
        {post.category && (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-primary-500/90 backdrop-blur-sm text-white text-[10px] font-black rounded-xl">
            {post.category.title}
          </span>
        )}
      </div>
      {}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-black text-gray-900 dark:text-white leading-relaxed line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3">{post.excerpt}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-white/5 text-[10px] text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {toFa(post.readingTime)} دقیقه
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {toFa(post._count.comments)}
            </span>
          </div>
          <span>{formatDate(post.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

interface Props {
  initialPosts: Post[];
  categories: (Category & { _count: { posts: number } })[];
}

export default function MagHomeClient({ initialPosts, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState("");
  const [posts, setPosts]   = useState(initialPosts);
  const [loading, setLoading] = useState(false);
  const [page, setPage]     = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length === 12);

  async function filterByCategory(slug: string) {
    setActiveCategory(slug); setLoading(true); setPage(1);
    const params = slug ? `?cat=${slug}` : "";
    const res = await fetch(`/api/mag${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []); setHasMore(data.posts?.length === 12);
    setLoading(false);
  }

  async function loadMore() {
    setLoading(true);
    const p = page + 1;
    const params = new URLSearchParams({ page: String(p) });
    if (activeCategory) params.set("cat", activeCategory);
    const res = await fetch(`/api/mag?${params}`);
    const data = await res.json();
    setPosts(prev => [...prev, ...(data.posts ?? [])]);
    setHasMore(data.posts?.length === 12);
    setPage(p); setLoading(false);
  }

  const featuredPost = posts[0];
  const restPosts    = posts.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505]" dir="rtl">

      {/* ── Hero Header ───────────────────────────────────────────── */}
      <div className="relative bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />
        <div className="container relative z-10 py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-1 bg-primary-500 rounded-full" />
              <span className="text-xs font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest">مجله آنلاین</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-4">
              آخرین مطالب<br />
              <span className="text-primary-600 dark:text-primary-400">و آموزش‌ها</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
              بررسی، آموزش و نقد محصولات — برای خرید آگاهانه‌تر
            </p>
          </div>
        </div>
      </div>

      <div className="container py-12 space-y-12">

        {}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => filterByCategory("")}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-black transition-all ${!activeCategory ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-500/50"}`}>
              همه مطالب
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => filterByCategory(c.slug)}
                className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-black transition-all ${activeCategory === c.slug ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-500/50"}`}>
                {c.title}
                <span className="mr-1.5 text-[10px] opacity-60">({toFa(c._count.posts)})</span>
              </button>
            ))}
          </div>
        )}

        {loading && posts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-[2rem] overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-100 dark:bg-gray-800" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-xl font-black">مطلبی یافت نشد</p>
          </div>
        ) : (
          <>
            {}
            {featuredPost && !activeCategory && (
              <PostCard post={featuredPost} featured />
            )}

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeCategory ? posts : restPosts).map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {}
            {hasMore && (
              <div className="flex justify-center">
                <button onClick={loadMore} disabled={loading}
                  className="px-10 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-black text-sm hover:border-primary-500/50 hover:text-primary-600 disabled:opacity-60 transition-all">
                  {loading ? "در حال بارگذاری..." : "مطالب بیشتر"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
