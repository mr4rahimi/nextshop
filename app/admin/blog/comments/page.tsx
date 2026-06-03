"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Comment {
  id: string; content: string; status: string; createdAt: string; name: string | null;
  post: { title: string; slug: string };
  user: { firstName: string | null; lastName: string | null; phone: string } | null;
}

export default function BlogCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/blog/comments?status=${status}`).then(r => r.json()).then(d => {
      setComments(d.comments ?? []); setLoading(false);
    });
  }, [status]);

  async function updateStatus(id: string, s: string) {
    await fetch(`/api/admin/blog/comments/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    setComments(p => p.filter(c => c.id !== id));
  }

  async function del(id: string) {
    await fetch(`/api/admin/blog/comments/${id}`, { method: "DELETE" });
    setComments(p => p.filter(c => c.id !== id));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-black text-gray-900 dark:text-white">نظرات بلاگ</h1>
      <div className="flex gap-2">
        {[{ v: "PENDING", l: "در انتظار" }, { v: "APPROVED", l: "تأیید شده" }, { v: "REJECTED", l: "رد شده" }].map(s => (
          <button key={s.v} onClick={() => setStatus(s.v)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${status === s.v ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}>
            {s.l}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {loading ? Array.from({length:4}).map((_,i) => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />) :
        comments.length === 0 ? <p className="text-center py-12 text-gray-400">نظری یافت نشد</p> :
        comments.map(c => {
          const name = c.user ? [c.user.firstName, c.user.lastName].filter(Boolean).join(" ") || c.user.phone : c.name || "ناشناس";
          return (
            <div key={c.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-black text-gray-900 dark:text-white">{name}</span>
                    <span className="text-[10px] text-gray-400">در:</span>
                    <Link href={`/mag/${c.post.slug}`} target="_blank" className="text-[10px] text-blue-600 hover:underline">{c.post.title}</Link>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{c.content}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {status === "PENDING" && <>
                    <button onClick={() => updateStatus(c.id, "APPROVED")}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all">تأیید</button>
                    <button onClick={() => updateStatus(c.id, "REJECTED")}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl text-xs font-black hover:bg-red-100 transition-all">رد</button>
                  </>}
                  <button onClick={() => del(c.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
