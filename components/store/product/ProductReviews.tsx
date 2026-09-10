"use client";

/**
 * بخش نظرات صفحه‌ی محصول.
 *
 * دو تصمیم که ظاهر این فایل را توضیح می‌دهند:
 *
 * ۱. **فرم برای همه باز است.** مهمان فقط نام می‌نویسد. اگر کاربر وارد شده
 *    باشد نامش از پروفایل خوانده می‌شود و فیلد نام اصلاً نشان داده نمی‌شود.
 *    درِ بسته برابر است با صفر نظر، و صفحه‌ی محصولِ بدون نظر در گوگل
 *    ستاره نمی‌گیرد.
 *
 * ۲. **فهرست نظرها همیشه در DOM است**، حتی وقتی تب فعال نیست — درست مثل
 *    بقیه‌ی تب‌های این صفحه. اسکیمای Review بدون متن متناظر روی صفحه
 *    نامعتبر است.
 *
 * مستندات: docs/features/reviews.md
 */

import { useEffect, useState } from "react";
import { useHelpfulVotes } from "@/components/store/useHelpfulVotes";

export interface StoreReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  pros: string[];
  cons: string[];
  recommends: boolean | null;
  isBuyer: boolean;
  helpfulYes: number;
  helpfulNo: number;
  replyBody: string | null;
  replyAt: string | null;
  guestName: string | null;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null } | null;
  replyBy: { firstName: string | null; lastName: string | null } | null;
}

export interface ReviewStats {
  distribution: { star: number; count: number }[];
  recommendYes: number;
  recommendTotal: number;
}

interface Props {
  productId: string;
  productTitle: string;
  ratingAvg: number;
  ratingCount: number;
  reviews: StoreReview[];
  stats?: ReviewStats;
}

const MAX_LIST = 3;

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

function authorName(r: StoreReview): string {
  if (r.user) {
    const name = [r.user.firstName, r.user.lastName].filter(Boolean).join(" ").trim();
    if (name) return name;
  }
  return r.guestName?.trim() || "کاربر مهمان";
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return (parts[0]?.[0] ?? "ک") + (parts[1] ? "." + parts[1][0] : "");
}

function Stars({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`${size} fill-current ${
            i <= Math.round(rating) ? "text-yellow-400" : "text-gray-300 dark:text-gray-700"
          }`}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/** ورودی چندتایی نقاط قوت یا ضعف */
function NoteInput({
  label,
  placeholder,
  tone,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  tone: "pro" | "con";
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text || items.includes(text) || items.length >= 5) return;
    onChange([...items, text]);
    setDraft("");
  }

  const chip =
    tone === "pro"
      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
      : "bg-red-50 dark:bg-red-900/20 text-red-500";

  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">{label}</label>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          maxLength={80}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 rounded-2xl text-[13px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-white/10 outline-none focus:border-primary-600"
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-2.5 rounded-2xl text-[12px] font-black bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
        >
          افزودن
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold ${chip}`}
            >
              {item} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductReviews({
  productId,
  productTitle,
  ratingAvg,
  ratingCount,
  reviews,
  stats,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // نام کاربر وارد‌شده. `null` یعنی هنوز نمی‌دانیم، رشته‌ی خالی یعنی مهمان.
  const [viewerName, setViewerName] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [recommends, setRecommends] = useState<boolean | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const { voted, extra, vote } = useHelpfulVotes(
    "review-votes",
    (id) => `/api/store/reviews/${id}/vote`,
  );

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const full = d
          ? [d.firstName, d.lastName].filter(Boolean).join(" ").trim()
          : "";
        setViewerName(d ? full || "حساب کاربری شما" : "");
      })
      .catch(() => setViewerName(""));
  }, []);

  const isGuest = viewerName === "";

  const maxBucket = Math.max(1, ...(stats?.distribution ?? []).map((d) => d.count));

  const recommendPercent =
    stats && stats.recommendTotal > 0
      ? Math.round((stats.recommendYes / stats.recommendTotal) * 100)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (rating < 1) {
      setError("امتیاز خود را با ستاره‌ها مشخص کنید");
      return;
    }
    if (body.trim().length < 3) {
      setError("متن نظر را بنویسید");
      return;
    }
    if (isGuest && name.trim().length < 2) {
      setError("نام خود را بنویسید");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          title,
          body,
          pros,
          cons,
          recommends,
          guestName: isGuest ? name : undefined,
          guestEmail: isGuest ? email : undefined,
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

  return (
    <div className="space-y-10" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* خلاصه‌ی امتیازها */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative overflow-hidden p-8 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-3xl border border-white dark:border-white/10 rounded-[2.5rem] shadow-2xl">
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-black text-zinc-400 mb-2 uppercase tracking-widest">
                امتیاز کلی
              </span>
              <span className="block text-6xl font-black text-zinc-900 dark:text-white tracking-tighter mb-3">
                {fa(ratingAvg)}
              </span>
              <Stars rating={ratingAvg} size="w-5 h-5" />
              <p className="text-[13px] font-bold text-zinc-500 mt-3">
                از {fa(ratingCount)} نظر تأییدشده
              </p>
            </div>

            {stats && ratingCount > 0 && (
              <div className="mt-7 space-y-2">
                {stats.distribution.map((d) => (
                  <div key={d.star} className="flex items-center gap-3">
                    <span className="text-[12px] font-black text-zinc-500 w-8">{fa(d.star)} ★</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: `${(d.count / maxBucket) * 100}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-bold text-zinc-400 w-8 text-left">
                      {fa(d.count)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {recommendPercent !== null && (
              <p className="mt-6 text-center text-[13px] font-black text-emerald-600">
                {fa(recommendPercent)}٪ خریداران این محصول را پیشنهاد می‌کنند
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="w-full py-4 rounded-[2rem] text-[14px] font-black bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-all"
          >
            {formOpen ? "بستن فرم" : "ثبت نظر درباره این محصول"}
          </button>

          <p className="text-[12px] font-bold text-zinc-400 leading-6 text-center">
            برای ثبت نظر نیازی به ساختن حساب کاربری نیست. نظر شما پس از تأیید منتشر می‌شود.
          </p>
        </div>

        {/* فهرست نظرها */}
        <div className="lg:col-span-8 space-y-5">
          {formOpen && (
            <div className="p-8 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2.5rem]">
              {done ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-[16px] font-black text-emerald-600">نظر شما ثبت شد</p>
                  <p className="text-[13px] font-bold text-zinc-500 leading-7">
                    پس از تأیید مدیر فروشگاه، نظرتان در همین صفحه منتشر می‌شود.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <p className="text-[15px] font-black text-zinc-900 dark:text-white">
                    نظر شما درباره {productTitle}
                  </p>

                  <div className="space-y-2">
                    <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">
                      امتیاز شما
                    </label>
                    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setRating(i)}
                          onMouseEnter={() => setHover(i)}
                          aria-label={`${i} ستاره`}
                          className="p-1"
                        >
                          <svg
                            className={`w-8 h-8 fill-current transition-colors ${
                              i <= (hover || rating)
                                ? "text-yellow-400"
                                : "text-gray-300 dark:text-zinc-700"
                            }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>

                  {isGuest ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">
                          نام شما
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={60}
                          placeholder="نامی که زیر نظر دیده می‌شود"
                          className="w-full px-4 py-3 rounded-2xl text-[13px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-white/10 outline-none focus:border-primary-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">
                          ایمیل <span className="font-bold text-zinc-400">(اختیاری)</span>
                        </label>
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          maxLength={120}
                          dir="ltr"
                          placeholder="نمایش داده نمی‌شود"
                          className="w-full px-4 py-3 rounded-2xl text-[13px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-white/10 outline-none focus:border-primary-600 text-right"
                        />
                      </div>
                    </div>
                  ) : viewerName ? (
                    <p className="text-[13px] font-bold text-zinc-500">
                      نظر با نام «{viewerName}» ثبت می‌شود.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">
                      عنوان نظر <span className="font-bold text-zinc-400">(اختیاری)</span>
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder="در یک جمله، خلاصه‌ی تجربه‌تان"
                      className="w-full px-4 py-3 rounded-2xl text-[13px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-white/10 outline-none focus:border-primary-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">
                      متن نظر
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      maxLength={2000}
                      placeholder="چه چیزی را پسندیدید و چه چیزی را نه؟ تجربه‌ی واقعی شما به بقیه کمک می‌کند."
                      className="w-full px-4 py-3 rounded-2xl text-[13px] leading-7 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-white/10 outline-none focus:border-primary-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <NoteInput
                      label="نقاط قوت"
                      placeholder="مثلاً: کیفیت چاپ عالی"
                      tone="pro"
                      items={pros}
                      onChange={setPros}
                    />
                    <NoteInput
                      label="نقاط ضعف"
                      placeholder="مثلاً: بسته‌بندی ضعیف"
                      tone="con"
                      items={cons}
                      onChange={setCons}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[13px] font-black text-zinc-700 dark:text-zinc-300">
                      این محصول را به دیگران پیشنهاد می‌کنید؟
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: true, label: "بله، پیشنهاد می‌کنم" },
                        { value: false, label: "خیر" },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() =>
                            setRecommends(recommends === opt.value ? null : opt.value)
                          }
                          className={`px-5 py-2.5 rounded-2xl text-[12px] font-black transition-all ${
                            recommends === opt.value
                              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                              : "bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="text-[13px] font-black text-red-500">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full py-4 rounded-[2rem] text-[14px] font-black bg-primary-600 text-white hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {sending ? "در حال ثبت…" : "ثبت نظر"}
                  </button>
                </form>
              )}
            </div>
          )}

          {reviews.length === 0 ? (
            <div className="text-center py-16 px-8 bg-white/40 dark:bg-zinc-900/40 border border-gray-200 dark:border-white/10 rounded-[2.5rem]">
              <p className="text-[14px] font-black text-zinc-600 dark:text-zinc-300">
                هنوز نظری برای {productTitle} ثبت نشده است
              </p>
              <p className="mt-2 text-[13px] font-bold text-zinc-400">
                اولین نفری باشید که تجربه‌اش را می‌نویسد.
              </p>
            </div>
          ) : (
            <>
              {/* همه‌ی نظرها در DOM می‌مانند و اضافی‌ها فقط با CSS پنهان
                  می‌شوند — همان قاعده‌ی تب‌ها. نظری که در اسکیمای Review هست
                  ولی روی صفحه نیست، از نظر گوگل نامعتبر است. */}
              {reviews.map((r, index) => {
                const name = authorName(r);
                const helpful = r.helpfulYes + (extra[r.id] ?? 0);
                const collapsed = !showAll && index >= MAX_LIST;
                return (
                  <article
                    key={r.id}
                    className={`group relative p-7 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2.5rem] transition-all hover:shadow-xl ${
                      collapsed ? "hidden" : ""
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-primary-600/10 flex items-center justify-center text-primary-600 font-black text-[15px] border border-primary-600/20">
                          {initials(name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-black text-zinc-900 dark:text-white">
                              {name}
                            </p>
                            {r.isBuyer && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                خریدار
                              </span>
                            )}
                          </div>
                          <time
                            dateTime={r.createdAt}
                            className="text-[12px] font-bold text-zinc-400 mt-1 block"
                          >
                            {persianDate(r.createdAt)}
                          </time>
                        </div>
                      </div>
                      <Stars rating={r.rating} size="w-4 h-4" />
                    </div>

                    {r.title && (
                      <h3 className="mt-4 text-[15px] font-black text-zinc-800 dark:text-zinc-200">
                        {r.title}
                      </h3>
                    )}
                    {r.body && (
                      <p className="mt-3 text-[14px] font-medium text-zinc-600 dark:text-zinc-300 leading-8">
                        {r.body}
                      </p>
                    )}

                    {(r.pros.length > 0 || r.cons.length > 0) && (
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {r.pros.length > 0 && (
                          <div>
                            <p className="text-[12px] font-black text-emerald-600 mb-2">نقاط قوت</p>
                            <ul className="space-y-1.5">
                              {r.pros.map((p, i) => (
                                <li
                                  key={i}
                                  className="text-[13px] font-bold text-zinc-600 dark:text-zinc-300 flex gap-2"
                                >
                                  <span className="text-emerald-500">+</span>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.cons.length > 0 && (
                          <div>
                            <p className="text-[12px] font-black text-red-500 mb-2">نقاط ضعف</p>
                            <ul className="space-y-1.5">
                              {r.cons.map((c, i) => (
                                <li
                                  key={i}
                                  className="text-[13px] font-bold text-zinc-600 dark:text-zinc-300 flex gap-2"
                                >
                                  <span className="text-red-400">−</span>
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {r.recommends !== null && (
                      <p
                        className={`mt-4 text-[12px] font-black ${
                          r.recommends ? "text-emerald-600" : "text-zinc-400"
                        }`}
                      >
                        {r.recommends
                          ? "این محصول را پیشنهاد می‌کند"
                          : "این محصول را پیشنهاد نمی‌کند"}
                      </p>
                    )}

                    {r.replyBody && (
                      <div className="mt-5 rounded-[1.75rem] bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-white/10 p-5">
                        <p className="text-[12px] font-black text-primary-600 mb-2">پاسخ فروشگاه</p>
                        <p className="text-[13px] font-bold text-zinc-600 dark:text-zinc-300 leading-7">
                          {r.replyBody}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-gray-200 dark:border-white/10 flex items-center gap-3">
                      <span className="text-[12px] font-bold text-zinc-400">این نظر مفید بود؟</span>
                      <button
                        type="button"
                        onClick={() => vote(r.id, true)}
                        disabled={Boolean(voted[r.id])}
                        className="px-3.5 py-1.5 rounded-xl text-[12px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 disabled:opacity-50"
                      >
                        بله {helpful > 0 ? `(${fa(helpful)})` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => vote(r.id, false)}
                        disabled={Boolean(voted[r.id])}
                        className="px-3.5 py-1.5 rounded-xl text-[12px] font-black bg-gray-100 dark:bg-zinc-800 text-zinc-500 disabled:opacity-50"
                      >
                        خیر
                      </button>
                      {voted[r.id] && (
                        <span className="text-[11px] font-bold text-zinc-400">رأی شما ثبت شد</span>
                      )}
                    </div>
                  </article>
                );
              })}

              {reviews.length > MAX_LIST && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full py-3.5 rounded-[2rem] text-[13px] font-black bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  {showAll
                    ? "نمایش کمتر"
                    : `نمایش همه‌ی ${fa(reviews.length)} نظر`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
