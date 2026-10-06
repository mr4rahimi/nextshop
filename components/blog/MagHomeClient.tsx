"use client";

/**
 * صفحه‌ی فهرست مجله (/mag) — طرح «Hot News»: اسلایدر پربازدیدترین‌ها،
 * نوار فیلتر (نما، جستجو، مرتب‌سازی، دسته) و کارت‌های افقی با تصویر
 * بیرون‌زده. رنگ‌ها از پوسته‌ی `.mag-root` (app/styles/mag.css) می‌آیند و
 * روز/شب را خودکار دنبال می‌کنند.
 *
 * فیلترها در آدرس می‌نشینند (?cat=&sort=&q=&tag=) تا لینک‌پذیر باشند؛
 * page.tsx همان‌ها را برای رندر سرور می‌خواند.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon, ChevronDown, Search, X, Flame, Eye, Loader2,
} from "lucide-react";
import { Cover, PostCardH, formatDate, toFa, type MagPost } from "@/components/blog/mag-ui";

interface Category { id: string; title: string; slug: string; _count: { posts: number } }
interface Filters { cat: string; tag: string; q: string; sort: string }

interface Props {
  initialPosts: MagPost[];
  initialTotal: number;
  featured: MagPost[];
  categories: Category[];
  initialFilters: Filters;
  tagTitle: string | null;
}

const SORTS = [
  { v: "newest", l: "جدیدترین مطالب" },
  { v: "popular", l: "پربازدیدترین" },
  { v: "discussed", l: "پربحث‌ترین" },
];

const PAGE = 12;

// ───────────────────────────── اسلایدر ویژه ─────────────────────────────

function HotSlider({ posts }: { posts: MagPost[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = posts.length;
  const go = useCallback((d: number) => setI(x => (x + d + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => go(1), 6500);
    return () => clearTimeout(t);
  }, [i, paused, n, go]);

  if (!n) return null;
  const p = posts[i];

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Link href={`/mag/${p.slug}`} key={p.id}
        className="group relative block md:pr-[min(30%,20rem)] mag-fade-in">
        {/* تصویر شناور — بیرون از کارت */}
        <div className="relative md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 z-10 w-full md:w-[min(34%,22rem)] aspect-[16/10] md:aspect-[4/3.1] mb-[-2.5rem] md:mb-0 px-4 md:px-0">
          <div className="mag-hero-img relative w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/10">
            <Cover src={p.coverImage} alt={p.title} priority sizes="(max-width: 768px) 100vw, 360px" />
          </div>
        </div>
        <div className="mag-hero-card relative rounded-[1.75rem] md:rounded-[1.5rem] pt-14 md:pt-0 md:min-h-[17rem] flex items-center">
          <div className="p-6 md:py-10 md:pr-[min(12%,7rem)] md:pl-12 w-full">
            <div className="flex items-center gap-2 text-xs text-[var(--mag-muted)] mb-3">
              {p.category && <span className="font-bold">{p.category.title}</span>}
              {p.category && <span className="w-1 h-1 rounded-full bg-current opacity-60" />}
              <span>{formatDate(p.publishedAt)}</span>
              <span className="mr-auto hidden sm:flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{toFa(p.viewCount ?? 0)}</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black leading-[1.7] text-[var(--mag-text)] line-clamp-2">{p.title}</h3>
            {p.excerpt && <p className="mt-3 text-sm leading-7 text-[var(--mag-muted)] line-clamp-2 max-w-2xl">{p.excerpt}</p>}
            <span className="inline-flex items-center gap-2 mt-6 px-7 py-2.5 rounded-full bg-primary-600 text-white text-sm font-black shadow-lg shadow-primary-600/30 group-hover:bg-primary-500 group-hover:gap-3 transition-all">
              ادامه مطلب <ChevronLeft className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Link>

      {n > 1 && (
        <div className="flex items-center gap-4 sm:gap-6 mt-8 md:pr-[min(18%,11rem)]">
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="قبلی"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--mag-surface-2)] text-[var(--mag-text)] border border-[var(--mag-border)] hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="بعدی"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--mag-surface-2)] text-[var(--mag-text)] border border-[var(--mag-border)] hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex gap-1.5">
            {posts.map((_, k) => (
              <button key={k} type="button" onClick={() => setI(k)} aria-label={`اسلاید ${toFa(k + 1)}`}
                className="relative flex-1 h-1 rounded-full overflow-hidden bg-[var(--mag-border)]">
                <span className="absolute inset-0 origin-right rounded-full bg-primary-500"
                  style={k < i ? { transform: "scaleX(1)" } : k === i
                    ? { animation: `mag-progress 6.5s linear both`, animationPlayState: paused ? "paused" : "running" }
                    : { transform: "scaleX(0)" }} key={k === i ? `a-${i}` : `s-${k}`} />
              </button>
            ))}
          </div>
          <span className="text-4xl sm:text-5xl font-black tabular-nums text-primary-500/90 leading-none w-16 text-left">
            {toFa(i + 1).padStart(2, "۰")}
          </span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── صفحه ─────────────────────────────

export default function MagHomeClient({ initialPosts, initialTotal, featured, categories, initialFilters, tagTitle }: Props) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [posts, setPosts] = useState(initialPosts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [qInput, setQInput] = useState(initialFilters.q);
  const first = useRef(true);
  const reqId = useRef(0);

  useEffect(() => {
    try { const v = localStorage.getItem("mag-view"); if (v === "list" || v === "grid") setView(v); } catch {}
  }, []);
  function changeView(v: "grid" | "list") {
    setView(v);
    try { localStorage.setItem("mag-view", v); } catch {}
  }

  const query = (f: Filters, p = 1) => {
    const sp = new URLSearchParams();
    if (f.cat) sp.set("cat", f.cat);
    if (f.tag) sp.set("tag", f.tag);
    if (f.q) sp.set("q", f.q);
    if (f.sort && f.sort !== "newest") sp.set("sort", f.sort);
    if (p > 1) sp.set("page", String(p));
    return sp;
  };

  // هر تغییر فیلتر: آدرس به‌روز و صفحه‌ی اول دوباره گرفته می‌شود
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const sp = query(filters);
    const qs = sp.toString();
    window.history.replaceState(null, "", `/mag${qs ? `?${qs}` : ""}`);
    const id = ++reqId.current;
    setLoading(true);
    fetch(`/api/mag?${sp}`).then(r => r.json()).then(d => {
      if (id !== reqId.current) return;
      setPosts(d.posts ?? []); setTotal(d.total ?? 0); setPage(1);
    }).catch(() => {}).finally(() => { if (id === reqId.current) setLoading(false); });
  }, [filters]);

  // جستجو با مکث تایپ
  useEffect(() => {
    if (qInput === filters.q) return;
    const t = setTimeout(() => setFilters(f => ({ ...f, q: qInput.trim() })), 450);
    return () => clearTimeout(t);
  }, [qInput, filters.q]);

  async function loadMore() {
    setLoading(true);
    const p = page + 1;
    try {
      const d = await fetch(`/api/mag?${query(filters, p)}`).then(r => r.json());
      setPosts(prev => [...prev, ...(d.posts ?? []).filter((x: MagPost) => !prev.some(y => y.id === x.id))]);
      setTotal(d.total ?? total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  const hasMore = posts.length < total;
  const activeCat = categories.find(c => c.slug === filters.cat);
  const filtered = !!(filters.cat || filters.tag || filters.q);
  const pill = "mag-select h-11 rounded-full pr-5 pl-10 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/40 cursor-pointer w-full";

  return (
    <div className="mag-root min-h-screen transition-colors duration-300 overflow-x-clip" dir="rtl">
      {/* ── هدر و اسلایدر ─────────────────────────────────── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute top-40 -right-32 w-[22rem] h-[22rem] rounded-full bg-primary-400/10 blur-3xl" />
        </div>
        <div className="container relative pt-10 md:pt-14 pb-6 max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8 md:mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-light text-[var(--mag-text)]">
                مجله <b className="font-black">خواندنی‌ها</b>
              </h1>
              <p className="mt-2 text-sm text-[var(--mag-muted)]">بررسی، آموزش و راهنمای خرید — برای انتخاب آگاهانه‌تر</p>
            </div>
            {featured.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--mag-text)]">
                <Flame className="w-5 h-5 text-orange-500" /> داغ‌ترین <span className="font-light">مطالب!</span>
              </span>
            )}
          </div>
          <HotSlider posts={featured} />
        </div>
      </section>

      <div className="container max-w-6xl pb-20">
        {/* ── نوار فیلتر ───────────────────────────────────── */}
        <div className="flex flex-col-reverse md:flex-row md:items-center gap-3 md:gap-4 pt-10 pb-6 border-b border-[var(--mag-border)]">
          <div className="flex items-center gap-1.5 shrink-0">
            {([["grid", LayoutGrid, "نمای شبکه‌ای"], ["list", ListIcon, "نمای فهرستی"]] as const).map(([k, Icon, l]) => (
              <button key={k} type="button" onClick={() => changeView(k)} title={l} aria-label={l} aria-pressed={view === k}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
                  ${view === k ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30" : "bg-[var(--mag-surface-2)] text-[var(--mag-muted)] hover:text-[var(--mag-text)]"}`}>
                <Icon className="w-[18px] h-[18px]" />
              </button>
            ))}
          </div>
          <div className="relative md:mr-auto md:w-64">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--mag-muted)] pointer-events-none" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="جستجو در مطالب..." aria-label="جستجو در مطالب"
              className="mag-select h-11 w-full rounded-full pr-11 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 placeholder:text-[var(--mag-muted)]" />
            {qInput && (
              <button type="button" onClick={() => setQInput("")} aria-label="پاک کردن جستجو" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mag-muted)]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex md:gap-4">
            <div className="relative md:w-52">
              <select aria-label="مرتب‌سازی" className={pill} value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}>
                {SORTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--mag-muted)]" />
            </div>
            <div className="relative md:w-52">
              <select aria-label="دسته‌بندی" className={pill} value={filters.cat} onChange={e => setFilters(f => ({ ...f, cat: e.target.value }))}>
                <option value="">همه‌ی دسته‌ها</option>
                {categories.map(c => <option key={c.id} value={c.slug}>{c.title} ({toFa(c._count.posts)})</option>)}
              </select>
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--mag-muted)]" />
            </div>
          </div>
        </div>

        {/* ── تیتر بخش ─────────────────────────────────────── */}
        <div className="text-center pt-12 pb-4">
          <h2 className="text-2xl md:text-3xl font-light text-[var(--mag-text)]">
            {activeCat ? <>مطالب <b className="font-black">{activeCat.title}</b></>
              : filters.q ? <>نتایج <b className="font-black">«{filters.q}»</b></>
              : <>آخرین <b className="font-black">مطالب</b></>}
          </h2>
          {filtered && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
              <span className="text-[var(--mag-muted)]">{toFa(total)} مطلب</span>
              {filters.tag && (
                <button type="button" onClick={() => setFilters(f => ({ ...f, tag: "" }))}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--mag-accent-soft)] text-[var(--mag-accent)] font-bold">
                  #{tagTitle ?? filters.tag} <X className="w-3 h-3" />
                </button>
              )}
              <button type="button" onClick={() => { setQInput(""); setFilters({ cat: "", tag: "", q: "", sort: filters.sort }); }}
                className="px-3 py-1 rounded-full border border-[var(--mag-border)] text-[var(--mag-muted)] hover:text-[var(--mag-text)] font-bold">
                حذف فیلترها
              </button>
            </div>
          )}
        </div>

        {/* ── کارت‌ها ──────────────────────────────────────── */}
        <div className={`relative transition-opacity ${loading && page === 1 ? "opacity-50" : ""}`}>
          {posts.length === 0 && !loading ? (
            <div className="text-center py-24">
              <Search className="w-12 h-12 mx-auto text-[var(--mag-muted)] opacity-40" strokeWidth={1.5} />
              <p className="mt-4 text-lg font-black text-[var(--mag-text)]">مطلبی پیدا نشد</p>
              <p className="mt-1 text-sm text-[var(--mag-muted)]">عبارت دیگری جستجو کنید یا فیلترها را بردارید.</p>
            </div>
          ) : (
            <div className={`grid gap-x-10 gap-y-10 mt-6 ${view === "grid" ? "md:grid-cols-2" : "max-w-4xl mx-auto"}`}>
              {posts.map((p, k) => <PostCardH key={p.id} post={p} wide={view === "list"} index={k % PAGE} />)}
            </div>
          )}
        </div>

        {hasMore && (
          <div className="flex flex-col items-center gap-2 mt-14">
            <button type="button" onClick={loadMore} disabled={loading}
              className="inline-flex items-center gap-2 px-9 py-3 rounded-full bg-primary-600 text-white text-sm font-black shadow-lg shadow-primary-600/30 hover:bg-primary-500 hover:-translate-y-0.5 disabled:opacity-60 transition-all">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> در حال بارگذاری...</> : "مشاهده‌ی مطالب بیشتر"}
            </button>
            <span className="text-[11px] text-[var(--mag-muted)]">{toFa(posts.length)} از {toFa(total)} مطلب</span>
          </div>
        )}
      </div>
    </div>
  );
}

