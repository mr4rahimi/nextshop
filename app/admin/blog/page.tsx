"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Post {
  id: string; title: string; slug: string; status: string;
  coverImage: string | null; publishedAt: string | null;
  viewCount: number; readingTime: number; createdAt: string;
  category: { title: string } | null;
  _count: { comments: number };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: "منتشر",       color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  DRAFT:     { label: "پیش‌نویس",   color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800" },
  SCHEDULED: { label: "زمان‌بندی",  color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800" },
};

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fa-IR"); }

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts]       = useState<Post[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState("");
  const [q, setQ]               = useState("");
  const [qInput, setQInput]     = useState("");
  const [loading, setLoading]   = useState(true);
  const PAGE_SIZE = 20;

  const fetchPosts = useCallback(async (p: number, s: string, query: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (s) params.set("status", s);
    if (query) params.set("q", query);
    const res = await fetch(`/api/admin/blog?${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []); setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(page, status, q); }, [page, status, q, fetchPosts]);

  async function deletePost(id: string) {
    if (!confirm("این مطلب حذف شود؟")) return;
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.id !== id));
    setTotal(t => t - 1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مجله / بلاگ</h1>
          <p className="text-sm text-gray-400 mt-1">{toFa(total)} مطلب</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/blog/categories"
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            دسته‌بندی‌ها
          </Link>
          <Link href="/admin/blog/comments"
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            نظرات
          </Link>
          <Link href="/admin/blog/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            مطلب جدید
          </Link>
        </div>
      </div>

      {}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setQ(qInput); setPage(1); }} className="flex gap-2">
          <input className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-blue-500 w-52"
            placeholder="جستجو در عناوین..." value={qInput} onChange={e => setQInput(e.target.value)} />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
            جستجو
          </button>
        </form>
        <div className="flex gap-2">
          {[{ v: "", l: "همه" }, ...Object.entries(STATUS_MAP).map(([v, { label: l }]) => ({ v, l }))].map(s => (
            <button key={s.v} onClick={() => { setStatus(s.v); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${status === s.v ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="space-y-px">{Array.from({length:6}).map((_,i) => <div key={i} className="h-16 bg-gray-50 dark:bg-gray-800/50 animate-pulse" />)}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
            </svg>
            <p className="font-bold">مطلبی یافت نشد</p>
          </div>
        ) : (
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">عنوان</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider hidden md:table-cell">دسته</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider hidden lg:table-cell">تاریخ</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider hidden lg:table-cell">بازدید</th>
                <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">وضعیت</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {posts.map(post => {
                const s = STATUS_MAP[post.status] ?? STATUS_MAP.DRAFT;
                return (
                  <tr key={post.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.coverImage && (
                          <img src={post.coverImage} alt={post.title} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">{post.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{toFa(post.readingTime)} دقیقه • {toFa(post._count.comments)} نظر</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{post.category?.title ?? "—"}</span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-[11px] text-gray-500">{post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{toFa(post.viewCount)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black border ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/mag/${post.slug}`} target="_blank"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-blue-600 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </Link>
                        <Link href={`/admin/blog/${post.id}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </Link>
                        <button onClick={() => deletePost(post.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">{toFa((page-1)*PAGE_SIZE+1)}–{toFa(Math.min(page*PAGE_SIZE,total))} از {toFa(total)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page<=1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2 self-center">{toFa(page)}/{toFa(totalPages)}</span>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
