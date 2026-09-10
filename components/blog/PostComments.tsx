"use client";

/**
 * بخش نظرات صفحه‌ی مقاله.
 *
 * قواعدش عمداً همان قواعد نظرات محصول است (`ProductReviews`): فرم برای همه
 * باز است، نظر تازه تا تأیید ادمین منتشر نمی‌شود، و نظرهای تأییدشده همیشه
 * در DOM می‌مانند تا با اسکیمای `Comment` صفحه بخوانند.
 *
 * تفاوتش با نظرات محصول: اینجا امتیاز ستاره‌ای نیست و به‌جایش گفتگو هست —
 * هر کسی می‌تواند به یک نظر پاسخ بدهد، و پاسخ فروشگاه هم با همان ساختار
 * ولی با برچسب خودش نمایش داده می‌شود.
 *
 * مستندات: docs/features/reviews.md
 */

import { useEffect, useState } from "react";
import { useHelpfulVotes } from "@/components/store/useHelpfulVotes";

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  name: string | null;
  isStaffReply: boolean;
  helpfulYes: number;
  helpfulNo: number;
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null } | null;
  replies?: PostComment[];
}

interface Props {
  postSlug: string;
  postTitle: string;
  comments: PostComment[];
  commentCount: number;
}

function fa(n: number): string {
  return n.toLocaleString("fa-IR");
}

function persianDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function authorName(c: PostComment): string {
  if (c.isStaffReply && !c.user) return "پشتیبانی فروشگاه";
  if (c.user) {
    const full = [c.user.firstName, c.user.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
  }
  return c.name?.trim() || "کاربر مهمان";
}

/**
 * فرم ثبت نظر — هم برای نظر تازه و هم برای پاسخ به یک نظر.
 *
 * `parentId` تنها چیزی است که این دو حالت را از هم جدا می‌کند.
 */
function CommentForm({
  postSlug,
  parentId,
  isGuest,
  viewerName,
  compact,
  onCancel,
}: {
  postSlug: string;
  parentId?: string;
  isGuest: boolean;
  viewerName: string;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (content.trim().length < 3) {
      setError("متن نظر را بنویسید");
      return;
    }
    if (isGuest && name.trim().length < 2) {
      setError("نام خود را بنویسید");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/mag/${postSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parentId,
          name: isGuest ? name : undefined,
          email: isGuest ? email : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ثبت نظر انجام نشد");
        return;
      }
      setDone(true);
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-5 text-center">
        <p className="text-sm font-black text-emerald-600">نظر شما ثبت شد</p>
        <p className="mt-1.5 text-[13px] font-bold text-emerald-700/70 dark:text-emerald-400/70 leading-6">
          پس از تأیید مدیر، در همین صفحه منتشر می‌شود.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`space-y-4 rounded-2xl ${
        compact ? "bg-gray-50 dark:bg-gray-800/50 p-5" : "bg-gray-50 dark:bg-gray-800/50 p-6"
      }`}
    >
      {!compact && (
        <h4 className="font-black text-sm text-gray-900 dark:text-white">ثبت نظر</h4>
      )}

      {isGuest ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="نام شما"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={120}
            dir="ltr"
            placeholder="ایمیل (اختیاری، نمایش داده نمی‌شود)"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 text-right"
          />
        </div>
      ) : viewerName ? (
        <p className="text-[13px] font-bold text-gray-500 dark:text-gray-400">
          نظر با نام «{viewerName}» ثبت می‌شود.
        </p>
      ) : null}

      <textarea
        rows={compact ? 3 : 4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        placeholder={parentId ? "پاسخ شما..." : "نظر شما..."}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 resize-none leading-7"
      />

      {error && <p className="text-[13px] font-black text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black hover:bg-primary-700 disabled:opacity-60 transition-all"
        >
          {sending ? "در حال ارسال…" : parentId ? "ارسال پاسخ" : "ارسال نظر"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-black bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            انصراف
          </button>
        )}
      </div>
    </form>
  );
}

export default function PostComments({
  postSlug,
  postTitle,
  comments,
  commentCount,
}: Props) {
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { voted, extra, vote } = useHelpfulVotes(
    "blog-comment-votes",
    (id) => `/api/store/blog-comments/${id}/vote`,
  );

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const full = d ? [d.firstName, d.lastName].filter(Boolean).join(" ").trim() : "";
        setViewerName(d ? full || "حساب کاربری شما" : "");
      })
      .catch(() => setViewerName(""));
  }, []);

  const isGuest = viewerName === "";

  function CommentBody({ c, isReply }: { c: PostComment; isReply: boolean }) {
    const name = authorName(c);
    const helpful = c.helpfulYes + (extra[c.id] ?? 0);

    return (
      <article
        className={`flex items-start gap-4 p-4 rounded-2xl ${
          c.isStaffReply
            ? "bg-primary-50/50 dark:bg-primary-900/10"
            : "bg-gray-50 dark:bg-gray-800/50"
        }`}
      >
        <div
          className={`rounded-2xl bg-primary-500/10 flex items-center justify-center flex-shrink-0 font-black text-primary-600 ${
            isReply ? "w-8 h-8 text-xs" : "w-10 h-10"
          }`}
        >
          {name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p
              className={`font-black text-gray-900 dark:text-white ${
                isReply ? "text-xs" : "text-sm"
              }`}
            >
              {name}
            </p>
            {c.isStaffReply && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-primary-500/10 text-primary-600">
                پاسخ فروشگاه
              </span>
            )}
            <time dateTime={c.createdAt} className="mr-auto text-[10px] text-gray-400">
              {persianDate(c.createdAt)}
            </time>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-8 whitespace-pre-line">
            {c.content}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => vote(c.id, true)}
              disabled={Boolean(voted[c.id])}
              className="px-3 py-1 rounded-lg text-[11px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 disabled:opacity-50"
            >
              مفید بود {helpful > 0 ? `(${fa(helpful)})` : ""}
            </button>

            {!isReply && (
              <button
                type="button"
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                className="px-3 py-1 rounded-lg text-[11px] font-black bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
              >
                {replyTo === c.id ? "بستن" : "پاسخ"}
              </button>
            )}

            {voted[c.id] && (
              <span className="text-[10px] font-bold text-gray-400">رأی شما ثبت شد</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-3">
        <span className="w-1.5 h-6 bg-primary-500 rounded-full" />
        نظرات ({fa(commentCount)})
      </h3>

      <CommentForm
        postSlug={postSlug}
        isGuest={isGuest}
        viewerName={viewerName ?? ""}
      />

      <p className="text-[12px] font-bold text-gray-400 leading-6">
        برای ثبت نظر نیازی به ساختن حساب کاربری نیست. نظر شما پس از تأیید منتشر می‌شود.
      </p>

      {comments.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">
          هنوز نظری برای «{postTitle}» ثبت نشده است. اولین نفر باشید.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="space-y-3">
              <CommentBody c={c} isReply={false} />

              {replyTo === c.id && (
                <div className="mr-8">
                  <CommentForm
                    postSlug={postSlug}
                    parentId={c.id}
                    isGuest={isGuest}
                    viewerName={viewerName ?? ""}
                    compact
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              )}

              {(c.replies ?? []).map((r) => (
                <div key={r.id} className="mr-8">
                  <CommentBody c={r} isReply />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
