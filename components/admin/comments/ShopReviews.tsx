"use client";

/**
 * تب «نظرات فروشگاه» — نظرهای ثبت‌شده روی محصولات.
 *
 * مستندات: docs/features/reviews.md
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  pros: string[];
  cons: string[];
  recommends: boolean | null;
  isBuyer: boolean;
  status: string;
  helpfulYes: number;
  helpfulNo: number;
  replyBody: string | null;
  guestName: string | null;
  guestEmail: string | null;
  createdAt: string;
  product: { id: string; title: string; slug: string; mainImage: string | null };
  user: { firstName: string | null; lastName: string | null; phone: string } | null;
  replyBy: { firstName: string | null; lastName: string | null } | null;
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

function authorName(r: Review): string {
  if (r.user) {
    const name = [r.user.firstName, r.user.lastName].filter(Boolean).join(" ").trim();
    if (name) return name;
    return r.user.phone;
  }
  return r.guestName?.trim() || "مهمان";
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} از ۵`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= rating ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.35 4.15a1 1 0 00.95.69h4.37c.97 0 1.37 1.24.59 1.81l-3.54 2.57a1 1 0 00-.36 1.12l1.35 4.15c.3.92-.75 1.69-1.54 1.12l-3.53-2.57a1 1 0 00-1.18 0l-3.53 2.57c-.79.57-1.84-.2-1.54-1.12l1.35-4.15a1 1 0 00-.36-1.12L2.24 9.58c-.79-.57-.38-1.81.58-1.81h4.38a1 1 0 00.95-.69l1.35-4.15z" />
        </svg>
      ))}
    </span>
  );
}

export default function ShopReviews() {
  const [status, setStatus] = useState("PENDING");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * داده و کلیدِ درخواستی که آن را آورده، با هم نگه داشته می‌شوند.
   * «در حال بارگذاری» از مقایسه‌ی این دو مشتق می‌شود، نه از یک state جدا —
   * وگرنه با هر تعویض تب یک رندر اضافه و یک لحظه داده‌ی تب قبلی می‌دیدیم.
   */
  const [data, setData] = useState<{
    key: string;
    reviews: Review[];
    counts: Record<string, number>;
  } | null>(null);

  const [reloadAt, setReloadAt] = useState(0);
  const key = `${status}|${query}|${reloadAt}`;

  const reviews = data?.reviews ?? [];
  const counts = data?.counts ?? {};
  const loading = data?.key !== key;

  const reload = useCallback(() => setReloadAt(Date.now()), []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/reviews?status=${status}&q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setData({ key, reviews: d.reviews ?? [], counts: d.counts ?? {} });
        }
      })
      .catch(() => {
        if (alive) setData({ key, reviews: [], counts: {} });
      });
    return () => {
      alive = false;
    };
  }, [key, status, query]);

  async function setReviewStatus(id: string, next: string) {
    setBusy(id);
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("این نظر برای همیشه حذف شود؟")) return;
    setBusy(id);
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    setBusy(null);
    reload();
  }

  async function saveReply(id: string) {
    setBusy(id);
    await fetch(`/api/admin/reviews/${id}`, {
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
            placeholder="جستجو در نظرها یا نام محصول"
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
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))
        ) : reviews.length === 0 ? (
          <p className="text-center py-16 text-sm text-gray-400">نظری در این وضعیت نیست</p>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {authorName(r)}
                </span>

                {r.isBuyer && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                    خریدار
                  </span>
                )}

                {!r.user && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500">
                    مهمان
                  </span>
                )}

                <Stars rating={r.rating} />

                <span className="text-[11px] text-gray-400">{persianDate(r.createdAt)}</span>

                <Link
                  href={`/products/${r.product.slug}`}
                  target="_blank"
                  className="mr-auto text-[11px] text-blue-600 hover:underline"
                >
                  {r.product.title}
                </Link>
              </div>

              {r.title && (
                <p className="text-sm font-black text-gray-800 dark:text-gray-200">{r.title}</p>
              )}
              {r.body && (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-7">{r.body}</p>
              )}

              {(r.pros.length > 0 || r.cons.length > 0 || r.recommends !== null) && (
                <div className="flex flex-wrap gap-2">
                  {r.pros.map((p, i) => (
                    <span
                      key={`p${i}`}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                    >
                      + {p}
                    </span>
                  ))}
                  {r.cons.map((c, i) => (
                    <span
                      key={`c${i}`}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-900/20 text-red-500"
                    >
                      − {c}
                    </span>
                  ))}
                  {r.recommends !== null && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {r.recommends ? "این محصول را پیشنهاد می‌کند" : "این محصول را پیشنهاد نمی‌کند"}
                    </span>
                  )}
                </div>
              )}

              {r.replyBody && (
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-[11px] font-black text-gray-500 mb-1.5">
                    پاسخ فروشگاه
                    {r.replyBy &&
                      ` — ${[r.replyBy.firstName, r.replyBy.lastName].filter(Boolean).join(" ")}`}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-7">{r.replyBody}</p>
                </div>
              )}

              {replyFor === r.id && (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="پاسخ فروشگاه — زیر همین نظر در صفحه‌ی محصول دیده می‌شود"
                    className="w-full px-4 py-3 rounded-2xl text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none focus:border-gray-400 leading-7"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveReply(r.id)}
                      disabled={busy === r.id}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50"
                    >
                      ذخیره پاسخ
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
                {r.status !== "APPROVED" && (
                  <button
                    onClick={() => setReviewStatus(r.id, "APPROVED")}
                    disabled={busy === r.id}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    تأیید و انتشار
                  </button>
                )}

                {r.status !== "REJECTED" && (
                  <button
                    onClick={() => setReviewStatus(r.id, "REJECTED")}
                    disabled={busy === r.id}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 disabled:opacity-50"
                  >
                    رد
                  </button>
                )}

                {r.status !== "PENDING" && (
                  <button
                    onClick={() => setReviewStatus(r.id, "PENDING")}
                    disabled={busy === r.id}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-50"
                  >
                    بازگشت به انتظار
                  </button>
                )}

                <button
                  onClick={() => {
                    setReplyFor(replyFor === r.id ? null : r.id);
                    setReplyText(r.replyBody ?? "");
                  }}
                  className="mt-3 px-3 py-1.5 rounded-xl text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  {r.replyBody ? "ویرایش پاسخ" : "پاسخ فروشگاه"}
                </button>

                <span className="mt-3 text-[11px] text-gray-400">
                  {r.helpfulYes.toLocaleString("fa-IR")} مفید ·{" "}
                  {r.helpfulNo.toLocaleString("fa-IR")} غیرمفید
                </span>

                <button
                  onClick={() => remove(r.id)}
                  disabled={busy === r.id}
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
