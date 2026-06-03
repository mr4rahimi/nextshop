"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Product {
  id: string; title: string; slug: string; mainImage: string | null;
  price: string; salePrice: string | null; images: { url: string }[];
}
interface Comment {
  id: string; content: string; createdAt: string; name: string | null;
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null } | null;
  replies: Comment[];
}
interface Post {
  id: string; title: string; slug: string; excerpt: string | null;
  content: string; coverImage: string | null; videoUrl: string | null;
  publishedAt: string | null; readingTime: number; viewCount: number;
  category: { title: string; slug: string } | null;
  tags: { tag: { title: string; slug: string } }[];
  relatedProducts: { product: Product }[];
  comments: Comment[];
  _count: { comments: number };
}
interface Related {
  id: string; title: string; slug: string; coverImage: string | null;
  publishedAt: string | null; readingTime: number;
  category: { title: string; slug: string } | null;
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

// استخراج عناوین H2 از HTML
function extractHeadings(html: string) {
  const matches = [...html.matchAll(/<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/gi)];
  if (matches.length === 0) {
    // اگه id نداشت، از متن استخراج
    const raw = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)];
    return raw.map((m, i) => ({ id: `heading-${i}`, text: m[1].replace(/<[^>]+>/g, "") }));
  }
  return matches.map(m => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, "") }));
}

// تزریق id به h2 ها
function injectHeadingIds(html: string) {
  let idx = 0;
  return html.replace(/<h2([^>]*)>/gi, (_, attrs) => {
    if (attrs.includes("id=")) return `<h2${attrs}>`;
    return `<h2${attrs} id="heading-${idx++}">`;
  });
}

function ShareButtons({ title, url: urlProp }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(urlProp || window.location.href);
  }, [urlProp]);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-black text-gray-500">اشتراک‌گذاری:</span>
      <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer"
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-all">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.026 9.546c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 14.71l-2.965-.924c-.645-.204-.657-.645.136-.953l11.57-4.461c.537-.194 1.006.131.641.876z" /></svg>
      </a>
      <a href={`https://wa.me/?text=${encodeURIComponent(title + " " + url)}`} target="_blank" rel="noopener noreferrer"
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20 text-green-500 hover:bg-green-100 transition-all">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
      </a>
      <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${copied ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"}`}>
        {copied ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        )}
      </button>
    </div>
  );
}

function CommentForm({ postSlug, onSubmit }: { postSlug: string; onSubmit: (c: Comment) => void }) {
  const [name, setName]       = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    const res = await fetch(`/api/mag/${postSlug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    setSending(false); setSent(true);
    setName(""); setContent("");
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6">
      <h4 className="font-black text-sm text-gray-900 dark:text-white">ثبت نظر</h4>
      {sent ? (
        <div className="py-4 text-center">
          <p className="text-sm font-bold text-emerald-600">✓ نظر شما دریافت شد و پس از تأیید نمایش داده می‌شود</p>
        </div>
      ) : (
        <>
          <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500"
            placeholder="نام شما (اختیاری)" value={name} onChange={e => setName(e.target.value)} />
          <textarea rows={4} required className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 resize-none"
            placeholder="نظر شما..." value={content} onChange={e => setContent(e.target.value)} />
          <button type="submit" disabled={sending || !content.trim()}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black hover:bg-primary-700 disabled:opacity-60 transition-all">
            {sending ? "ارسال..." : "ارسال نظر"}
          </button>
        </>
      )}
    </form>
  );
}

export default function MagPostClient({ post, related }: { post: Post; related: Related[] }) {
  const [activeHeading, setActiveHeading] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const processedContent = injectHeadingIds(post.content);
  const headings = extractHeadings(processedContent);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const pageUrl = "";

  // scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveHeading(e.target.id); });
    }, { rootMargin: "-100px 0px -60% 0px" });
    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [processedContent]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505]" dir="rtl">

      {/* ── تصویر شاخص ─────────────────────────────────────── */}
      {post.coverImage && (
        <div className="relative h-[50vh] overflow-hidden bg-gray-900">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="container py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* ── محتوای اصلی ─────────────────────────────────── */}
          <article className="lg:col-span-8 space-y-8">

            {/* هدر مطلب */}
            <div className="bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-[2.5rem] p-8 space-y-5">
              {/* خرده‌نان */}
              <nav className="flex items-center gap-2 text-xs text-gray-400">
                <Link href="/mag" className="hover:text-primary-600 transition-colors">مجله</Link>
                {post.category && (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <Link href={`/mag?cat=${post.category.slug}`} className="hover:text-primary-600 transition-colors">{post.category.title}</Link>
                  </>
                )}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                <span className="text-gray-600 dark:text-gray-300 line-clamp-1">{post.title}</span>
              </nav>

              {post.category && (
                <Link href={`/mag?cat=${post.category.slug}`}
                  className="inline-block px-3 py-1 bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-black rounded-xl hover:bg-primary-500/20 transition-all">
                  {post.category.title}
                </Link>
              )}

              <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white leading-tight">{post.title}</h1>

              {post.excerpt && (
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed border-r-4 border-primary-500 pr-4">{post.excerpt}</p>
              )}

              {/* متا */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-white/5">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {formatDate(post.publishedAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {toFa(post.readingTime)} دقیقه مطالعه
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  {toFa(post.viewCount)} بازدید
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  {toFa(post._count.comments)} نظر
                </span>
                <ShareButtons title={post.title} url={pageUrl} />
              </div>
            </div>

            {/* ویدیو */}
            {post.videoUrl && (
              <div className="bg-white dark:bg-gray-900/60 rounded-[2.5rem] overflow-hidden">
                <div className="aspect-video">
                  <iframe src={post.videoUrl.includes("youtu") ? post.videoUrl.replace("watch?v=", "embed/") : post.videoUrl}
                    className="w-full h-full" allowFullScreen />
                </div>
              </div>
            )}

            {/* محتوا */}
            <div ref={contentRef}
              className="bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-[2.5rem] p-8 prose prose-base dark:prose-invert max-w-none prose-headings:font-black prose-a:text-primary-600 prose-img:rounded-2xl prose-blockquote:border-primary-500 prose-code:text-primary-600 dark:prose-code:text-primary-400"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />

            {/* تگ‌ها */}
            {post.tags.length > 0 && (
              <div className="bg-white dark:bg-gray-900/60 rounded-[2.5rem] p-6 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-gray-400 ml-2">تگ‌ها:</span>
                {post.tags.map(({ tag }) => (
                  <Link key={tag.slug} href={`/mag?tag=${tag.slug}`}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl text-xs font-bold hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 transition-all">
                    #{tag.title}
                  </Link>
                ))}
              </div>
            )}

            {/* اشتراک‌گذاری */}
            <div className="bg-white dark:bg-gray-900/60 rounded-[2.5rem] p-6">
              <ShareButtons title={post.title} url={pageUrl} />
            </div>

            {/* محصولات مرتبط */}
            {post.relatedProducts.length > 0 && (
              <div className="bg-white dark:bg-gray-900/60 rounded-[2.5rem] p-8 space-y-5">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-primary-500 rounded-full" />
                  محصولات معرفی‌شده در این مطلب
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {post.relatedProducts.map(({ product: p }) => {
                    const img   = p.mainImage ?? p.images[0]?.url ?? null;
                    const price = Number(p.salePrice ?? p.price);
                    const orig  = Number(p.price);
                    const disc  = p.salePrice && Number(p.salePrice) < orig ? Math.round(((orig - price) / orig) * 100) : 0;
                    return (
                      <Link key={p.id} href={`/products/${p.slug}`}
                        className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-primary-500/30 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all group">
                        <div className="w-16 h-16 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {img ? <img src={img} alt={p.title} className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform" /> : <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary-600 transition-colors">{p.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {disc > 0 && <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-lg">{toFa(disc)}٪</span>}
                            <span className="text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums">{Number(price).toLocaleString("fa-IR")} ت</span>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* نظرات */}
            <div className="bg-white dark:bg-gray-900/60 rounded-[2.5rem] p-8 space-y-6">
              <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-3">
                <span className="w-1.5 h-6 bg-primary-500 rounded-full" />
                نظرات ({toFa(post._count.comments)})
              </h3>

              <CommentForm postSlug={post.slug} onSubmit={c => setComments(p => [c, ...p])} />

              {comments.length > 0 && (
                <div className="space-y-4">
                  {comments.map(c => {
                    const name = c.user ? [c.user.firstName, c.user.lastName].filter(Boolean).join(" ") : c.name ?? "ناشناس";
                    return (
                      <div key={c.id} className="space-y-3">
                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                          <div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center flex-shrink-0 font-black text-primary-600">
                            {name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-black text-gray-900 dark:text-white">{name}</p>
                              <p className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("fa-IR")}</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                        {c.replies.map(r => {
                          const rName = r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") : r.name ?? "ناشناس";
                          return (
                            <div key={r.id} className="flex items-start gap-4 p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-2xl mr-8">
                              <div className="w-8 h-8 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black text-primary-600">
                                {rName.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs font-black text-primary-600 dark:text-primary-400">{rName}</p>
                                  <span className="text-[10px] text-gray-400">پاسخ ادمین</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{r.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </article>

          {/* ── سایدبار ─────────────────────────────────────── */}
          <aside className="lg:col-span-4 space-y-6">

            {/* فهرست مطالب */}
            {headings.length > 0 && (
              <div className="lg:sticky lg:top-24 bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-[2.5rem] p-6 space-y-4">
                <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  فهرست مطالب
                </h3>
                <nav className="space-y-1">
                  {headings.map(h => (
                    <a key={h.id} href={`#${h.id}`}
                      className={`block text-sm py-2 px-3 rounded-xl transition-all leading-relaxed ${activeHeading === h.id ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* مطالب مرتبط */}
            {related.length > 0 && (
              <div className="bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-[2.5rem] p-6 space-y-4">
                <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  مطالب مرتبط
                </h3>
                <div className="space-y-4">
                  {related.map(r => (
                    <Link key={r.id} href={`/mag/${r.slug}`}
                      className="group flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl p-2 -mx-2 transition-all">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                        {r.coverImage
                          ? <img src={r.coverImage} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          : <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/10" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-2 leading-relaxed group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          <span>{toFa(r.readingTime)} دقیقه</span>
                          <span>·</span>
                          <span>{formatDate(r.publishedAt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>

        </div>
      </div>
    </div>
  );
}