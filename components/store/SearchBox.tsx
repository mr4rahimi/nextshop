"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Product {
  id: string; title: string; slug: string;
  price: string; salePrice: string | null;
  mainImage: string | null; images: { url: string }[];
  brand: { title: string } | null;
  category: { title: string; slug: string } | null;
}
interface SearchResult {
  products: Product[];
  total: number;
  suggestions: {
    categories: { title: string; slug: string; imageUrl: string | null }[];
    brands: { title: string; slug: string; logoUrl: string | null }[];
  };
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

const RECENT_KEY = "mymonta_recent_searches";
function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function addRecent(q: string) {
  const list = [q, ...getRecent().filter(r => r !== q)].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}
function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
}

export default function SearchBox() {
  const router = useRouter();
  const [query, setQuery]         = useState("");
  const [result, setResult]       = useState<SearchResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [recent, setRecent]       = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef  = useRef<HTMLInputElement>(null);
  const boxRef    = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // بارگذاری جستجوهای اخیر
  useEffect(() => { setRecent(getRecent()); }, []);

  // کلیک خارج → بستن
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false); setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResult(null); setLoading(false); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, {
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setResult(null); return; }
    debounceRef.current = setTimeout(() => search(val), 250);
  }

  function handleSubmit(q?: string) {
    const term = (q ?? query).trim();
    if (!term) return;
    addRecent(term);
    setRecent(getRecent());
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const items = result?.products ?? [];
    if (e.key === "Enter") {
      if (activeIdx >= 0 && items[activeIdx]) {
        setOpen(false);
        router.push(`/products/${items[activeIdx].slug}`);
      } else {
        handleSubmit();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false); inputRef.current?.blur();
    }
  }

  const showDropdown = open && (query.length >= 2 || recent.length > 0);
  const hasResult = result && (result.products.length > 0 || result.suggestions.categories.length > 0 || result.suggestions.brands.length > 0);

  return (
    <div ref={boxRef} className="relative w-full" dir="rtl">
      {/* Input */}
      <div className={`relative flex items-center transition-all duration-300 ${open ? "ring-4 ring-primary-500/20 rounded-2xl" : ""}`}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="جستجوی سراسری در محصولات ..."
          className="w-full bg-gray-200/60 dark:bg-primary-950/60 border border-gray-300/30 dark:border-white/5 rounded-2xl py-4 pr-12 pl-14 text-sm font-bold text-right outline-none focus:bg-white dark:focus:bg-primary-950 focus:ring-4 focus:ring-primary-500/30 transition-all placeholder:text-gray-500"
        />
        {/* آیکون جستجو */}
        <div className="absolute right-4 flex items-center pointer-events-none text-gray-400">
          {loading
            ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5} />
              </svg>
          }
        </div>
        {/* دکمه پاک کردن */}
        {query && (
          <button onClick={() => { setQuery(""); setResult(null); inputRef.current?.focus(); }}
            className="absolute left-4 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full right-0 left-0 mt-2 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-gray-100 dark:border-white/10 overflow-hidden z-[200]">

          {/* جستجوهای اخیر — وقتی چیزی تایپ نشده */}
          {!query && recent.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">جستجوهای اخیر</span>
                <button onClick={() => { clearRecent(); setRecent([]); }}
                  className="text-[10px] font-bold text-red-400 hover:text-red-500 transition-colors">
                  پاک کردن
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map(r => (
                  <button key={r} onClick={() => { setQuery(r); search(r); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl text-xs font-bold hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 transition-all">
                    <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* نتایج live */}
          {query.length >= 2 && (
            <>
              {loading && !result && (
                <div className="py-8 flex flex-col items-center gap-3 text-gray-400">
                  <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-70" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs font-bold">در حال جستجو...</span>
                </div>
              )}

              {result && !hasResult && !loading && (
                <div className="py-10 flex flex-col items-center gap-3 text-gray-400">
                  <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm font-bold">نتیجه‌ای برای «{query}» یافت نشد</p>
                  <p className="text-xs text-gray-400">عبارت دیگری امتحان کنید</p>
                </div>
              )}

              {result && hasResult && (
                <div>
                  {/* پیشنهادها — دسته و برند */}
                  {(result.suggestions.categories.length > 0 || result.suggestions.brands.length > 0) && (
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/5">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">دسته‌بندی و برند</p>
                      <div className="flex flex-wrap gap-2">
                        {result.suggestions.categories.map(c => (
                          <Link key={c.slug} href={`/categories/${c.slug}`} onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs font-black hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            {c.title}
                          </Link>
                        ))}
                        {result.suggestions.brands.map(b => (
                          <Link key={b.slug} href={`/brands/${b.slug}`} onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-xl text-xs font-black hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all">
                            {b.logoUrl
                              ? <img src={b.logoUrl} alt={b.title} className="w-4 h-4 object-contain" />
                              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                            }
                            {b.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* محصولات */}
                  {result.products.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">
                        محصولات ({toFa(result.total)} نتیجه)
                      </p>
                      <div className="space-y-0.5">
                        {result.products.map((p, i) => {
                          const img  = p.mainImage ?? p.images[0]?.url ?? null;
                          const price = Number(p.salePrice ?? p.price);
                          const orig  = Number(p.price);
                          const disc  = p.salePrice && Number(p.salePrice) < orig
                            ? Math.round(((orig - price) / orig) * 100) : 0;
                          const cat   = p.category;

                          return (
                            <Link key={p.id} href={`/products/${p.slug}`}
                              onClick={() => { setOpen(false); addRecent(query); setRecent(getRecent()); }}
                              className={`flex items-center gap-4 px-3 py-3 rounded-2xl transition-all ${i === activeIdx ? "bg-primary-50 dark:bg-primary-900/20" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}>
                              {/* تصویر */}
                              <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {img
                                  ? <img src={img} alt={p.title} className="w-full h-full object-contain p-1" />
                                  : <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                }
                              </div>
                              {/* اطلاعات */}
                              <div className="flex-1 min-w-0">
                                {/* هایلایت query در عنوان */}
                                <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">
                                  {highlightMatch(p.title, query)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {cat && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-lg">{cat.title}</span>}
                                  {p.brand && <span className="text-[10px] text-gray-400">{p.brand.title}</span>}
                                </div>
                              </div>
                              {/* قیمت */}
                              <div className="flex-shrink-0 text-left">
                                {disc > 0 && (
                                  <span className="block text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-lg mb-1 text-center">
                                    {toFa(disc)}٪
                                  </span>
                                )}
                                <span className="block text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums whitespace-nowrap">
                                  {toFa(price)}
                                </span>
                                <span className="text-[9px] text-gray-400">تومان</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* دکمه مشاهده همه */}
                  {result.total > 6 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5">
                      <button onClick={() => handleSubmit()}
                        className="w-full py-3 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 text-sm font-black hover:bg-primary-500/20 transition-all flex items-center justify-center gap-2">
                        مشاهده همه {toFa(result.total)} نتیجه برای «{query}»
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// هایلایت قسمت تطبیق یافته
function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded px-0.5 not-italic font-black">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}