"use client";

/**
 * صفحه‌ی مقاله (/mag/[slug]) — پوسته‌ی `.mag-root` با روز/شب.
 *
 * HTML مقاله پیش از رندر از `enhanceRichHtml` می‌گذرد (شناسه‌ی سرتیترها،
 * پیچیدن جدول‌ها، اصلاح لینک داخلی) و با `.rich-content.article-body`
 * استایل می‌گیرد — هر دو در app/styles.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft, CalendarDays, Clock, Eye, MessageCircle, Copy, Check, ListTree, ArrowUp, Share2, RefreshCw,
} from "lucide-react";
import FaqSection from "@/components/store/FaqSection";
import PostComments, { type PostComment } from "@/components/blog/PostComments";
import { normalizeFaq } from "@/lib/faq";
import { enhanceRichHtml, type RichHeading } from "@/lib/rich-html";
import { PostCardH, formatDate, toFa, type MagPost } from "@/components/blog/mag-ui";

interface Product {
  id: string; title: string; slug: string; mainImage: string | null;
  price: string; salePrice: string | null; images: { url: string }[];
}
interface Post {
  id: string; title: string; slug: string; excerpt: string | null;
  content: string; coverImage: string | null; videoUrl: string | null;
  publishedAt: string | null; updatedAt?: string | null; readingTime: number; viewCount: number;
  category: { title: string; slug: string } | null;
  tags: { tag: { title: string; slug: string } }[];
  relatedProducts: { product: Product }[];
  /** سوالات متداول — با normalizeFaq امن می‌شود */
  faq?: unknown;
  comments: PostComment[];
  _count: { comments: number };
}

// ───────────────────────────── اجزا ─────────────────────────────

function ShareButtons({ title, compact = false }: { title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(window.location.href.split("#")[0]); }, []);
  const btn = "w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:-translate-y-0.5";
  const enc = encodeURIComponent;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!compact && <span className="text-xs font-black text-[var(--mag-muted)] ml-1">اشتراک‌گذاری:</span>}
      <a href={`https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`} target="_blank" rel="noopener noreferrer" aria-label="تلگرام"
        className={`${btn} bg-sky-500/10 text-sky-500 hover:bg-sky-500 hover:text-white`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.026 9.546c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 14.71l-2.965-.924c-.645-.204-.657-.645.136-.953l11.57-4.461c.537-.194 1.006.131.641.876z" /></svg>
      </a>
      <a href={`https://wa.me/?text=${enc(title + " " + url)}`} target="_blank" rel="noopener noreferrer" aria-label="واتساپ"
        className={`${btn} bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
      </a>
      <a href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`} target="_blank" rel="noopener noreferrer" aria-label="ایکس"
        className={`${btn} bg-[var(--mag-surface-2)] text-[var(--mag-text)] hover:bg-gray-900 hover:text-white`}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
      </a>
      <button type="button" aria-label="کپی لینک"
        onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className={`${btn} ${copied ? "bg-emerald-500 text-white" : "bg-[var(--mag-surface-2)] text-[var(--mag-muted)] hover:text-[var(--mag-text)]"}`}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

/** نوار پیشرفت مطالعه بالای صفحه + درصد برای فهرست مطالب */
function useReadingProgress(selector: string) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      setPct(Math.max(0, Math.min(100, (-r.top / Math.max(total, 1)) * 100)));
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [selector]);
  return pct;
}

function Toc({ headings, active, onPick }: { headings: RichHeading[]; active: string; onPick?: () => void }) {
  let n = 0;
  return (
    <nav className="relative">
      <span className="absolute top-2 bottom-2 right-[0.6rem] w-px bg-[var(--mag-border)]" />
      <ul className="space-y-0.5">
        {headings.map(h => {
          const on = active === h.id;
          if (h.level === 2) n++;
          return (
            <li key={h.id}>
              <a href={`#${h.id}`} onClick={onPick}
                className={`relative flex items-start gap-3 py-1.5 rounded-lg text-[13px] leading-6 transition-colors
                  ${h.level === 3 ? "pr-8 text-[12.5px]" : "pr-0"}
                  ${on ? "text-[var(--mag-accent)] font-black" : "text-[var(--mag-muted)] hover:text-[var(--mag-text)]"}`}>
                {h.level === 2 ? (
                  <span className={`relative z-10 shrink-0 w-5 h-5 mt-0.5 rounded-full text-[10px] font-black flex items-center justify-center transition-all
                    ${on ? "bg-primary-600 text-white scale-110" : "bg-[var(--mag-surface-2)] text-[var(--mag-muted)] ring-4 ring-[var(--mag-surface)]"}`}>
                    {toFa(n)}
                  </span>
                ) : (
                  <span className={`absolute right-[0.45rem] top-3 w-1.5 h-1.5 rounded-full z-10 ${on ? "bg-primary-500" : "bg-[var(--mag-border)]"}`} />
                )}
                <span className="line-clamp-2">{h.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Price({ p }: { p: Product }) {
  const price = Number(p.salePrice ?? p.price);
  const orig = Number(p.price);
  const disc = p.salePrice && Number(p.salePrice) < orig && orig > 0 ? Math.round(((orig - price) / orig) * 100) : 0;
  if (!price) return <span className="text-xs font-bold text-[var(--mag-muted)]">استعلام قیمت</span>;
  return (
    <span className="flex items-center gap-2 flex-wrap">
      {disc > 0 && <span className="text-[10px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded-md">{toFa(disc)}٪</span>}
      {disc > 0 && <span className="text-[11px] text-[var(--mag-muted)] line-through tabular-nums">{toFa(orig)}</span>}
      <span className="text-sm font-black text-[var(--mag-accent)] tabular-nums">{toFa(price)} <span className="text-[10px] font-bold">تومان</span></span>
    </span>
  );
}

const card = "mag-card rounded-[1.75rem]";

// ───────────────────────────── صفحه ─────────────────────────────

export default function MagPostClient({ post, related, storeName }: { post: Post; related: MagPost[]; storeName?: string | null }) {
  const [active, setActive] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const { html, headings } = useMemo(() => enhanceRichHtml(post.content), [post.content]);
  const faq = normalizeFaq(post.faq);
  const progress = useReadingProgress("#article-body");
  const updated = post.updatedAt && post.publishedAt && new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > 86_400_000
    ? post.updatedAt : null;

  // scroll spy — آخرین سرتیتری که از بالای صفحه گذشته
  useEffect(() => {
    if (!headings.length) return;
    const els = headings.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    const on = () => {
      let cur = "";
      for (const el of els) if (el.getBoundingClientRect().top < 140) cur = el.id;
      setActive(cur || els[0]?.id || "");
      setShowTop(window.scrollY > 900);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [headings]);

  useEffect(() => {
    if (headings.length) return;
    const on = () => setShowTop(window.scrollY > 900);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [headings.length]);

  const videoSrc = post.videoUrl
    ? post.videoUrl.includes("youtu") ? post.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/") : post.videoUrl
    : null;

  return (
    <div className="mag-root min-h-screen transition-colors duration-300 overflow-x-clip" dir="rtl">
      {/* نوار پیشرفت مطالعه */}
      <div className="fixed top-0 inset-x-0 h-1 z-[70] pointer-events-none">
        <div className="h-full bg-gradient-to-l from-primary-400 via-primary-500 to-primary-700 origin-right transition-transform duration-150"
          style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      {/* ── سربرگ مقاله ─────────────────────────────────── */}
      <header className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-[-10%] w-[34rem] h-[34rem] rounded-full bg-primary-500/12 blur-3xl" />
          <div className="absolute top-24 right-[-8%] w-[24rem] h-[24rem] rounded-full bg-primary-300/10 blur-3xl" />
        </div>

        <div className="container max-w-6xl relative pt-8 md:pt-10 pb-10 md:pb-14">
          {/* خرده‌نان */}
          <nav aria-label="مسیر" className="flex items-center gap-1.5 text-xs text-[var(--mag-muted)] mb-8 overflow-hidden">
            <Link href="/" className="hover:text-[var(--mag-accent)] shrink-0">خانه</Link>
            <ChevronLeft className="w-3 h-3 shrink-0 opacity-60" />
            <Link href="/mag" className="hover:text-[var(--mag-accent)] shrink-0">مجله</Link>
            {post.category && (
              <>
                <ChevronLeft className="w-3 h-3 shrink-0 opacity-60" />
                <Link href={`/mag?cat=${post.category.slug}`} className="hover:text-[var(--mag-accent)] shrink-0">{post.category.title}</Link>
              </>
            )}
            <ChevronLeft className="w-3 h-3 shrink-0 opacity-60" />
            <span className="text-[var(--mag-text)] truncate">{post.title}</span>
          </nav>

          <div className={`grid gap-10 lg:gap-14 items-center ${post.coverImage ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" : "max-w-3xl"}`}>
            <div className="mag-fade-in">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {post.category && (
                  <Link href={`/mag?cat=${post.category.slug}`}
                    className="px-3.5 py-1.5 rounded-full bg-primary-600 text-white text-xs font-black shadow-md shadow-primary-600/25 hover:bg-primary-500 transition-colors">
                    {post.category.title}
                  </Link>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--mag-surface-2)] text-[var(--mag-muted)] text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" /> {toFa(post.readingTime)} دقیقه مطالعه
                </span>
              </div>

              <h1 className="text-[1.65rem] sm:text-3xl lg:text-[2.35rem] font-black leading-[1.6] text-[var(--mag-text)]">{post.title}</h1>

              {post.excerpt && (
                <p className="mt-5 text-[15px] sm:text-base leading-8 text-[var(--mag-muted)]">{post.excerpt}</p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-[var(--mag-muted)]">
                <span className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-white flex items-center justify-center font-black text-sm shadow">
                    {(storeName || "م").trim().slice(0, 1)}
                  </span>
                  <span className="leading-5">
                    <span className="block font-black text-[var(--mag-text)]">تحریریه {storeName || "مجله"}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(post.publishedAt)}</span>
                  </span>
                </span>
                {updated && (
                  <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />به‌روزرسانی {formatDate(updated)}</span>
                )}
                <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{toFa(post.viewCount)} بازدید</span>
                <a href="#comments" className="flex items-center gap-1.5 hover:text-[var(--mag-accent)]"><MessageCircle className="w-3.5 h-3.5" />{toFa(post._count.comments)} نظر</a>
              </div>
            </div>

            {post.coverImage && (
              <div className="relative mag-fade-in" style={{ animationDelay: "120ms" }}>
                <div className="absolute -inset-3 sm:-inset-4 rounded-[2.25rem] bg-gradient-to-br from-primary-400/30 to-primary-700/10 rotate-[2.5deg]" />
                <div className="relative aspect-[16/10] rounded-[2rem] overflow-hidden shadow-2xl shadow-black/25 ring-1 ring-black/5">
                  <Image src={post.coverImage} alt={post.title} fill priority sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── بدنه ─────────────────────────────────────────── */}
      <div className="container max-w-6xl pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17.5rem] gap-8 lg:gap-10 items-start">
          <article className="min-w-0 space-y-8">
            {/* فهرست مطالب موبایل */}
            {headings.length > 1 && (
              <div className={`lg:hidden ${card} overflow-hidden`}>
                <button type="button" onClick={() => setTocOpen(o => !o)}
                  className="w-full flex items-center gap-2 px-5 py-4 text-sm font-black text-[var(--mag-text)]">
                  <ListTree className="w-4 h-4 text-[var(--mag-accent)]" /> فهرست مطالب
                  <span className="text-[11px] font-bold text-[var(--mag-muted)]">({toFa(headings.filter(h => h.level === 2).length)} بخش)</span>
                  <ChevronLeft className={`w-4 h-4 mr-auto transition-transform ${tocOpen ? "-rotate-90" : ""}`} />
                </button>
                {tocOpen && <div className="px-5 pb-5"><Toc headings={headings} active={active} onPick={() => setTocOpen(false)} /></div>}
              </div>
            )}

            {videoSrc && (
              <div className={`${card} overflow-hidden`}>
                <div className="aspect-video"><iframe src={videoSrc} title={post.title} className="w-full h-full" allowFullScreen loading="lazy" /></div>
              </div>
            )}

            <div className={`${card} px-5 py-7 sm:px-10 sm:py-10`}>
              <div id="article-body" className="rich-content article-body" dangerouslySetInnerHTML={{ __html: html }} />

              {post.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-10 pt-6 border-t border-[var(--mag-border)]">
                  {post.tags.map(({ tag }) => (
                    <Link key={tag.slug} href={`/mag?tag=${tag.slug}`}
                      className="px-3 py-1.5 rounded-full bg-[var(--mag-surface-2)] text-[var(--mag-muted)] text-xs font-bold hover:bg-primary-600 hover:text-white transition-colors">
                      #{tag.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* سوالات متداول — اسکیمای FAQPage در page.tsx سرور منتشر می‌شود.
                سطح تیتر h2 است چون تیترهای داخل متن مقاله از h2 شروع می‌شوند. */}
            {faq.length > 0 && (
              <div className={`${card} p-5 sm:p-8`}>
                <FaqSection items={faq} className="mt-0" />
              </div>
            )}

            {/* پایان مقاله: اشتراک */}
            <div className={`${card} p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-gradient-to-l from-[var(--mag-accent-soft)] to-transparent`}>
              <div className="flex items-center gap-3 flex-1">
                <span className="w-11 h-11 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-600/30"><Share2 className="w-5 h-5" /></span>
                <div>
                  <p className="font-black text-[var(--mag-text)]">این مطلب به کارتان آمد؟</p>
                  <p className="text-xs text-[var(--mag-muted)] mt-0.5">برای دوستانتان بفرستید</p>
                </div>
              </div>
              <ShareButtons title={post.title} compact />
            </div>

            {post.relatedProducts.length > 0 && (
              <section className={`${card} p-5 sm:p-8`}>
                <h2 className="font-black text-lg text-[var(--mag-text)] flex items-center gap-3 mb-5">
                  <span className="w-1.5 h-6 bg-primary-500 rounded-full" /> محصولات معرفی‌شده در این مطلب
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {post.relatedProducts.map(({ product: p }) => {
                    const img = p.mainImage ?? p.images[0]?.url ?? null;
                    return (
                      <Link key={p.id} href={`/products/${p.slug}`}
                        className="group flex items-center gap-4 p-3 pl-4 rounded-2xl bg-[var(--mag-surface-2)] border border-transparent hover:border-[var(--mag-accent)]/40 hover:shadow-lg transition-all">
                        <div className="relative w-[4.5rem] h-[4.5rem] rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
                          {img ? <Image src={img} alt={p.title} fill className="object-contain p-1.5 group-hover:scale-110 transition-transform" sizes="72px" /> : null}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm font-black text-[var(--mag-text)] line-clamp-2 leading-6 group-hover:text-[var(--mag-accent)] transition-colors">{p.title}</p>
                          <Price p={p} />
                        </div>
                        <ChevronLeft className="w-4 h-4 text-[var(--mag-muted)] group-hover:text-[var(--mag-accent)] group-hover:-translate-x-1 transition-all shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <div id="comments" className={`${card} p-5 sm:p-8 scroll-mt-28`}>
              <PostComments postSlug={post.slug} postTitle={post.title} comments={post.comments} commentCount={post._count.comments} />
            </div>
          </article>

          {/* ── سایدبار ──────────────────────────────────── */}
          <aside className="hidden lg:block lg:sticky lg:top-24 space-y-5">
            {headings.length > 0 && (
              <div className={`${card} p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <ListTree className="w-4 h-4 text-[var(--mag-accent)]" />
                  <h2 className="font-black text-sm text-[var(--mag-text)]">فهرست مطالب</h2>
                  <span className="mr-auto text-[11px] font-black tabular-nums text-[var(--mag-accent)]">{toFa(Math.round(progress))}٪</span>
                </div>
                <div className="h-1 rounded-full bg-[var(--mag-surface-2)] overflow-hidden mb-4">
                  <div className="h-full bg-primary-500 rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
                </div>
                <div className="max-h-[52vh] overflow-y-auto -ml-2 pl-2">
                  <Toc headings={headings} active={active} />
                </div>
              </div>
            )}
            <div className={`${card} p-5`}>
              <p className="text-xs font-black text-[var(--mag-muted)] mb-3">اشتراک‌گذاری</p>
              <ShareButtons title={post.title} compact />
            </div>
          </aside>
        </div>

        {/* ── مطالب پیشنهادی ───────────────────────────────── */}
        {related.length > 0 && (
          <section className="mt-20">
            <div className="flex items-end justify-between gap-4 mb-4">
              <h2 className="text-2xl md:text-3xl font-light text-[var(--mag-text)]">مطالب <b className="font-black">پیشنهادی</b></h2>
              <Link href={post.category ? `/mag?cat=${post.category.slug}` : "/mag"}
                className="inline-flex items-center gap-1 text-sm font-black text-[var(--mag-accent)] hover:gap-2 transition-all">
                همه‌ی مطالب <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
              {related.map((r, k) => <PostCardH key={r.id} post={r} index={k} />)}
            </div>
          </section>
        )}
      </div>

      {/* برگشت به بالا */}
      <button type="button" aria-label="برگشت به بالا" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-24 left-6 z-40 w-11 h-11 rounded-2xl bg-primary-600 text-white shadow-xl shadow-primary-600/30 flex items-center justify-center transition-all
          ${showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}

