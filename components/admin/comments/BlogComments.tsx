"use client";

/**
 * تب «نظرات مقالات» — نظرهای مجله، با همان امکانات تب نظرات فروشگاه.
 *
 * پاسخ فروشگاه اینجا یک نظرِ فرزند می‌سازد (نه ستونی روی خود نظر)، چون در
 * مقاله گفتگو طبیعی است و همان ساختار، پاسخ بازدیدکننده به بازدیدکننده را
 * هم می‌پوشاند.
 *
 * مستندات: docs/features/reviews.md
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Reply {
  id: string;
  content: string;
  status: string;
  isStaffReply: boolean;
  createdAt: string;
  name: string | null;
  user: { firstName: string | null; lastName: string | null } | null;
}

interface Comment {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  name: string | null;
  email: string | null;
  isStaffReply: boolean;
  helpfulYes: number;
  helpfulNo: number;
  post: { id: string; title: string; slug: string };
  user: { firstName: string | null; lastName: string | null; phone: string } | null;
  parent: {
    id: string;
    content: string;
    name: string | null;
    user: { firstName: string | null; lastName: string | null } | null;
  } | null;
  replies: Reply[];
}

const TABS = [
  { v: "PENDING", l: "در انتظار تأیید" },
  { v: "APPROVED", l: "تأیید شده" },
  { v: "REJECTED", l: "رد شده" },
];

function persianDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function authorName(input: {
  name: string | null;
  user: { firstName: string | null; lastName: string | null; phone?: string } | null;
}): string {
  if (input.user) {
    const full = [input.user.firstName, input.user.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
    if (input.user.phone) return input.user.phone;
  }
  return input.name?.trim() || "مهمان";
}

export default function BlogComments() {
  const [status, setStatus] = useState("PENDING");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  /** همان الگوی `ShopReviews`: وضعیت بارگذاری مشتق است نه state جدا */
  const [data, setData] = useState<{
    key: string;
    comments: Comment[];
    counts: Record<string, number>;
  } | null>(null);

  const [reloadAt, setReloadAt] = useState(0);
  const key = `${status}|${query}|${reloadAt}`;

  const comments = data?.comments ?? [];
  const counts = data?.counts ?? {};
  const loading = data?.key !== key;

  const reload = useCallback(() => setReloadAt(Date.now()), []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/blog/comments?status=${status}&q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setData({ key, comments: d.comments ?? [], counts: d.counts ?? {} });
        }
      })
      .catch(() => {
        if (alive) setData({ key, comments: [], counts: {} });
      });
    return () => {
      alive = false;
    };
  }, [key, status, query]);

  async function setCommentStatus(id: string, next: string) {
    setBusy(id);
    await fetch(`/api/admin/blog/comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("این نظر و همه‌ی پاسخ‌هایش برای همیشه حذف شوند؟")) return;
    setBusy(id);
    await fetch(`/api/admin/blog/comments/${id}`, { method: "DELETE" });
    setBusy(null);
    reload();
  }

  async function saveReply(id: string) {
    if (!replyText.trim()) return;
    setBusy(id);
    await fetch(`/api/admin/blog/comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyBody: replyText }),
    });
    setBusy(null);
    setReplyFor(null);
    setReplyText("");
    reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setStatus(t.v)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              status === t.v
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            {t.l}
            {counts[t.v] ? (
              <span className="mr-1.5 text-[10px] opacity-70">
                {counts[t.v].toLocaleString("fa-IR")}
              </span>
            ) : null}
          </button>
        ))}

        <form
          className="mr-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در نظرها یا عنوان مقاله"
            className="px-4 py-2 w-56 rounded-xl text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-gray-400"
          />
          <button className="px-3 py-2 rounded-xl text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            جستجو
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))
        ) : comments.length === 0 ? (
          <p className="text-center py-16 text-sm text-gray-400">نظری در این وضعیت نیست</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {authorName(c)}
                </span>

                {c.isStaffReply && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                    پاسخ فروشگاه
                  </span>
                )}

                {!c.user && !c.isStaffReply && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500">
                    مهمان
                  </span>
                )}

                <span className="text-[11px] text-gray-400">{persianDate(c.createdAt)}</span>

                <Link
                  href={`/mag/${c.post.slug}`}
                  target="_blank"
                  className="mr-auto text-[11px] text-blue-600 hover:underline"
                >
                  {c.post.title}
                </Link>
              </div>

              {c.parent && (
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3.5">
                  <p className="text-[11px] font-black text-gray-500 mb-1">
                    در پاسخ به {authorName(c.parent)}
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-6 line-clamp-2">
                    {c.parent.content}
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400 leading-7 whitespace-pre-line">
                {c.content}
              </p>

              {c.replies.length > 0 && (
                <div className="space-y-2 pr-4 border-r-2 border-gray-100 dark:border-gray-800">
                  {c.replies.map((r) => (
                    <div key={r.id} className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-3.5">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[12px] font-black text-gray-700 dark:text-gray-200">
                          {authorName(r)}
                        </span>
                        {r.isStaffReply && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                            پاسخ فروشگاه
                          </span>
                        )}
                        {r.status !== "APPROVED" && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-50 dark:bg-amber-900/20 text-amber-600">
                            {r.status === "PENDING" ? "در انتظار تأیید" : "رد شده"}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-6 whitespace-pre-line">
                        {r.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {replyFor === c.id && (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="پاسخ فروشگاه — بلافاصله زیر همین نظر در صفحه‌ی مقاله منتشر می‌شود"
                    className="w-full px-4 py-3 rounded-2xl text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none focus:border-gray-400 leading-7"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveReply(c.id)}
                      disabled={busy === c.id || !replyText.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50"
                    >
                      ارسال پاسخ
                    </button>
                    <button
                      onClick={() => setReplyFor(null)}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                {c.status !== "APPROVED" && (
                  <button
                    onClick={() => setCommentStatus(c.id, "APPROVED")}
                    disabled={busy === c.id}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    تأیید و انتشار
                  </button>
                )}

                {c.status !== "REJECTED" && (
                  <button
                    onClick={() => setCommentStatus(c.id, "REJECTED")}
                    disabled={busy === c.id}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 disabled:opacity-50"
                  >
                    رد
                  </button>
                )}

                {c.status !== "PENDING" && (
                  <button
                    onClick={() => setCommentStatus(c.id, "PENDING")}
                    disabled={busy === c.id}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-50"
                  >
                    بازگشت به انتظار
                  </button>
                )}

                {/* پاسخ فقط به نظر ریشه — پاسخ به پاسخ رشته‌ای می‌سازد که صفحه جایی برای نمایشش ندارد */}
                {!c.parent && (
                  <button
                    onClick={() => {
                      setReplyFor(replyFor === c.id ? null : c.id);
                      setReplyText("");
                    }}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    پاسخ فروشگاه
                  </button>
                )}

                <span className="mt-3 text-[11px] text-gray-400">
                  {c.helpfulYes.toLocaleString("fa-IR")} مفید ·{" "}
                  {c.helpfulNo.toLocaleString("fa-IR")} غیرمفید
                </span>

                <button
                  onClick={() => remove(c.id)}
                  disabled={busy === c.id}
                  className="mt-3 mr-auto px-3 py-1.5 rounded-xl text-xs font-black bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
